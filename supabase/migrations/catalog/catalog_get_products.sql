-- =============================================
-- Catalog Get Products RPC Function
-- Returns public catalog items for customer store
-- Excludes sensitive cost_price and total_profit columns
-- =============================================

DROP FUNCTION IF EXISTS public.catalog_get_products(VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION public.catalog_get_products(
    filter_category VARCHAR(20) DEFAULT NULL,
    filter_search VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    category VARCHAR(20),
    name VARCHAR(100),
    variations JSONB,
    description TEXT,
    quantity INTEGER,
    sale_price DECIMAL(10, 2),
    qr_image_url TEXT,
    images JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    IF filter_category IS NOT NULL
       AND filter_category <> ''
       AND NOT EXISTS (
           SELECT 1 FROM public.inventory_categories AS c
           WHERE c.slug = LOWER(TRIM(filter_category)) AND c.is_active
       ) THEN
        RAISE EXCEPTION 'Invalid catalog category';
    END IF;

    IF filter_search IS NOT NULL AND LENGTH(filter_search) > 100 THEN
        RAISE EXCEPTION 'Catalog search is too long';
    END IF;

    RETURN QUERY
    SELECT 
        i.id,
        i.category,
        i.name,
        i.variations,
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
        AND (filter_search IS NULL OR filter_search = '' OR i.name ILIKE '%' || filter_search || '%')
    ORDER BY i.created_at DESC;
END;
$$ LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public;

-- The catalog is intentionally public, but callers may only execute this
-- restricted function. They cannot select the private inventory columns.
REVOKE ALL ON FUNCTION public.catalog_get_products(VARCHAR, VARCHAR)
FROM PUBLIC, authenticated;

GRANT EXECUTE ON FUNCTION public.catalog_get_products(VARCHAR, VARCHAR)
TO anon, service_role;

-- Defense in depth: direct table reads would expose cost and profit fields.
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.inventory FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.inventory TO service_role;
