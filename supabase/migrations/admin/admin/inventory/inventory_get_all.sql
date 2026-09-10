-- =============================================
-- Inventory Get All Function
-- Gets all inventory items with filtering
-- Uses stored total_profit column from inventory table
-- =============================================

CREATE OR REPLACE FUNCTION inventory_get_all(
    filter_category VARCHAR(20) DEFAULT NULL,
    filter_search VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    category VARCHAR(20),
    name VARCHAR(100),
    description TEXT,
    quantity INTEGER,
    cost_price DECIMAL(10, 2),
    sale_price DECIMAL(10, 2),
    qr_image_url TEXT,
    images JSONB,
    total_profit DECIMAL(10, 2),
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
        i.cost_price,
        i.sale_price,
        i.qr_image_url,
        i.images,
        COALESCE(i.total_profit, 0)::DECIMAL(10, 2) as total_profit,
        i.created_at,
        i.updated_at
    FROM inventory i
    WHERE 
        (filter_category IS NULL OR filter_category = 'all' OR i.category = filter_category)
        AND (filter_search IS NULL OR filter_search = '' OR i.name ILIKE '%' || filter_search || '%')
    ORDER BY i.created_at DESC;
END;
$$ LANGUAGE plpgsql;
