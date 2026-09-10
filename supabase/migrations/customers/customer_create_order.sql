-- =============================================
-- Customer Create Order RPC Function
-- Creates a new order directly linked to the customer account
-- =============================================

CREATE OR REPLACE FUNCTION customer_create_order(
    p_customer_id UUID,
    p_customer_name VARCHAR(255),
    p_contact_number VARCHAR(20),
    p_items JSONB,
    p_total_amount DECIMAL(10, 2),
    p_order_type VARCHAR(20) DEFAULT 'pickup',
    p_customer_email VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    customer_id UUID,
    customer_name VARCHAR(255),
    contact_number VARCHAR(20),
    customer_email VARCHAR(255),
    order_type VARCHAR(20),
    items JSONB,
    total_amount DECIMAL(10, 2),
    status VARCHAR(50),
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    new_order RECORD;
    v_clean_name VARCHAR(255);
    v_clean_contact VARCHAR(20);
    v_clean_email VARCHAR(255);
BEGIN
    v_clean_name := TRIM(p_customer_name);
    v_clean_contact := TRIM(p_contact_number);
    v_clean_email := CASE WHEN p_customer_email IS NOT NULL THEN LOWER(TRIM(p_customer_email)) ELSE NULL END;

    -- Validation
    IF v_clean_name IS NULL OR v_clean_name = '' THEN
        RAISE EXCEPTION 'Customer name is required';
    END IF;

    IF v_clean_contact IS NULL OR v_clean_contact = '' THEN
        RAISE EXCEPTION 'Contact number is required';
    END IF;

    IF LENGTH(REGEXP_REPLACE(v_clean_contact, '[^0-9]', '', 'g')) != 11 THEN
        RAISE EXCEPTION 'Contact number must be exactly 11 digits';
    END IF;

    IF p_order_type NOT IN ('pickup', 'delivery') THEN
        RAISE EXCEPTION 'Order type must be either "pickup" or "delivery"';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
        RAISE EXCEPTION 'Total amount must be greater than 0';
    END IF;

    -- Insert order with customer_id explicitly linked
    INSERT INTO public.orders (
        customer_id,
        customer_name,
        contact_number,
        customer_email,
        order_type,
        items,
        total_amount,
        status
    ) VALUES (
        p_customer_id,
        v_clean_name,
        v_clean_contact,
        v_clean_email,
        p_order_type,
        p_items,
        p_total_amount,
        'pending'
    )
    RETURNING * INTO new_order;

    RETURN QUERY
    SELECT
        new_order.id,
        new_order.customer_id,
        new_order.customer_name,
        new_order.contact_number,
        new_order.customer_email,
        new_order.order_type,
        new_order.items,
        new_order.total_amount,
        new_order.status,
        new_order.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
