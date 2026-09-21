ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status_reason TEXT;

DROP FUNCTION IF EXISTS public.orders_update_payment_status(UUID, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION public.orders_update_payment_status(
    p_order_id UUID,
    p_payment_status VARCHAR(50),
    p_user_email VARCHAR(255) DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target public.orders%ROWTYPE;
BEGIN
    IF p_payment_status NOT IN ('unpaid', 'pending_verification', 'paid', 'rejected') THEN
        RAISE EXCEPTION 'Invalid payment status: %', p_payment_status;
    END IF;
    IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000 THEN
        RAISE EXCEPTION 'A payment status reason of 1–1000 characters is required';
    END IF;

    SELECT * INTO target FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    IF target.payment_status IS NOT DISTINCT FROM p_payment_status THEN
        RETURN NEXT target;
        RETURN;
    END IF;

    PERFORM public.transactions_log(
        p_action_type => 'order_payment_update',
        p_user_email => p_user_email,
        p_entity_id => target.id,
        p_entity_type => 'order',
        p_customer_name => target.customer_name,
        p_customer_email => target.customer_email,
        p_details => jsonb_build_object(
            'order_id', target.id,
            'previous_payment_status', target.payment_status,
            'new_payment_status', p_payment_status,
            'reason', btrim(p_reason)
        )
    );

    RETURN QUERY UPDATE public.orders
    SET payment_status = p_payment_status,
        payment_status_reason = btrim(p_reason), updated_at = NOW()
    WHERE id = target.id
    RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.orders_update_payment_status(UUID, VARCHAR, VARCHAR, TEXT)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_update_payment_status(UUID, VARCHAR, VARCHAR, TEXT)
TO service_role;
