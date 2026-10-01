-- Apply after orders_update_status.sql and sales/sales_process.sql.
-- All stock restoration, revenue reversal and audit logging commit together.
CREATE OR REPLACE FUNCTION public.orders_void(
    p_order_id UUID,
    p_reason TEXT,
    p_user_email VARCHAR(255) DEFAULT NULL
)
RETURNS SETOF public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    target public.orders%ROWTYPE;
    item JSONB;
    item_id UUID;
    qty INTEGER;
    price NUMERIC;
    item_variation TEXT;
    inventory_item public.inventory%ROWTYPE;
    logged_items JSONB := '[]'::jsonb;
    original_sale_items JSONB;
    original_item JSONB;
    can_restock BOOLEAN;
    skip_reason TEXT;
    restored_items JSONB := '[]'::jsonb;
    skipped_items JSONB := '[]'::jsonb;
BEGIN
    -- Coordinate with inventory deletion before reading or locking any rows.
    PERFORM pg_advisory_xact_lock_shared(746482, 1);
    IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000 THEN
        RAISE EXCEPTION 'A void reason of 1–1000 characters is required';
    END IF;
    SELECT * INTO target FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    IF target.status IS DISTINCT FROM 'completed' THEN
        RAISE EXCEPTION 'Only completed orders can be voided';
    END IF;
    -- Preserve the cost/name/category snapshot even when inventory is gone or
    -- its price has changed since the sale. Older orders can use their items.
    SELECT sale_items INTO original_sale_items
    FROM public.transactions
    WHERE entity_id = target.id AND entity_type = 'order' AND action_type = 'sale_complete'
    ORDER BY created_at DESC, id DESC LIMIT 1;
    FOR item IN SELECT value FROM jsonb_array_elements(target.items)
        WHERE value->>'unavailable' IS DISTINCT FROM 'true' ORDER BY value->>'id'
    LOOP
        item_id := (item->>'id')::UUID;
        qty := (item->>'quantity')::INTEGER;
        price := (item->>'price')::NUMERIC;
        item_variation := COALESCE(
            NULLIF(BTRIM(item->>'selected_variation'), ''),
            NULLIF(BTRIM(item->>'variation'), '')
        );
        IF item_id IS NULL OR qty IS NULL OR qty <= 0 OR price IS NULL OR price <= 0 THEN
            RAISE EXCEPTION 'Invalid original item data; cannot safely reverse this order';
        END IF;

        SELECT * INTO inventory_item
        FROM public.inventory
        WHERE id = item_id
        FOR UPDATE;

        can_restock := FOUND;
        skip_reason := CASE WHEN can_restock THEN NULL ELSE 'Product deleted by the store' END;
        IF can_restock AND item_variation IS NOT NULL AND NOT EXISTS (
                SELECT 1
                FROM jsonb_array_elements(COALESCE(inventory_item.variations, '[]'::jsonb)) AS variation
                WHERE variation->>'name' = item_variation
        ) THEN
            can_restock := FALSE;
            skip_reason := 'Variation deleted by the store';
        END IF;

        -- Revenue is reversed for every surviving inventory row, including a
        -- row whose sold variation was deleted. Stock only returns to a valid
        -- destination; no deleted product or variation is recreated.
        UPDATE public.inventory
        SET quantity = quantity + CASE WHEN can_restock THEN qty ELSE 0 END,
            variations = CASE
                WHEN NOT can_restock OR item_variation IS NULL THEN variations
                ELSE (
                    SELECT jsonb_agg(
                        CASE
                            WHEN variation->>'name' = item_variation THEN
                                jsonb_set(
                                    variation,
                                    '{quantity}',
                                    to_jsonb((COALESCE((variation->>'quantity')::INTEGER, 0) + qty)),
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
            total_profit = COALESCE(total_profit, 0) - price * qty,
            updated_at = NOW()
        WHERE id = item_id;
        SELECT sale_item INTO original_item
        FROM jsonb_array_elements(COALESCE(original_sale_items, '[]'::jsonb)) sale_item
        WHERE sale_item->>'id' = item_id::TEXT
            AND COALESCE(NULLIF(BTRIM(sale_item->>'selected_variation'), ''), NULLIF(BTRIM(sale_item->>'variation'), ''))
                IS NOT DISTINCT FROM item_variation
        LIMIT 1;
        logged_items := logged_items || jsonb_build_array(jsonb_build_object(
            'id', item_id,
            'name', COALESCE(original_item->>'name', item->>'name', inventory_item.name),
            'category', COALESCE(NULLIF(BTRIM(original_item->>'category'), ''), NULLIF(BTRIM(item->>'category'), ''), inventory_item.category),
            'qty', qty,
            'price', price,
            'cost_price', COALESCE((original_item->>'cost_price')::NUMERIC, (item->>'cost_price')::NUMERIC, inventory_item.cost_price),
            'selected_variation', item_variation,
            'stock_restored', can_restock,
            'restock_skipped_reason', skip_reason
        ));
        IF can_restock THEN
            restored_items := restored_items || jsonb_build_array(logged_items->(jsonb_array_length(logged_items) - 1));
        ELSE
            skipped_items := skipped_items || jsonb_build_array(logged_items->(jsonb_array_length(logged_items) - 1));
        END IF;
    END LOOP;
    PERFORM public.transactions_log(
        p_action_type => 'sale_void', p_user_email => p_user_email,
        p_entity_id => p_order_id, p_entity_type => 'order',
        p_sale_total => -target.total_amount, p_sale_items => logged_items,
        p_customer_name => target.customer_name, p_customer_email => target.customer_email,
        p_details => jsonb_build_object('order_id', p_order_id, 'reason', btrim(p_reason),
            'previous_status', target.status,
            'stock_restored', jsonb_array_length(skipped_items) = 0,
            'restocked_items', restored_items, 'restock_skipped_items', skipped_items)
    );
    RETURN QUERY UPDATE public.orders SET status = 'voided', updated_at = NOW()
        WHERE id = p_order_id RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION public.orders_void(UUID, TEXT, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_void(UUID, TEXT, VARCHAR) TO service_role;
