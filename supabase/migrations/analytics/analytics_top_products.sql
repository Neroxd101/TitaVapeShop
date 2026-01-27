-- =============================================
-- Analytics: Top Products
-- Gets top selling products with revenue, units sold, and stock info
-- =============================================

CREATE OR REPLACE FUNCTION analytics_top_products(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    top_products JSONB;
BEGIN
    -- Calculate top products and category stats from sale_items JSONB
    -- Aggregate items across all sales, joining with inventory to get category and stock
    -- If end_date is provided, include the entire day (up to end of day)
    WITH filtered_transactions AS (
        SELECT id, sale_items
        FROM transactions
        WHERE action_type = 'sale_complete'
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at < (p_end_date + INTERVAL '1 day'))
            AND sale_items IS NOT NULL
    ),
    item_aggregates AS (
        SELECT 
            (sale_item->>'id')::UUID as item_id,
            COALESCE(sale_item->>'name', inv.name, 'Unknown Product') as item_name,
            COALESCE(inv.category, sale_item->>'category', 'Uncategorized') as item_category,
            SUM(COALESCE((sale_item->>'qty')::INTEGER, 0)) as units_sold,
            SUM(COALESCE((sale_item->>'qty')::INTEGER, 0) * COALESCE((sale_item->>'price')::DECIMAL(10, 2), 0)) as revenue
        FROM filtered_transactions t,
        LATERAL jsonb_array_elements(t.sale_items) as sale_item
        LEFT JOIN inventory inv ON inv.id = (sale_item->>'id')::UUID
        GROUP BY (sale_item->>'id')::UUID, COALESCE(sale_item->>'name', inv.name, 'Unknown Product'), COALESCE(inv.category, sale_item->>'category', 'Uncategorized')
    ),
    products_with_stock AS (
        SELECT 
            ia.item_id,
            ia.item_name,
            ia.item_category,
            ia.units_sold,
            ia.revenue,
            COALESCE(inv.quantity, 0) as stock_left
        FROM item_aggregates ia
        LEFT JOIN inventory inv ON inv.id = ia.item_id
    ),
    products_sorted AS (
        SELECT 
            item_name,
            units_sold,
            revenue,
            item_category,
            stock_left
        FROM products_with_stock
        ORDER BY revenue DESC
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'name', item_name,
            'unitsSold', units_sold,
            'revenue', revenue,
            'category', item_category,
            'stockLeft', stock_left
        )
    ), '[]'::jsonb) INTO top_products
    FROM products_sorted;

    RETURN top_products;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
