-- =============================================
-- Analytics Modal: Gross Sales Details
-- Returns total gross sales and order sales breakdown for the modal
-- =============================================

CREATE OR REPLACE FUNCTION public.analytics_modal_gross_sales(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_total DECIMAL(10, 2);
    v_rows JSONB;
BEGIN
    WITH filtered_transactions AS (
        SELECT 
            s.id,
            COALESCE(s.entity_id::text, s.id::text) AS order_id,
            s.created_at,
            COALESCE(s.customer_name, 'Customer not recorded') AS customer,
            COALESCE(s.sale_total, 0) AS total_amount
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
    order_list AS (
        SELECT
            order_id,
            created_at,
            customer,
            total_amount
        FROM filtered_transactions
        ORDER BY created_at DESC, order_id DESC
    )
    SELECT
        COALESCE(SUM(total_amount), 0),
        COALESCE(jsonb_agg(jsonb_build_object(
            'order_id', order_id,
            'date', created_at,
            'customer', customer,
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
REVOKE ALL ON FUNCTION public.analytics_modal_gross_sales(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_modal_gross_sales(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
