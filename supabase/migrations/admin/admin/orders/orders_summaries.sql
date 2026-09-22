-- =============================================
-- Orders Summaries Function
-- Computes real-time KPI counts for the Orders management page:
-- total_pending_orders: count of orders with status = 'pending'
-- total_ready_orders: count of orders with status = 'confirmed' (ready for pickup/delivery)
-- total_pickup_orders: count of orders with order_type != 'delivery' (or = 'pickup')
-- total_delivery_orders: count of orders with order_type = 'delivery'
-- =============================================

CREATE OR REPLACE FUNCTION public.orders_summaries()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_pending_orders',   COALESCE(COUNT(*) FILTER (WHERE LOWER(TRIM(status)) = 'pending'), 0),
        'total_ready_orders',     COALESCE(COUNT(*) FILTER (WHERE LOWER(TRIM(status)) = 'confirmed'), 0),
        'total_pickup_orders',    COALESCE(COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(order_type, 'pickup'))) != 'delivery'), 0),
        'total_delivery_orders',  COALESCE(COUNT(*) FILTER (WHERE LOWER(TRIM(order_type)) = 'delivery'), 0)
    )
    INTO result
    FROM orders;

    RETURN result;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Revoke public execution; only service_role backend can call
REVOKE ALL ON FUNCTION public.orders_summaries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_summaries() TO service_role;
