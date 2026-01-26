-- =============================================
-- Transactions Get Stats Function
-- Gets transaction statistics
-- =============================================

CREATE OR REPLACE FUNCTION transactions_get_stats(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_transactions', COUNT(*),
        'inventory_adds', COUNT(*) FILTER (WHERE action_type = 'inventory_add'),
        'inventory_edits', COUNT(*) FILTER (WHERE action_type = 'inventory_edit'),
        'inventory_deletes', COUNT(*) FILTER (WHERE action_type = 'inventory_delete'),
        'sales_completed', COUNT(*) FILTER (WHERE action_type = 'sale_complete'),
        'sales_voided', COUNT(*) FILTER (WHERE action_type = 'sale_void'),
        'total_sales_amount', COALESCE(SUM(sale_total) FILTER (WHERE action_type = 'sale_complete'), 0)
    ) INTO stats
    FROM transactions
    WHERE
        (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date);

    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
