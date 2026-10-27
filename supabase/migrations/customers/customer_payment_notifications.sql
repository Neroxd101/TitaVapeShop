-- Add payment decisions without changing existing notification/read state.
ALTER TABLE public.customer_notifications DROP CONSTRAINT IF EXISTS customer_notifications_kind_check;
ALTER TABLE public.customer_notifications ADD CONSTRAINT customer_notifications_kind_check
    CHECK (kind IN ('confirmed', 'completed', 'cancelled', 'voided', 'chat', 'payment_confirmed', 'payment_rejected'));

CREATE OR REPLACE FUNCTION public.customer_notification_payment_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.customer_id IS NOT NULL AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
        IF NEW.payment_status = 'paid' THEN
            INSERT INTO public.customer_notifications(customer_id, order_id, kind, body)
            VALUES (NEW.customer_id, NEW.id, 'payment_confirmed', 'Your payment has been confirmed.');
        ELSIF NEW.payment_status = 'rejected' THEN
            INSERT INTO public.customer_notifications(customer_id, order_id, kind, body)
            VALUES (NEW.customer_id, NEW.id, 'payment_rejected', 'Your payment was rejected.' ||
                CASE WHEN NULLIF(BTRIM(NEW.payment_status_reason), '') IS NOT NULL
                    THEN ' Reason: ' || BTRIM(NEW.payment_status_reason) ELSE '' END);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.customer_notification_payment_event() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS customer_notification_payment_event ON public.orders;
CREATE TRIGGER customer_notification_payment_event AFTER UPDATE OF payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.customer_notification_payment_event();
NOTIFY pgrst, 'reload schema';
