-- =============================================
-- Analytics: Items Sold
-- Calculates the total number of items sold across all sales
-- =============================================

CREATE OR REPLACE FUNCTION analytics_items_sold(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    items_sold INTEGER;
BEGIN
    -- Calculate total items sold by summing quantities from sale_items JSONB
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
    SELECT COALESCE(SUM(COALESCE((sale_item->>'qty')::INTEGER, 0)), 0)
    INTO items_sold
    FROM filtered_transactions t,
    LATERAL jsonb_array_elements(t.sale_items) as sale_item;

    RETURN items_sold;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
