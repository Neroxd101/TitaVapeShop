-- =============================================
-- Analytics: Revenue Trend
-- Gets daily revenue grouped by date for trend analysis
-- =============================================

CREATE OR REPLACE FUNCTION analytics_revenue_trend(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    daily_revenue JSONB;
BEGIN
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
            AND (p_end_date IS NULL OR created_at < (p_end_date + INTERVAL '1 day'))
        GROUP BY date_trunc('day', created_at)::date
    ) daily;

    RETURN daily_revenue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
