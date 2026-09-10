-- =============================================
-- Analytics: Gross Sales
-- Calculates the total gross sales amount from all sales transactions
-- =============================================

CREATE OR REPLACE FUNCTION analytics_gross_sales(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
    total_gross DECIMAL(10, 2);
BEGIN
    -- Calculate total gross sales amount from all non-voided sale transactions
    -- If end_date is provided, include the entire day (up to end of day)
    SELECT COALESCE(SUM(t.sale_total), 0)
    INTO total_gross
    FROM transactions t
    WHERE t.action_type = 'sale_complete'
        -- Voids remove the original sale even when voided outside the selected dates.
        AND NOT EXISTS (
            SELECT 1 FROM transactions void_tx
            WHERE void_tx.action_type = 'sale_void'
                AND void_tx.entity_type = t.entity_type
                AND void_tx.entity_id = t.entity_id
        )
        AND (p_start_date IS NULL OR t.created_at >= p_start_date)
        AND (p_end_date IS NULL OR t.created_at < (p_end_date + INTERVAL '1 day'));

    RETURN total_gross;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backwards compatibility alias for analytics_avg_basket if needed
CREATE OR REPLACE FUNCTION analytics_avg_basket(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS DECIMAL(10, 2) AS $$
BEGIN
    RETURN analytics_gross_sales(p_start_date, p_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
