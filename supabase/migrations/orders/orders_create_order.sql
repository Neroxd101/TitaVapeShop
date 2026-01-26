-- =============================================
-- Create Order Function
-- Creates a new order from the catalog
-- =============================================

CREATE OR REPLACE FUNCTION orders_create_order(
    p_customer_name VARCHAR(255),
    p_contact_number VARCHAR(20),
    p_items JSONB,
    p_total_amount DECIMAL(10, 2),
    p_order_type VARCHAR(20) DEFAULT 'pickup',
    p_social_media TEXT DEFAULT NULL,
    p_customer_email VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    customer_name VARCHAR(255),
    contact_number VARCHAR(20),
    social_media TEXT,
    customer_email VARCHAR(255),
    order_type VARCHAR(20),
    items JSONB,
    total_amount DECIMAL(10, 2),
    status VARCHAR(50),
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    new_order RECORD;
BEGIN
    -- Validate required fields
    IF p_customer_name IS NULL OR TRIM(p_customer_name) = '' THEN
        RAISE EXCEPTION 'Customer name is required';
    END IF;

    IF p_contact_number IS NULL OR TRIM(p_contact_number) = '' THEN
        RAISE EXCEPTION 'Contact number is required';
    END IF;

    -- Validate contact number format (11 digits)
    IF LENGTH(REGEXP_REPLACE(p_contact_number, '[^0-9]', '', 'g')) != 11 THEN
        RAISE EXCEPTION 'Contact number must be 11 digits';
    END IF;

    -- Validate order type
    IF p_order_type NOT IN ('pickup', 'delivery') THEN
        RAISE EXCEPTION 'Order type must be either "pickup" or "delivery"';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
        RAISE EXCEPTION 'Total amount must be greater than 0';
    END IF;

    -- Insert order
    INSERT INTO orders (
        customer_name,
        contact_number,
        social_media,
        customer_email,
        order_type,
        items,
        total_amount,
        status
    ) VALUES (
        TRIM(p_customer_name),
        TRIM(p_contact_number),
        CASE WHEN p_social_media IS NOT NULL THEN TRIM(p_social_media) ELSE NULL END,
        CASE WHEN p_customer_email IS NOT NULL THEN TRIM(p_customer_email) ELSE NULL END,
        p_order_type,
        p_items,
        p_total_amount,
        'pending'
    )
    RETURNING * INTO new_order;

    -- Return the created order
    RETURN QUERY
    SELECT
        new_order.id,
        new_order.customer_name,
        new_order.contact_number,
        new_order.social_media,
        new_order.customer_email,
        new_order.order_type,
        new_order.items,
        new_order.total_amount,
        new_order.status,
        new_order.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
