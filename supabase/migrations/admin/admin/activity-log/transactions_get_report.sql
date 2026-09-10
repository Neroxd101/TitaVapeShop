-- =============================================
-- Transactions Get Report Function
-- Gets detailed sales report with analytics
-- =============================================

CREATE OR REPLACE FUNCTION transactions_get_report(
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
    -- Get all sales transactions
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'sale_total', t.sale_total,
            'sale_items', t.sale_items,
            'customer_name', t.customer_name,
            'customer_email', t.customer_email,
            'created_at', t.created_at
        ) ORDER BY t.created_at DESC
    ), '[]'::jsonb) INTO sales_data
    FROM transactions t
    WHERE t.action_type = 'sale_complete'
        AND (p_start_date IS NULL OR t.created_at >= p_start_date)
        AND (p_end_date IS NULL OR t.created_at <= p_end_date)
    ORDER BY t.created_at DESC;

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
            'date', date_trunc('day', created_at)::date::text,
            'revenue', daily_total
        ) ORDER BY date_trunc('day', created_at)::date
    ), '[]'::jsonb) INTO daily_revenue
    FROM (
        SELECT 
            created_at,
            SUM(sale_total) as daily_total
        FROM transactions
        WHERE action_type = 'sale_complete'
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
        GROUP BY date_trunc('day', created_at)
    ) daily;

    -- Calculate top products and category stats
    -- This requires processing sale_items JSONB, which is complex in SQL
    -- For now, return empty arrays - this can be enhanced later if needed
    top_products := '[]'::jsonb;
    category_stats := '{}'::jsonb;
    items_sold := 0;

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
