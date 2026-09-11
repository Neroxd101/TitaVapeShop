-- =============================================
-- Get All Orders Function
-- Retrieves all orders with optional filtering (status, search, dates)
-- 1-to-1 matching RPC for GET /api/orders/get_all
-- =============================================

-- Drop obsolete 4-parameter overload if it exists to avoid PostgREST ambiguity error
DROP FUNCTION IF EXISTS orders_get_all(VARCHAR(50), INTEGER, INTEGER, VARCHAR(255));

CREATE OR REPLACE FUNCTION orders_get_all(
    p_status VARCHAR(50) DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_search VARCHAR(255) DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    customer_name VARCHAR(255),
    contact_number VARCHAR(20),
    customer_email VARCHAR(255),
    order_type VARCHAR(20),
    items JSONB,
    total_amount DECIMAL(10, 2),
    status VARCHAR(50),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    total_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH filtered_orders AS (
        SELECT 
            o.id,
            o.customer_name,
            o.contact_number,
            o.customer_email,
            o.order_type,
            o.items,
            o.total_amount,
            o.status,
            o.created_at,
            o.updated_at,
            COUNT(*) OVER() as total_count
        FROM orders o
        WHERE (p_status IS NULL OR o.status = p_status)
          AND (p_start_date IS NULL OR o.created_at >= p_start_date)
          AND (p_end_date IS NULL OR o.created_at <= p_end_date)
          AND (
              p_search IS NULL 
              OR o.id::text ILIKE '%' || TRIM(LEADING '#' FROM p_search) || '%'
              OR o.customer_name ILIKE '%' || p_search || '%'
              OR o.contact_number ILIKE '%' || p_search || '%'
              OR o.customer_email ILIKE '%' || p_search || '%'
              OR o.items::text ILIKE '%' || p_search || '%'
          )
        ORDER BY o.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    )
    SELECT 
        fo.id,
        fo.customer_name,
        fo.contact_number,
        fo.customer_email,
        COALESCE(fo.order_type, 'pickup') as order_type,
        fo.items,
        fo.total_amount,
        fo.status,
        fo.created_at,
        fo.updated_at,
        fo.total_count
    FROM filtered_orders fo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
