-- Normal admin order workflow. Completion, inventory deduction, profit update,
-- and audit logging are committed together or rolled back together.
DROP FUNCTION IF EXISTS public.orders_update_status(UUID, VARCHAR, VARCHAR);

CREATE FUNCTION public.orders_update_status(
    p_order_id UUID,
    p_status VARCHAR(50),
    p_user_email VARCHAR(255) DEFAULT NULL
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target public.orders%ROWTYPE;
    item JSONB;
    item_id UUID;
    item_qty INTEGER;
    item_price DECIMAL(10,2);
    item_variation TEXT;
    variation_stock INTEGER;
    inventory_item public.inventory%ROWTYPE;
    logged_items JSONB := '[]'::jsonb;
BEGIN
    IF p_order_id IS NULL THEN
        RAISE EXCEPTION 'Order ID is required';
    END IF;
    IF p_status NOT IN ('confirmed', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid order status: %', p_status;
    END IF;

    SELECT * INTO target
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    IF target.status = p_status THEN
        RETURN NEXT target;
        RETURN;
    END IF;
    IF target.status IN ('completed', 'voided', 'cancelled') THEN
        RAISE EXCEPTION 'A % order cannot change status', target.status;
    END IF;
    IF p_status = 'confirmed' AND target.status <> 'pending' THEN
        RAISE EXCEPTION 'Only pending orders can be confirmed';
    END IF;
    IF p_status = 'completed' AND target.status <> 'confirmed' THEN
        RAISE EXCEPTION 'Only confirmed orders can be completed';
    END IF;
    IF p_status = 'cancelled' AND target.status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION 'Only pending or confirmed orders can be cancelled';
    END IF;

    IF p_status = 'completed' THEN
        IF target.items IS NULL OR jsonb_typeof(target.items) <> 'array' OR jsonb_array_length(target.items) = 0 THEN
            RAISE EXCEPTION 'Order has no valid items';
        END IF;

        FOR item IN
            SELECT value FROM jsonb_array_elements(target.items) ORDER BY value->>'id'
        LOOP
            item_id := (item->>'id')::UUID;
            item_qty := (item->>'quantity')::INTEGER;
            item_price := (item->>'price')::DECIMAL(10,2);
            item_variation := COALESCE(
                NULLIF(BTRIM(item->>'selected_variation'), ''),
                NULLIF(BTRIM(item->>'variation'), '')
            );

            IF item_id IS NULL OR item_qty IS NULL OR item_qty <= 0 OR item_price IS NULL OR item_price <= 0 THEN
                RAISE EXCEPTION 'Order contains invalid item data';
            END IF;

            SELECT * INTO inventory_item
            FROM public.inventory
            WHERE id = item_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Inventory item % was not found', item_id;
            END IF;
            IF inventory_item.quantity < item_qty THEN
                RAISE EXCEPTION 'Not enough stock for %. Available: %', inventory_item.name, inventory_item.quantity;
            END IF;

            IF item_variation IS NOT NULL THEN
                IF inventory_item.variations IS NULL
                    OR jsonb_typeof(inventory_item.variations) <> 'array' THEN
                    RAISE EXCEPTION 'Variation % was not found for %', item_variation, inventory_item.name;
                END IF;

                SELECT (variation->>'quantity')::INTEGER
                INTO variation_stock
                FROM jsonb_array_elements(inventory_item.variations) AS variation
                WHERE variation->>'name' = item_variation
                LIMIT 1;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Variation % was not found for %', item_variation, inventory_item.name;
                END IF;
                IF COALESCE(variation_stock, 0) < item_qty THEN
                    RAISE EXCEPTION 'Not enough stock for % (%). Available: %',
                        inventory_item.name, item_variation, COALESCE(variation_stock, 0);
                END IF;
            END IF;

            UPDATE public.inventory
            SET quantity = quantity - item_qty,
                variations = CASE
                    WHEN item_variation IS NULL THEN variations
                    ELSE (
                        SELECT jsonb_agg(
                            CASE
                                WHEN variation->>'name' = item_variation THEN
                                    jsonb_set(
                                        variation,
                                        '{quantity}',
                                        to_jsonb(((variation->>'quantity')::INTEGER - item_qty)),
                                        true
                                    )
                                ELSE variation
                            END
                            ORDER BY position
                        )
                        FROM jsonb_array_elements(inventory_item.variations)
                            WITH ORDINALITY AS entries(variation, position)
                    )
                END,
                total_profit = COALESCE(total_profit, 0) + (item_price * item_qty),
                updated_at = NOW()
            WHERE id = item_id;

            logged_items := logged_items || jsonb_build_array(jsonb_build_object(
                'id', item_id,
                'name', COALESCE(item->>'name', inventory_item.name),
                'category', COALESCE(NULLIF(BTRIM(item->>'category'), ''), inventory_item.category),
                'qty', item_qty,
                'price', item_price,
                'cost_price', inventory_item.cost_price,
                'selected_variation', item_variation
            ));
        END LOOP;
    END IF;

    PERFORM public.transactions_log(
        p_action_type => CASE
            WHEN p_status = 'confirmed' THEN 'order_confirm'
            WHEN p_status = 'cancelled' THEN 'order_cancel'
            ELSE 'sale_complete'
        END,
        p_user_email => p_user_email,
        p_entity_id => target.id,
        p_entity_type => 'order',
        p_sale_total => target.total_amount,
        p_sale_items => CASE WHEN p_status = 'completed' THEN logged_items ELSE target.items END,
        p_customer_name => target.customer_name,
        p_customer_email => target.customer_email,
        p_details => jsonb_build_object(
            'order_id', target.id,
            'order_type', target.order_type,
            'previous_status', target.status,
            'new_status', p_status,
            'items_count', jsonb_array_length(target.items)
        )
    );

    RETURN QUERY
    UPDATE public.orders
    SET status = p_status,
        updated_at = NOW()
    WHERE id = target.id
    RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.orders_update_status(UUID, VARCHAR, VARCHAR)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_update_status(UUID, VARCHAR, VARCHAR)
TO service_role;
