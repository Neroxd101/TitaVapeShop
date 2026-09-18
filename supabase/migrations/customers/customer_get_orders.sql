-- =============================================
-- Customer Get Orders RPC Function
-- Returns recent orders for an authenticated customer
-- =============================================

CREATE OR REPLACE FUNCTION public.customer_get_orders(
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
    items_count NUMERIC
) AS $$
BEGIN
    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Customer account is required';
    END IF;
    IF p_limit < 1 OR p_limit > 50 THEN
        RAISE EXCEPTION 'Limit must be between 1 and 50';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.customers
        WHERE id = p_customer_id AND is_verified IS TRUE
    ) THEN
        RAISE EXCEPTION 'A verified customer account is required';
    END IF;

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
            SELECT SUM((i->>'quantity')::NUMERIC)
            FROM jsonb_array_elements(o.items) AS i
        ), 0::NUMERIC) AS items_count
    FROM public.orders o
    WHERE o.customer_id = p_customer_id
    ORDER BY o.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.customer_get_orders(UUID, INTEGER)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_get_orders(UUID, INTEGER)
TO service_role;
