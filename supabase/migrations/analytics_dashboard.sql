-- =============================================
-- Analytics Dashboard Function
-- Gets aggregated analytics data with product and category stats
-- =============================================

CREATE OR REPLACE FUNCTION analytics_dashboard(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    sales_data JSONB;
    total_revenue DECIMAL(10, 2);
    total_transactions INTEGER;
    daily_revenue JSONB;
    top_products JSONB;
    category_stats JSONB;
    items_sold INTEGER;
    average_sale DECIMAL(10, 2);
    result JSONB;
BEGIN
    -- Get all sales transactions (ordered by date descending)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'sale_total', t.sale_total,
            'sale_items', t.sale_items,
            'customer_name', t.customer_name,
            'customer_email', t.customer_email,
            'created_at', t.created_at
        )
    ), '[]'::jsonb) INTO sales_data
    FROM (
        SELECT 
            sale_total,
            sale_items,
            customer_name,
            customer_email,
            created_at
        FROM transactions
        WHERE action_type = 'sale_complete'
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
        ORDER BY created_at DESC
    ) t;

    -- Calculate totals
    SELECT 
        COALESCE(SUM(t.sale_total), 0),
        COUNT(*)
    INTO total_revenue, total_transactions
    FROM transactions t
    WHERE t.action_type = 'sale_complete'
        AND (p_start_date IS NULL OR t.created_at >= p_start_date)
        AND (p_end_date IS NULL OR t.created_at <= p_end_date);

    -- Calculate daily revenue (grouped by date)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'date', daily_date::text,
            'revenue', daily_total
        ) ORDER BY daily_date
    ), '[]'::jsonb) INTO daily_revenue
    FROM (
        SELECT 
            date_trunc('day', created_at)::date as daily_date,
            SUM(sale_total) as daily_total
        FROM transactions
        WHERE action_type = 'sale_complete'
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
        GROUP BY date_trunc('day', created_at)::date
    ) daily;

    -- Calculate top products and category stats from sale_items JSONB
    -- Aggregate items across all sales, joining with inventory to get category and stock
    WITH item_aggregates AS (
        SELECT 
            (sale_item->>'id')::UUID as item_id,
            sale_item->>'name' as item_name,
            COALESCE(inv.category, sale_item->>'category', 'Uncategorized') as item_category,
            SUM(COALESCE((sale_item->>'qty')::INTEGER, 0)) as units_sold,
            SUM(COALESCE((sale_item->>'qty')::INTEGER, 0) * COALESCE((sale_item->>'price')::DECIMAL(10, 2), 0)) as revenue
        FROM transactions t,
        LATERAL jsonb_array_elements(t.sale_items) as sale_item
        LEFT JOIN inventory inv ON inv.id = (sale_item->>'id')::UUID
        WHERE t.action_type = 'sale_complete'
            AND (p_start_date IS NULL OR t.created_at >= p_start_date)
            AND (p_end_date IS NULL OR t.created_at <= p_end_date)
            AND t.sale_items IS NOT NULL
        GROUP BY (sale_item->>'id')::UUID, sale_item->>'name', COALESCE(inv.category, sale_item->>'category', 'Uncategorized')
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
    SELECT 
        COALESCE(jsonb_agg(
            jsonb_build_object(
                'name', item_name,
                'unitsSold', units_sold,
                'revenue', revenue,
                'category', item_category,
                'stockLeft', stock_left
            )
        ), '[]'::jsonb),
        COALESCE(SUM(units_sold), 0)
    INTO top_products, items_sold
    FROM products_sorted;

    -- Calculate category stats
    WITH item_aggregates AS (
        SELECT 
            COALESCE(inv.category, sale_item->>'category', 'Uncategorized') as item_category,
            SUM(COALESCE((sale_item->>'qty')::INTEGER, 0)) as units_sold,
            SUM(COALESCE((sale_item->>'qty')::INTEGER, 0) * COALESCE((sale_item->>'price')::DECIMAL(10, 2), 0)) as revenue
        FROM transactions t,
        LATERAL jsonb_array_elements(t.sale_items) as sale_item
        LEFT JOIN inventory inv ON inv.id = (sale_item->>'id')::UUID
        WHERE t.action_type = 'sale_complete'
            AND (p_start_date IS NULL OR t.created_at >= p_start_date)
            AND (p_end_date IS NULL OR t.created_at <= p_end_date)
            AND t.sale_items IS NOT NULL
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

    -- Calculate average sale
    IF total_transactions > 0 THEN
        average_sale := total_revenue / total_transactions;
    ELSE
        average_sale := 0;
    END IF;

    -- Build result JSONB
    result := jsonb_build_object(
        'success', true,
        'report', jsonb_build_object(
            'totalRevenue', total_revenue,
            'salesCount', total_transactions,
            'itemsSold', items_sold,
            'averageSale', average_sale,
            'dailyRevenue', daily_revenue,
            'topProducts', top_products,
            'categoryStats', category_stats,
            'rawSales', sales_data
        )
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
