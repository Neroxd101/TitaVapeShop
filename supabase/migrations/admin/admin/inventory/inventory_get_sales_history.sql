-- =============================================
-- Inventory Get Sales History Function
-- Gets non-voided sales transactions for a specific inventory item
-- Returns JSONB with sales array and metadata
-- =============================================

CREATE OR REPLACE FUNCTION inventory_get_sales_history(
    p_item_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    total_count BIGINT;
    sales_data JSONB;
    result JSONB;
BEGIN
    -- Validate required fields
    IF p_item_id IS NULL THEN
        RAISE EXCEPTION 'Item ID is required';
    END IF;

    -- Count total matching sales
    SELECT COUNT(*) INTO total_count
    FROM transactions t,
    LATERAL jsonb_array_elements(t.sale_items) as sale_item
    WHERE t.action_type = 'sale_complete'
        -- Match voids regardless of date so restored items no longer count as sold.
        AND NOT EXISTS (
            SELECT 1 FROM transactions void_tx
            WHERE void_tx.action_type = 'sale_void'
                AND void_tx.entity_type = t.entity_type
                AND void_tx.entity_id = t.entity_id
        )
        AND t.sale_items IS NOT NULL
        AND (sale_item->>'id')::UUID = p_item_id;

    -- Get paginated sales transactions
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'transaction_id', t.id,
            'sale_date', t.created_at,
            'quantity_sold', (t.sale_item->>'qty')::INTEGER,
            'sale_price', (t.sale_item->>'price')::DECIMAL(10, 2),
            'cost_price', t.cost_price,
            'subtotal', ((t.sale_item->>'qty')::INTEGER * (t.sale_item->>'price')::DECIMAL(10, 2)),
            'sale_total', t.sale_total,
            'customer_name', t.customer_name,
            'customer_email', t.customer_email,
            'user_email', t.user_email
        ) ORDER BY t.created_at DESC
    ), '[]'::jsonb) INTO sales_data
    FROM (
        SELECT 
            t.id,
            t.created_at,
            t.sale_total,
            t.customer_name,
            t.customer_email,
            t.user_email,
            sale_item,
            COALESCE(inv.cost_price, 0) as cost_price
        FROM transactions t,
        LATERAL jsonb_array_elements(t.sale_items) as sale_item
        LEFT JOIN inventory inv ON inv.id = (sale_item->>'id')::UUID
        WHERE t.action_type = 'sale_complete'
            AND NOT EXISTS (
                SELECT 1 FROM transactions void_tx
                WHERE void_tx.action_type = 'sale_void'
                    AND void_tx.entity_type = t.entity_type
                    AND void_tx.entity_id = t.entity_id
            )
            AND t.sale_items IS NOT NULL
            AND (sale_item->>'id')::UUID = p_item_id
        ORDER BY t.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) t;

    -- Build result JSONB
    result := jsonb_build_object(
        'success', true,
        'sales', sales_data,
        'total', total_count,
        'limit', p_limit,
        'offset', p_offset
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
