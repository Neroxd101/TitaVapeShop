-- =============================================
-- Analytics: Total Orders (Order Transactions Count)
-- Counts the total number of completed order/sale transactions
-- =============================================

CREATE OR REPLACE FUNCTION analytics_total_orders(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    total_orders INTEGER;
BEGIN
    -- Count total number of completed order/sale transactions
    -- If end_date is provided, include the entire day (up to end of day)
    SELECT COUNT(*)
    INTO total_orders
    FROM transactions t
    WHERE t.action_type = 'sale_complete'
        -- Voids remove the original sale/order even when voided outside the selected dates.
        AND NOT EXISTS (
            SELECT 1 FROM transactions void_tx
            WHERE void_tx.action_type = 'sale_void'
                AND void_tx.entity_type = t.entity_type
                AND void_tx.entity_id = t.entity_id
        )
        AND (p_start_date IS NULL OR t.created_at >= p_start_date)
        AND (p_end_date IS NULL OR t.created_at < (p_end_date + INTERVAL '1 day'));

    RETURN total_orders;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backwards compatibility alias
CREATE OR REPLACE FUNCTION analytics_total_sales(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER AS $$
BEGIN
    RETURN analytics_total_orders(p_start_date, p_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
