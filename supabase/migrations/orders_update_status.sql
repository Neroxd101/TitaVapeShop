-- =============================================
-- Update Order Status Function
-- Updates the status of an order (e.g., confirm order)
-- =============================================

CREATE OR REPLACE FUNCTION orders_update_status(
    p_order_id UUID,
    p_status VARCHAR(50)
)
RETURNS TABLE (
    id UUID,
    customer_name VARCHAR(255),
    contact_number VARCHAR(20),
    social_media TEXT,
    order_type VARCHAR(20),
    items JSONB,
    total_amount DECIMAL(10, 2),
    status VARCHAR(50),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    updated_order RECORD;
    current_status VARCHAR(50);
    order_items JSONB;
    item_record JSONB;
    item_id UUID;
    item_qty INTEGER;
    item_price DECIMAL(10,2);
BEGIN
    -- Validate status
    IF p_status NOT IN ('pending', 'confirmed', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status: %', p_status;
    END IF;

    -- Get order items and current status before update (to process inventory deduction)
    SELECT o.items, o.status INTO order_items, current_status
    FROM orders o
    WHERE o.id = p_order_id;

    IF order_items IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- If completing the order, deduct inventory quantities
    -- Only deduct if order was not already completed (prevent double deduction)
    IF p_status = 'completed' AND (current_status IS NULL OR current_status != 'completed') THEN
        -- Loop through each item in the order
        FOR item_record IN SELECT * FROM jsonb_array_elements(order_items)
        LOOP
            item_id := (item_record->>'id')::UUID;
            item_qty := (item_record->>'quantity')::INTEGER;
            item_price := (item_record->>'price')::DECIMAL(10,2);

            -- Validate item data
            IF item_id IS NULL OR item_qty IS NULL OR item_qty <= 0 THEN
                RAISE EXCEPTION 'Invalid item data in order';
            END IF;

            -- Deduct inventory using inventory_complete_sale function
            -- This handles quantity deduction and profit calculation
            PERFORM inventory_complete_sale(
                p_id => item_id,
                p_qty_sold => item_qty,
                p_sale_price => item_price
            );
        END LOOP;
    END IF;

    -- Update order status and return the updated order
    UPDATE orders o
    SET status = p_status,
        updated_at = NOW()
    WHERE o.id = p_order_id
    RETURNING 
        o.id,
        o.customer_name,
        o.contact_number,
        o.social_media,
        o.order_type,
        o.items,
        o.total_amount,
        o.status,
        o.created_at,
        o.updated_at
    INTO updated_order;

    -- Check if order was found
    IF updated_order.id IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Return the updated order
    RETURN QUERY
    SELECT
        updated_order.id,
        updated_order.customer_name,
        updated_order.contact_number,
        updated_order.social_media,
        updated_order.order_type,
        updated_order.items,
        updated_order.total_amount,
        updated_order.status,
        updated_order.created_at,
        updated_order.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
