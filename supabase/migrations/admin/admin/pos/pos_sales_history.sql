-- POS sales only; online orders have their own Orders history.
CREATE OR REPLACE FUNCTION public.pos_sales_history(
    p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0,
    p_search TEXT DEFAULT NULL, p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSONB;
BEGIN
    IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset < 0 THEN
        RAISE EXCEPTION 'Invalid history pagination';
    END IF;
    WITH matching AS (
        SELECT s.*, v.details AS void_details, v.created_at AS voided_at, v.user_email AS voided_by,
            (v.id IS NOT NULL) AS voided
        FROM public.transactions s
        LEFT JOIN LATERAL (
            SELECT t.* FROM public.transactions t
            WHERE t.action_type = 'sale_void' AND t.entity_type = 'sale'
              AND t.entity_id = s.id
            ORDER BY t.created_at, t.id LIMIT 1
        ) v ON TRUE
        WHERE s.action_type = 'sale_complete' AND s.entity_type = 'sale'
          AND (p_start_date IS NULL OR s.created_at >= p_start_date)
          AND (p_end_date IS NULL OR s.created_at < p_end_date)
          AND (NULLIF(BTRIM(p_search), '') IS NULL OR s.id::TEXT ILIKE '%' || p_search || '%'
            OR s.customer_name ILIKE '%' || p_search || '%' OR s.user_email ILIKE '%' || p_search || '%')
    ), page AS (
        SELECT * FROM matching ORDER BY created_at DESC, id DESC LIMIT p_limit OFFSET p_offset
    ) SELECT jsonb_build_object('sales', COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY created_at DESC, id DESC) FROM page), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM matching)) INTO result;
    RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.pos_sales_history(INTEGER, INTEGER, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_sales_history(INTEGER, INTEGER, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
NOTIFY pgrst, 'reload schema';
