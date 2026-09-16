-- =============================================
-- Analytics Modal: Total Profit Details
-- Returns total profit and per-product profit breakdown for the modal
-- =============================================

CREATE OR REPLACE FUNCTION analytics_modal_total_profit(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_total DECIMAL(10, 2);
    v_rows JSONB;
BEGIN
    WITH filtered_transactions AS (
        SELECT s.id, s.sale_items
        FROM transactions s
        WHERE s.action_type = 'sale_complete'
          AND NOT EXISTS (
              SELECT 1 FROM transactions v
              WHERE v.action_type = 'sale_void'
                AND v.entity_type = s.entity_type
                AND v.entity_id = s.entity_id
          )
          AND (p_start_date IS NULL OR s.created_at >= p_start_date)
          AND (p_end_date IS NULL OR s.created_at < (p_end_date + INTERVAL '1 day'))
          AND s.sale_items IS NOT NULL
    ),
    expanded_items AS (
        SELECT
            COALESCE(
                item->>'name',
                inv.name,
                'Unknown Product'
            ) AS product_name,
            COALESCE((item->>'qty')::NUMERIC, 0) AS qty,
            COALESCE((item->>'price')::DECIMAL(10, 2), 0) AS price,
            COALESCE((item->>'cost_price')::DECIMAL(10, 2), inv.cost_price, 0) AS cost_price
        FROM filtered_transactions t,
        LATERAL jsonb_array_elements(t.sale_items) AS item
        LEFT JOIN inventory inv ON (
            CASE 
                WHEN (item->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (item->>'id')::UUID 
                ELSE NULL 
            END
        ) = inv.id
    ),
    product_summary AS (
        SELECT
            product_name,
            SUM(qty) AS quantity_sold,
            ROUND(SUM(qty * (price - cost_price)), 2) AS profit
        FROM expanded_items
        GROUP BY product_name
        ORDER BY profit DESC, product_name ASC
    )
    SELECT
        COALESCE(SUM(profit), 0),
        COALESCE(jsonb_agg(jsonb_build_object(
            'product_name', product_name,
            'quantity_sold', quantity_sold,
            'profit', profit
        )), '[]'::jsonb)
    INTO v_total, v_rows
    FROM product_summary;

    RETURN jsonb_build_object(
        'total', COALESCE(v_total, 0),
        'rows', COALESCE(v_rows, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
