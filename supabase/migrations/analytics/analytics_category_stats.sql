-- =============================================
-- Analytics: Category Statistics
-- Gets revenue and units sold statistics by category
-- =============================================

CREATE OR REPLACE FUNCTION analytics_category_stats(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    category_stats JSONB;
BEGIN
    -- Calculate category stats
    -- If end_date is provided, include the entire day (up to end of day)
    WITH filtered_transactions_cat AS (
        SELECT id, sale_items
        FROM transactions
        WHERE action_type = 'sale_complete'
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at < (p_end_date + INTERVAL '1 day'))
            AND sale_items IS NOT NULL
    ),
    item_aggregates AS (
        SELECT 
            COALESCE(inv.category, sale_item->>'category', 'Uncategorized') as item_category,
            SUM(COALESCE((sale_item->>'qty')::INTEGER, 0)) as units_sold,
            SUM(COALESCE((sale_item->>'qty')::INTEGER, 0) * COALESCE((sale_item->>'price')::DECIMAL(10, 2), 0)) as revenue
        FROM filtered_transactions_cat t,
        LATERAL jsonb_array_elements(t.sale_items) as sale_item
        LEFT JOIN inventory inv ON inv.id = (sale_item->>'id')::UUID
        WHERE (sale_item->>'id')::UUID IS NOT NULL
        GROUP BY COALESCE(inv.category, sale_item->>'category', 'Uncategorized')
    )
    SELECT COALESCE(jsonb_object_agg(
        COALESCE(item_category, 'Uncategorized'),
        jsonb_build_object(
            'name', COALESCE(item_category, 'Uncategorized'),
            'unitsSold', units_sold,
            'revenue', revenue
        )
    ), '{}'::jsonb) INTO category_stats
    FROM item_aggregates;

    RETURN category_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
