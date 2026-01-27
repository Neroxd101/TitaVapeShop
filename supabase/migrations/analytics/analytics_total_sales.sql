-- =============================================
-- Analytics: Total Sales (Transaction Count)
-- Counts the total number of sales transactions
-- =============================================

CREATE OR REPLACE FUNCTION analytics_total_sales(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    total_sales INTEGER;
BEGIN
    -- Count total number of sale transactions
    -- If end_date is provided, include the entire day (up to end of day)
    SELECT COUNT(*)
    INTO total_sales
    FROM transactions t
    WHERE t.action_type = 'sale_complete'
        AND (p_start_date IS NULL OR t.created_at >= p_start_date)
        AND (p_end_date IS NULL OR t.created_at < (p_end_date + INTERVAL '1 day'));

    RETURN total_sales;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
