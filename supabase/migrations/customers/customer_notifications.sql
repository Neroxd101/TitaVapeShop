-- Capture new events only. Existing orders and messages are not backfilled.
CREATE TABLE IF NOT EXISTS public.customer_notifications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    message_id BIGINT UNIQUE REFERENCES public.order_chat_messages(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('confirmed', 'completed', 'cancelled', 'voided', 'chat')),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS customer_notifications_customer_idx ON public.customer_notifications(customer_id, id DESC);
CREATE INDEX IF NOT EXISTS customer_notifications_unread_idx ON public.customer_notifications(customer_id, id) WHERE read_at IS NULL;
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.customer_notifications TO service_role;
REVOKE ALL ON SEQUENCE public.customer_notifications_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.customer_notification_order_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.customer_id IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('confirmed', 'completed', 'cancelled', 'voided') THEN
        INSERT INTO public.customer_notifications(customer_id, order_id, kind, body)
        VALUES (NEW.customer_id, NEW.id, NEW.status, 'Your order has been ' || NEW.status || '.');
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS customer_notification_order_event ON public.orders;
CREATE TRIGGER customer_notification_order_event AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.customer_notification_order_event();

CREATE OR REPLACE FUNCTION public.customer_notification_chat_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.sender = 'admin' AND NOT NEW.legacy THEN
            INSERT INTO public.customer_notifications(customer_id, order_id, message_id, kind, body)
            SELECT o.customer_id, NEW.order_id, NEW.id, 'chat', LEFT(NEW.body, 180)
            FROM public.orders o WHERE o.id = NEW.order_id AND o.customer_id IS NOT NULL;
        END IF;
    ELSIF NEW.sender = 'admin' AND NEW.read_at IS NOT NULL AND OLD.read_at IS NULL THEN
        UPDATE public.customer_notifications SET read_at = NEW.read_at
        WHERE message_id = NEW.id AND read_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS customer_notification_chat_event ON public.order_chat_messages;
CREATE TRIGGER customer_notification_chat_event AFTER INSERT OR UPDATE OF read_at ON public.order_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.customer_notification_chat_event();

CREATE OR REPLACE FUNCTION public.customer_notifications_get(
    p_customer_id UUID, p_before_id BIGINT DEFAULT NULL, p_limit INTEGER DEFAULT 20
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE entries JSONB;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id AND is_verified IS TRUE) THEN
        RAISE EXCEPTION 'A verified customer account is required';
    END IF;
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN RAISE EXCEPTION 'Invalid notification limit'; END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', n.id::TEXT, 'order_id', n.order_id, 'kind', n.kind, 'body', n.body,
        'created_at', n.created_at, 'read_at', n.read_at
    ) ORDER BY n.id DESC), '[]'::JSONB) INTO entries
    FROM (SELECT * FROM public.customer_notifications WHERE customer_id = p_customer_id
          AND (p_before_id IS NULL OR id < p_before_id) ORDER BY id DESC LIMIT p_limit) n;
    RETURN jsonb_build_object('notifications', entries, 'unread_count',
        (SELECT COUNT(*) FROM public.customer_notifications WHERE customer_id = p_customer_id AND read_at IS NULL),
        'has_more', EXISTS (SELECT 1 FROM public.customer_notifications WHERE customer_id = p_customer_id
            AND id < (SELECT MIN((value->>'id')::BIGINT) FROM jsonb_array_elements(entries))));
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_notifications_read(
    p_customer_id UUID, p_id BIGINT DEFAULT NULL, p_through_id BIGINT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id AND is_verified IS TRUE) THEN
        RAISE EXCEPTION 'A verified customer account is required';
    END IF;
    IF (p_id IS NULL) = (p_through_id IS NULL) THEN RAISE EXCEPTION 'Select a notification or a read boundary'; END IF;
    UPDATE public.customer_notifications SET read_at = NOW()
    WHERE customer_id = p_customer_id AND read_at IS NULL
      AND ((p_id IS NOT NULL AND id = p_id) OR (p_through_id IS NOT NULL AND id <= p_through_id));
    RETURN jsonb_build_object('unread_count',
        (SELECT COUNT(*) FROM public.customer_notifications WHERE customer_id = p_customer_id AND read_at IS NULL));
END;
$$;
REVOKE ALL ON FUNCTION public.customer_notification_order_event(), public.customer_notification_chat_event(),
    public.customer_notifications_get(UUID, BIGINT, INTEGER), public.customer_notifications_read(UUID, BIGINT, BIGINT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_notifications_get(UUID, BIGINT, INTEGER), public.customer_notifications_read(UUID, BIGINT, BIGINT) TO service_role;
NOTIFY pgrst, 'reload schema';
