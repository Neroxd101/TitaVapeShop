-- =============================================
-- Analytics: Sales Trend
-- Gets daily gross sales and daily profit grouped by date for trend analysis
-- =============================================

CREATE OR REPLACE FUNCTION analytics_revenue_trend(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    daily_revenue JSONB;
BEGIN
    -- Calculate daily gross sales and profit (grouped by date)
    WITH filtered_transactions AS (
        SELECT id, created_at, sale_total, sale_items
        FROM transactions sale_tx
        WHERE sale_tx.action_type = 'sale_complete'
        -- Voids remove the original sale even when voided outside the selected dates.
        AND NOT EXISTS (
            SELECT 1 FROM transactions void_tx
            WHERE void_tx.action_type = 'sale_void'
                AND void_tx.entity_type = sale_tx.entity_type
                AND void_tx.entity_id = sale_tx.entity_id
        )
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at < (p_end_date + INTERVAL '1 day'))
    ),
    daily_sales AS (
        SELECT 
            date_trunc('day', created_at)::date as daily_date,
            SUM(COALESCE(sale_total, 0)) as daily_gross
        FROM filtered_transactions
        GROUP BY date_trunc('day', created_at)::date
    ),
    daily_profit AS (
        SELECT 
            date_trunc('day', t.created_at)::date as daily_date,
            COALESCE(SUM(
                COALESCE((sale_item->>'qty')::INTEGER, 0) * (
                    COALESCE((sale_item->>'price')::DECIMAL(10, 2), 0) - 
                    COALESCE((sale_item->>'cost_price')::DECIMAL(10, 2), inv.cost_price, 0)
                )
            ), 0) as daily_profit_total
        FROM filtered_transactions t,
        LATERAL jsonb_array_elements(t.sale_items) as sale_item
        LEFT JOIN inventory inv ON inv.id = (
            CASE 
                WHEN (sale_item->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
                THEN (sale_item->>'id')::UUID 
                ELSE NULL 
            END
        )
        WHERE t.sale_items IS NOT NULL
        GROUP BY date_trunc('day', t.created_at)::date
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'date', ds.daily_date::text,
            'grossSales', ds.daily_gross,
            'profit', COALESCE(dp.daily_profit_total, 0),
            'revenue', ds.daily_gross
        ) ORDER BY ds.daily_date
    ), '[]'::jsonb) INTO daily_revenue
    FROM daily_sales ds
    LEFT JOIN daily_profit dp ON dp.daily_date = ds.daily_date;

    RETURN daily_revenue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
