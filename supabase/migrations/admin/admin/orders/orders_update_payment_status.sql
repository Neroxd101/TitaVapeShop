CREATE OR REPLACE FUNCTION public.orders_update_payment_status(
    p_order_id UUID,
    p_payment_status VARCHAR(50),
    p_user_email VARCHAR(255) DEFAULT NULL
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
            'new_payment_status', p_payment_status
        )
    );

    RETURN QUERY UPDATE public.orders
    SET payment_status = p_payment_status, updated_at = NOW()
    WHERE id = target.id
    RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.orders_update_payment_status(UUID, VARCHAR, VARCHAR)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_update_payment_status(UUID, VARCHAR, VARCHAR)
TO service_role;
