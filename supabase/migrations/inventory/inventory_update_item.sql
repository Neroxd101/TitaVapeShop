-- =============================================
-- Inventory Update Item Function
-- Updates an inventory item via RPC
-- =============================================

CREATE OR REPLACE FUNCTION inventory_update_item(
    p_id UUID,
    p_category VARCHAR(20) DEFAULT NULL,
    p_name VARCHAR(100) DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_quantity INTEGER DEFAULT NULL,
    p_cost_price DECIMAL(10, 2) DEFAULT NULL,
    p_sale_price DECIMAL(10, 2) DEFAULT NULL,
    p_qr_image_url TEXT DEFAULT NULL,
    p_images JSONB DEFAULT NULL
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
    -- Validate required fields
    IF p_id IS NULL THEN
        RAISE EXCEPTION 'Item ID is required';
    END IF;

    -- Validate category if provided
    IF p_category IS NOT NULL AND p_category NOT IN ('hardware', 'juices') THEN
        RAISE EXCEPTION 'Category must be either "hardware" or "juices"';
    END IF;

    -- Check if item exists
    IF NOT EXISTS (SELECT 1 FROM inventory WHERE inventory.id = p_id) THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    -- Update the inventory item (only update fields that are provided)
    UPDATE inventory
    SET 
        category = CASE WHEN p_category IS NOT NULL THEN p_category ELSE inventory.category END,
        name = CASE WHEN p_name IS NOT NULL THEN p_name ELSE inventory.name END,
        description = CASE WHEN p_description IS NOT NULL THEN p_description ELSE inventory.description END,
        quantity = CASE WHEN p_quantity IS NOT NULL THEN p_quantity ELSE inventory.quantity END,
        cost_price = CASE WHEN p_cost_price IS NOT NULL THEN p_cost_price ELSE inventory.cost_price END,
        sale_price = CASE WHEN p_sale_price IS NOT NULL THEN p_sale_price ELSE inventory.sale_price END,
        qr_image_url = CASE WHEN p_qr_image_url IS NOT NULL THEN p_qr_image_url ELSE inventory.qr_image_url END,
        images = CASE WHEN p_images IS NOT NULL THEN p_images ELSE inventory.images END,
        updated_at = NOW()
    WHERE inventory.id = p_id;

    -- Return the updated item directly using RETURN QUERY
    RETURN QUERY
    SELECT 
        inv.id,
        inv.category,
        inv.name,
        inv.description,
        inv.quantity,
        inv.cost_price,
        inv.sale_price,
        inv.qr_image_url,
        inv.images,
        inv.total_profit,
        inv.created_at,
        inv.updated_at
    FROM inventory inv
    WHERE inv.id = p_id;
END;
$$ LANGUAGE plpgsql;
