-- Records a full outstanding refund already sent by the store.
CREATE OR REPLACE FUNCTION public.orders_mark_refunded(
    p_order_id UUID,
    p_refund_amount NUMERIC,
    p_expected_refunded_amount NUMERIC,
    p_user_email VARCHAR(255) DEFAULT NULL
)
RETURNS SETOF public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    target public.orders%ROWTYPE;
BEGIN
    IF p_refund_amount IS NULL OR p_refund_amount <= 0
        OR p_refund_amount::TEXT IN ('NaN', 'Infinity', '-Infinity')
        OR p_expected_refunded_amount IS NULL OR p_expected_refunded_amount < 0
        OR p_expected_refunded_amount::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
        RAISE EXCEPTION 'Valid refund amounts are required';
    END IF;
    PERFORM pg_advisory_xact_lock_shared(746482, 1);
    SELECT * INTO target FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    IF target.payment_status IS DISTINCT FROM 'paid' OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(target.items) i WHERE i->>'unavailable' = 'true'
    ) THEN
        RAISE EXCEPTION 'Only paid orders with unavailable products can be refunded';
    END IF;
    -- Retried requests after settlement do not create another refund or audit.
    IF target.refund_due_amount = 0 THEN
        RETURN NEXT target;
        RETURN;
    END IF;
    IF target.refund_due_amount <> p_refund_amount
        OR target.refunded_amount <> p_expected_refunded_amount THEN
        RAISE EXCEPTION 'Refund balance changed. Refresh the order and confirm the current refund amount.';
    END IF;
    PERFORM public.transactions_log(
        p_action_type => 'order_refund', p_user_email => p_user_email,
        p_entity_id => target.id, p_entity_type => 'order',
        p_customer_name => target.customer_name, p_customer_email => target.customer_email,
        p_details => jsonb_build_object('order_id', target.id,
            'refund_amount', target.refund_due_amount,
            'refunded_amount', target.refunded_amount + target.refund_due_amount,
            'refund_due_before', target.refund_due_amount, 'refund_due_after', 0)
    );
    RETURN QUERY UPDATE public.orders
    SET refunded_amount = target.refunded_amount + target.refund_due_amount,
        refund_due_amount = 0, refunded_at = NOW(), updated_at = NOW()
    WHERE id = target.id RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION public.orders_mark_refunded(UUID, NUMERIC, NUMERIC, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_mark_refunded(UUID, NUMERIC, NUMERIC, VARCHAR) TO service_role;
