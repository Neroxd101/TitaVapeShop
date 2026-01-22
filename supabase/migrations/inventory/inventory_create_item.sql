-- =============================================
-- Inventory Create Item Function
-- Creates a new inventory item via RPC
-- =============================================

CREATE OR REPLACE FUNCTION inventory_create_item(
    p_category VARCHAR(20),
    p_name VARCHAR(100),
    p_description TEXT DEFAULT NULL,
    p_quantity INTEGER DEFAULT 0,
    p_cost_price DECIMAL(10, 2) DEFAULT 0,
    p_sale_price DECIMAL(10, 2) DEFAULT 0,
    p_qr_image_url TEXT DEFAULT NULL,
    p_images JSONB DEFAULT '[]'::jsonb
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
DECLARE
    new_item RECORD;
    initial_profit DECIMAL(10, 2);
BEGIN
    -- Validate required fields
    IF p_category IS NULL OR p_name IS NULL OR p_name = '' THEN
        RAISE EXCEPTION 'Category and name are required';
    END IF;

    -- Validate category
    IF p_category NOT IN ('hardware', 'juices') THEN
        RAISE EXCEPTION 'Category must be either "hardware" or "juices"';
    END IF;

    -- Check if product name already exists (case-insensitive)
    IF EXISTS (
        SELECT 1 FROM inventory inv
        WHERE LOWER(TRIM(inv.name)) = LOWER(TRIM(p_name))
    ) THEN
        RAISE EXCEPTION 'Product name already exists';
    END IF;

    -- Calculate initial profit (negative, representing cost of unsold inventory)
    initial_profit := -(COALESCE(p_cost_price, 0) * COALESCE(p_quantity, 0));

    -- Insert new inventory item
    INSERT INTO inventory (
        category,
        name,
        description,
        quantity,
        cost_price,
        sale_price,
        qr_image_url,
        images,
        total_profit
    ) VALUES (
        p_category,
        p_name,
        p_description,
        COALESCE(p_quantity, 0),
        COALESCE(p_cost_price, 0),
        COALESCE(p_sale_price, 0),
        p_qr_image_url,
        COALESCE(p_images, '[]'::jsonb),
        initial_profit
    )
    RETURNING * INTO new_item;

    -- Return the created item
    RETURN QUERY SELECT 
        new_item.id,
        new_item.category,
        new_item.name,
        new_item.description,
        new_item.quantity,
        new_item.cost_price,
        new_item.sale_price,
        new_item.qr_image_url,
        new_item.images,
        new_item.total_profit,
        new_item.created_at,
        new_item.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
