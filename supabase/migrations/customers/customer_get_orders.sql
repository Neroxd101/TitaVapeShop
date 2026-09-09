-- =============================================
-- Customer Get Orders RPC Function
-- Returns recent orders for an authenticated customer
-- =============================================

CREATE OR REPLACE FUNCTION customer_get_orders(
    p_customer_id UUID,
    p_limit INT DEFAULT 25
)
RETURNS TABLE (
    id UUID,
    customer_id UUID,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    order_type VARCHAR(20),
    total_amount DECIMAL(10, 2),
    status VARCHAR(50),
    created_at TIMESTAMPTZ,
    items JSONB,
    items_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id,
        o.customer_id,
        o.customer_name,
        o.customer_email,
        o.order_type,
        o.total_amount,
        o.status,
        o.created_at,
        o.items,
        COALESCE((
            SELECT SUM((i->>'quantity')::BIGINT)
            FROM jsonb_array_elements(o.items) AS i
        ), 0::BIGINT) AS items_count
    FROM public.orders o
    WHERE o.customer_id = p_customer_id
    ORDER BY o.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
