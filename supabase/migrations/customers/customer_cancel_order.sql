-- =============================================
-- Customer Cancel Order RPC Function
-- Allows customers or guest orderers (with verified phone) to cancel pending orders
-- =============================================

CREATE OR REPLACE FUNCTION customer_cancel_order(
    p_order_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_customer_email VARCHAR(255) DEFAULT NULL,
    p_phone VARCHAR(20) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    customer_id UUID,
    customer_name VARCHAR(255),
    contact_number VARCHAR(20),
    social_media TEXT,
    customer_email VARCHAR(255),
    order_type VARCHAR(20),
    items JSONB,
    total_amount DECIMAL(10, 2),
    status VARCHAR(50),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_order RECORD;
    v_is_authorized BOOLEAN := FALSE;
    v_clean_email VARCHAR(255);
    v_input_digits VARCHAR(50);
    v_order_digits VARCHAR(50);
    v_updated_order RECORD;
    v_actor_email VARCHAR(255);
BEGIN
    -- 1. Validate order id
    IF p_order_id IS NULL THEN
        RAISE EXCEPTION 'A valid order ID is required.';
    END IF;

    -- 2. Fetch existing order
    SELECT * INTO v_order
    FROM public.orders
    WHERE public.orders.id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.';
    END IF;

    IF LOWER(v_order.status) != 'pending' THEN
        RAISE EXCEPTION 'Only pending orders can be cancelled. This order may already have been updated.';
    END IF;

    -- 3. Verify customer ownership
    v_clean_email := CASE WHEN p_customer_email IS NOT NULL THEN LOWER(TRIM(p_customer_email)) ELSE NULL END;

    -- Check if authenticated customer owns this order
    IF p_customer_id IS NOT NULL AND v_order.customer_id IS NOT NULL AND v_order.customer_id = p_customer_id THEN
        v_is_authorized := TRUE;
        v_actor_email := COALESCE(v_clean_email, v_order.customer_email, 'Customer');
    ELSIF v_clean_email IS NOT NULL AND v_order.customer_email IS NOT NULL AND LOWER(TRIM(v_order.customer_email)) = v_clean_email THEN
        v_is_authorized := TRUE;
        v_actor_email := v_clean_email;
    END IF;

    -- Check guest verification by phone if not yet authorized
    IF NOT v_is_authorized AND p_phone IS NOT NULL THEN
        v_input_digits := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
        v_order_digits := REGEXP_REPLACE(COALESCE(v_order.contact_number, ''), '[^0-9]', '', 'g');

        IF LENGTH(v_input_digits) >= 4 AND (
            v_order_digits = v_input_digits OR 
            RIGHT(v_order_digits, LENGTH(v_input_digits)) = v_input_digits
        ) THEN
            v_is_authorized := TRUE;
            v_actor_email := COALESCE(v_order.customer_email, 'Customer');
        END IF;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'You are not authorized to cancel this order. Please sign in with your account.';
    END IF;

    -- 4. Perform update to cancelled status
    UPDATE public.orders
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE public.orders.id = p_order_id
      AND LOWER(public.orders.status) = 'pending'
    RETURNING * INTO v_updated_order;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Only pending orders can be cancelled. This order may already have been updated.';
    END IF;

    -- 5. Audit log to transactions_log (safe block)
    BEGIN
        PERFORM public.transactions_log(
            p_action_type => 'order_cancel',
            p_user_email => COALESCE(v_actor_email, 'Customer'),
            p_entity_id => v_updated_order.id,
            p_entity_type => 'order',
            p_sale_total => v_updated_order.total_amount,
            p_sale_items => v_updated_order.items,
            p_customer_name => v_updated_order.customer_name,
            p_customer_email => v_updated_order.customer_email,
            p_details => jsonb_build_object(
                'order_id', v_updated_order.id,
                'order_type', v_updated_order.order_type,
                'previous_status', 'pending',
                'cancelled_by', 'customer',
                'items_count', CASE WHEN jsonb_typeof(v_updated_order.items) = 'array' THEN jsonb_array_length(v_updated_order.items) ELSE 0 END
            )
        );
    EXCEPTION WHEN OTHERS THEN
        -- Fail silently on audit logging error so cancellation is not blocked
        NULL;
    END;

    -- 6. Return updated order
    RETURN QUERY
    SELECT
        v_updated_order.id,
        v_updated_order.customer_id,
        v_updated_order.customer_name,
        v_updated_order.contact_number,
        v_updated_order.social_media,
        v_updated_order.customer_email,
        v_updated_order.order_type,
        v_updated_order.items,
        v_updated_order.total_amount,
        v_updated_order.status,
        v_updated_order.created_at,
        v_updated_order.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION customer_cancel_order IS 'Cancels a pending order after verifying customer account or contact phone ownership.';
