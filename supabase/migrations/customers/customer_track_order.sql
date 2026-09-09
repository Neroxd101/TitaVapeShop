-- =============================================
-- Customer Track Order RPC Function
-- Allows customers or guest orderers (with verified phone) to view order status & details
-- =============================================

CREATE OR REPLACE FUNCTION customer_track_order(
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
BEGIN
    -- 1. Validate order ID
    IF p_order_id IS NULL THEN
        RAISE EXCEPTION 'A valid order ID is required.';
    END IF;

    -- 2. Fetch order
    SELECT * INTO v_order
    FROM public.orders
    WHERE public.orders.id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.';
    END IF;

    -- 3. Verify customer authorization
    v_clean_email := CASE WHEN p_customer_email IS NOT NULL THEN LOWER(TRIM(p_customer_email)) ELSE NULL END;

    -- Check if authenticated customer owns this order
    IF p_customer_id IS NOT NULL AND v_order.customer_id IS NOT NULL AND v_order.customer_id = p_customer_id THEN
        v_is_authorized := TRUE;
    ELSIF v_clean_email IS NOT NULL AND v_order.customer_email IS NOT NULL AND LOWER(TRIM(v_order.customer_email)) = v_clean_email THEN
        v_is_authorized := TRUE;
    END IF;

    -- Check contact phone verification if not yet authorized
    IF NOT v_is_authorized THEN
        IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
            RAISE EXCEPTION 'REQUIRES_PHONE: Please enter the contact number used during checkout to view this order.';
        END IF;

        v_input_digits := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
        v_order_digits := REGEXP_REPLACE(COALESCE(v_order.contact_number, ''), '[^0-9]', '', 'g');

        IF LENGTH(v_input_digits) >= 4 AND (
            v_order_digits = v_input_digits OR 
            RIGHT(v_order_digits, LENGTH(v_input_digits)) = v_input_digits
        ) THEN
            v_is_authorized := TRUE;
        ELSE
            RAISE EXCEPTION 'The contact number entered does not match this order.';
        END IF;
    END IF;

    -- 4. Return order details
    RETURN QUERY
    SELECT
        v_order.id,
        v_order.customer_id,
        v_order.customer_name,
        v_order.contact_number,
        v_order.social_media,
        v_order.customer_email,
        v_order.order_type,
        v_order.items,
        v_order.total_amount,
        v_order.status,
        v_order.created_at,
        v_order.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION customer_track_order IS 'Retrieves order details for an order after validating authenticated customer session or contact phone match.';
