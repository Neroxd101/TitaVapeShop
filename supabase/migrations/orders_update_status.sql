-- =============================================
-- Update Order Status Function
-- Updates the status of an order (e.g., confirm order)
-- =============================================

CREATE OR REPLACE FUNCTION orders_update_status(
    p_order_id UUID,
    p_status VARCHAR(50),
    p_user_email VARCHAR(255) DEFAULT NULL
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
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    updated_order RECORD;
    current_status VARCHAR(50);
    order_items JSONB;
    order_customer_name VARCHAR(255);
    order_customer_email VARCHAR(255);
    order_total_amount DECIMAL(10,2);
    order_type VARCHAR(20);
    item_record JSONB;
    item_id UUID;
    item_qty INTEGER;
    item_price DECIMAL(10,2);
    sale_items_formatted JSONB;
    sale_item_formatted JSONB;
BEGIN
    -- Validate status
    IF p_status NOT IN ('pending', 'confirmed', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status: %', p_status;
    END IF;

    -- Get order details before update (to process inventory deduction and transaction logging)
    SELECT o.items, o.status, o.customer_name, o.customer_email, o.total_amount, o.order_type
    INTO order_items, current_status, order_customer_name, order_customer_email, order_total_amount, order_type
    FROM orders o
    WHERE o.id = p_order_id;

    IF order_items IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Log transaction for order confirmation
    IF p_status = 'confirmed' AND (current_status IS NULL OR current_status != 'confirmed') THEN
        -- Log order confirmation transaction
        PERFORM transactions_log(
            p_action_type => 'order_confirm',
            p_user_email => p_user_email,
            p_entity_id => p_order_id,
            p_entity_type => 'order',
            p_sale_total => order_total_amount,
            p_sale_items => order_items,
            p_customer_name => order_customer_name,
            p_customer_email => order_customer_email,
            p_details => jsonb_build_object(
                'order_id', p_order_id,
                'order_type', order_type,
                'items_count', jsonb_array_length(order_items),
                'previous_status', current_status
            )
        );
    END IF;

    -- Log transaction for order cancellation
    IF p_status = 'cancelled' AND (current_status IS NULL OR current_status != 'cancelled') THEN
        -- Log order cancellation transaction
        PERFORM transactions_log(
            p_action_type => 'order_cancel',
            p_user_email => p_user_email,
            p_entity_id => p_order_id,
            p_entity_type => 'order',
            p_sale_total => order_total_amount,
            p_sale_items => order_items,
            p_customer_name => order_customer_name,
            p_customer_email => order_customer_email,
            p_details => jsonb_build_object(
                'order_id', p_order_id,
                'order_type', order_type,
                'items_count', jsonb_array_length(order_items),
                'previous_status', current_status
            )
        );
    END IF;

    -- If completing the order, deduct inventory quantities and log transaction
    -- Only deduct if order was not already completed (prevent double deduction)
    IF p_status = 'completed' AND (current_status IS NULL OR current_status != 'completed') THEN
        -- Initialize sale_items array for transaction logging
        sale_items_formatted := '[]'::jsonb;

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

            -- Format item for transaction logging (sale_items format: id, qty, price)
            sale_item_formatted := jsonb_build_object(
                'id', item_id,
                'qty', item_qty,
                'price', item_price
            );

            -- Add to sale_items array
            sale_items_formatted := sale_items_formatted || jsonb_build_array(sale_item_formatted);
        END LOOP;

        -- Log transaction for completed order
        PERFORM transactions_log(
            p_action_type => 'sale_complete',
            p_user_email => p_user_email,
            p_entity_id => p_order_id,
            p_entity_type => 'order',
            p_sale_total => order_total_amount,
            p_sale_items => sale_items_formatted,
            p_customer_name => order_customer_name,
            p_customer_email => NULL,
            p_details => jsonb_build_object(
                'order_id', p_order_id,
                'order_type', order_type,
                'items_count', jsonb_array_length(order_items)
            )
        );
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
        o.customer_email,
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
        updated_order.customer_email,
        updated_order.order_type,
        updated_order.items,
        updated_order.total_amount,
        updated_order.status,
        updated_order.created_at,
        updated_order.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
