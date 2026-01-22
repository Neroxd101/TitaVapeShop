-- =============================================
-- Sales Process Function
-- Processes a sale by deducting inventory quantities
-- =============================================

CREATE OR REPLACE FUNCTION sales_process(
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item_record JSONB;
    current_quantity INTEGER;
    item_name VARCHAR(100);
    new_quantity INTEGER;
    results JSONB[] := ARRAY[]::JSONB[];
    errors JSONB[] := ARRAY[]::JSONB[];
    item_id UUID;
    item_qty INTEGER;
BEGIN
    -- Validate input
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid cart items'
        );
    END IF;

    -- Process each item
    FOR item_record IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        BEGIN
            -- Extract item data
            item_id := (item_record->>'id')::UUID;
            item_qty := COALESCE((item_record->>'qty')::INTEGER, 0);

            IF item_id IS NULL OR item_qty <= 0 THEN
                RAISE EXCEPTION 'Invalid item data: id or qty missing';
            END IF;

            -- Get current inventory item
            SELECT inventory.quantity, inventory.name
            INTO current_quantity, item_name
            FROM inventory
            WHERE inventory.id = item_id;

            -- Check if item exists
            IF current_quantity IS NULL THEN
                RAISE EXCEPTION 'Item not found: %', item_id;
            END IF;

            -- Check stock availability
            IF current_quantity < item_qty THEN
                RAISE EXCEPTION 'Insufficient stock for item. Available: %, Requested: %', 
                    current_quantity, item_qty;
            END IF;

            -- Calculate new quantity
            new_quantity := current_quantity - item_qty;

            -- Update inventory quantity
            UPDATE inventory
            SET quantity = new_quantity,
                updated_at = NOW()
            WHERE inventory.id = item_id;

            -- Add to results
            results := results || jsonb_build_object(
                'id', item_id,
                'name', item_name,
                'deducted', item_qty,
                'remaining', new_quantity
            );

        EXCEPTION
            WHEN OTHERS THEN
                -- Add to errors
                errors := errors || jsonb_build_object(
                    'id', COALESCE(item_id::TEXT, 'unknown'),
                    'name', COALESCE(item_name, item_record->>'name', 'Unknown'),
                    'error', SQLERRM
                );
        END;
    END LOOP;

    -- If there are errors, return partial success
    IF array_length(errors, 1) > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Some items failed to process',
            'errors', to_jsonb(errors),
            'processed', to_jsonb(results)
        );
    END IF;

    -- All items processed successfully
    RETURN jsonb_build_object(
        'success', true,
        'processed', to_jsonb(results)
    );
END;
$$;
