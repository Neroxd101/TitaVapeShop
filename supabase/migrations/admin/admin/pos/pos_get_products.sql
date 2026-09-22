-- =============================================
-- POS Get Products Function
-- Returns active products specifically for POS (Sales) terminals.
-- Excludes wholesale cost prices and store profit metrics for security.
-- =============================================

CREATE OR REPLACE FUNCTION public.pos_get_products()
RETURNS TABLE (
    id UUID,
    name VARCHAR(100),
    category VARCHAR(20),
    sale_price DECIMAL(10, 2),
    quantity INTEGER,
    images JSONB,
    qr_image_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.name,
        i.category,
        i.sale_price,
        i.quantity,
        i.images,
        i.qr_image_url
    FROM inventory i
    ORDER BY i.name ASC;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Revoke public execution; only service_role backend can call
REVOKE ALL ON FUNCTION public.pos_get_products() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_get_products() TO service_role;
