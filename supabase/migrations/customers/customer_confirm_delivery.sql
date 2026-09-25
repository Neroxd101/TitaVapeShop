-- Separate delivery confirmation from the admin's completed/sale status.
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_confirmation
    ON public.orders (order_type, status, delivery_confirmed_at, updated_at);

CREATE OR REPLACE FUNCTION public.customer_confirm_delivery(
    p_order_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_customer_email VARCHAR(255) DEFAULT NULL,
    p_phone VARCHAR(20) DEFAULT NULL
)
RETURNS SETOF public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    target public.orders%ROWTYPE;
    clean_email TEXT := NULLIF(LOWER(BTRIM(p_customer_email)), '');
    input_digits TEXT := REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
    order_digits TEXT;
BEGIN
    SELECT * INTO target FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    IF target.order_type <> 'delivery' THEN
        RAISE EXCEPTION 'Only third-party delivery orders can be confirmed';
    END IF;
    IF target.status <> 'completed' THEN
        RAISE EXCEPTION 'The order must be completed before delivery can be confirmed';
    END IF;
    IF target.delivery_confirmed_at IS NOT NULL THEN
        RETURN NEXT target;
        RETURN;
    END IF;

    order_digits := REGEXP_REPLACE(COALESCE(target.contact_number, ''), '[^0-9]', '', 'g');
    IF (p_customer_id IS NULL OR target.customer_id IS NULL OR target.customer_id <> p_customer_id)
       AND (clean_email IS NULL OR target.customer_email IS NULL OR LOWER(BTRIM(target.customer_email)) <> clean_email)
       AND (input_digits = '' OR input_digits <> order_digits) THEN
        RAISE EXCEPTION 'You are not authorized to confirm this order';
    END IF;

    RETURN QUERY UPDATE public.orders
        SET delivery_confirmed_at = NOW(), updated_at = NOW()
        WHERE id = target.id
        RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_confirm_third_party_deliveries()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE confirmed_count INTEGER;
BEGIN
    UPDATE public.orders
    SET delivery_confirmed_at = updated_at + INTERVAL '7 days'
    WHERE order_type = 'delivery'
      AND status = 'completed'
      AND delivery_confirmed_at IS NULL
      AND updated_at <= NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS confirmed_count = ROW_COUNT;
    RETURN confirmed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_confirm_delivery(UUID, UUID, VARCHAR, VARCHAR)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_confirm_delivery(UUID, UUID, VARCHAR, VARCHAR)
    TO service_role;
REVOKE ALL ON FUNCTION public.auto_confirm_third_party_deliveries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_confirm_third_party_deliveries() TO service_role;

-- Supabase pg_cron runs the fallback hourly without changing order status or sale totals.
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-confirm-third-party-deliveries') THEN
        PERFORM cron.schedule(
            'auto-confirm-third-party-deliveries',
            '0 * * * *',
            $job$SELECT public.auto_confirm_third_party_deliveries();$job$
        );
    END IF;
END;
$$;
