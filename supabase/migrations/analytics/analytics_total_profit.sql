-- =============================================
-- Analytics: Total Profit
-- Calculates the total profit (sale price minus cost price) from all completed sales
-- =============================================

CREATE OR REPLACE FUNCTION analytics_total_profit(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
    total_profit DECIMAL(10, 2);
BEGIN
    -- Calculate total profit from all non-voided sale transactions:
    -- Profit = sum of (selling_price - cost_price) * quantity for each sold item
    -- If end_date is provided, include the entire day (up to end of day)
    WITH filtered_transactions AS (
        SELECT id, sale_items
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
            AND sale_items IS NOT NULL
    )
    SELECT COALESCE(
        SUM(
            COALESCE((sale_item->>'qty')::INTEGER, 0) * (
                COALESCE((sale_item->>'price')::DECIMAL(10, 2), 0) - 
                COALESCE((sale_item->>'cost_price')::DECIMAL(10, 2), inv.cost_price, 0)
            )
        ), 0
    )
    INTO total_profit
    FROM filtered_transactions t,
    LATERAL jsonb_array_elements(t.sale_items) as sale_item
    LEFT JOIN inventory inv ON inv.id = (
        CASE 
            WHEN (sale_item->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            THEN (sale_item->>'id')::UUID 
            ELSE NULL 
        END
    );

    RETURN total_profit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backwards compatibility alias
CREATE OR REPLACE FUNCTION analytics_total_revenue(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS DECIMAL(10, 2) AS $$
BEGIN
    RETURN analytics_total_profit(p_start_date, p_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
