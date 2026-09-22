-- =============================================
-- Inventory Summaries Function
-- Computes KPI counts and summary statistics for inventory:
-- total_products_inventory: count of distinct items
-- total_quantity_inventory: sum of all item quantities
-- total_low_stock_inventory: count of items with 1 <= quantity <= 5
-- total_out_of_stock_inventory: count of items with quantity = 0
-- =============================================

CREATE OR REPLACE FUNCTION public.inventory_summaries()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_products_inventory',     COALESCE(COUNT(*), 0),
        'total_quantity_inventory',     COALESCE(SUM(quantity), 0),
        'total_low_stock_inventory',    COALESCE(COUNT(*) FILTER (WHERE quantity > 0 AND quantity <= 5), 0),
        'total_out_of_stock_inventory', COALESCE(COUNT(*) FILTER (WHERE quantity = 0), 0)
    )
    INTO result
    FROM inventory;

    RETURN result;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Revoke public access; only service_role (backend) can execute
REVOKE ALL ON FUNCTION public.inventory_summaries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_summaries() TO service_role;
