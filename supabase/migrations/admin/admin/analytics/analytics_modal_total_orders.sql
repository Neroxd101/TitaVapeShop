-- =============================================
-- Analytics Modal: Total Orders Details
-- Returns total orders count and order details breakdown for the modal
-- =============================================

CREATE OR REPLACE FUNCTION public.analytics_modal_total_orders(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_total BIGINT;
    v_rows JSONB;
BEGIN
    WITH filtered_transactions AS (
        SELECT 
            s.id,
            COALESCE(s.entity_id::text, s.id::text) AS order_id,
            s.created_at,
            COALESCE(s.customer_name, 'Customer not recorded') AS customer,
            CASE WHEN s.entity_type = 'order' THEN 'Customer order' ELSE 'POS sale' END AS source,
            COALESCE(s.sale_total, 0) AS total_amount,
            s.sale_items
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
    ),
    order_items AS (
        SELECT 
            t.id,
            string_agg(
                concat(
                    COALESCE(item->>'name', inv.name, 'Unknown Product'),
                    ' × ',
                    COALESCE(item->>'qty', '1')
                ),
                ', '
            ) AS items_summary
        FROM filtered_transactions t
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(t.sale_items) = 'array' THEN t.sale_items 
                ELSE '[]'::jsonb 
            END
        ) AS item
        LEFT JOIN inventory inv ON (
            CASE 
                WHEN (item->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (item->>'id')::UUID 
                ELSE NULL 
            END
        ) = inv.id
        GROUP BY t.id
    ),
    order_list AS (
        SELECT
            t.order_id,
            t.created_at,
            t.customer,
            t.source,
            COALESCE(oi.items_summary, 'No item details recorded') AS items_summary,
            t.total_amount
        FROM filtered_transactions t
        LEFT JOIN order_items oi ON oi.id = t.id
        ORDER BY t.created_at DESC, t.order_id DESC
    )
    SELECT
        COUNT(*),
        COALESCE(jsonb_agg(jsonb_build_object(
            'order_id', order_id,
            'date', created_at,
            'customer', customer,
            'source', source,
            'items_summary', items_summary,
            'total_amount', total_amount
        )), '[]'::jsonb)
    INTO v_total, v_rows
    FROM order_list;

    RETURN jsonb_build_object(
        'total', COALESCE(v_total, 0),
        'rows', COALESCE(v_rows, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.analytics_modal_total_orders(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_modal_total_orders(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
