-- =============================================
-- Catalog Get Products RPC Function
-- Returns public catalog items for customer store
-- Excludes sensitive cost_price and total_profit columns
-- =============================================

CREATE OR REPLACE FUNCTION catalog_get_products(
    filter_category VARCHAR(20) DEFAULT NULL,
    filter_search VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    category VARCHAR(20),
    name VARCHAR(100),
    description TEXT,
    quantity INTEGER,
    sale_price DECIMAL(10, 2),
    qr_image_url TEXT,
    images JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.category,
        i.name,
        i.description,
        i.quantity,
        i.sale_price,
        i.qr_image_url,
        i.images,
        i.created_at,
        i.updated_at
    FROM public.inventory i
    WHERE 
        (filter_category IS NULL OR filter_category = 'all' OR LOWER(i.category) = LOWER(filter_category))
        AND (filter_search IS NULL OR filter_search = '' OR i.name ILIKE '%' || filter_search || '%' OR i.description ILIKE '%' || filter_search || '%')
    ORDER BY i.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
