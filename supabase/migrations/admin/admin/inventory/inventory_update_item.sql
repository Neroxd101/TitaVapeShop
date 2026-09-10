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
DECLARE
    cur_qty INTEGER;
    cur_cost DECIMAL(10,2);
    cur_profit DECIMAL(10,2);

    new_qty INTEGER;
    new_cost DECIMAL(10,2);
    new_profit DECIMAL(10,2);
    diff_qty INTEGER;
BEGIN
    -- Validate ID
    IF p_id IS NULL THEN
        RAISE EXCEPTION 'Item ID is required';
    END IF;

    -- Validate category
    IF p_category IS NOT NULL AND p_category NOT IN ('hardware', 'juices') THEN
        RAISE EXCEPTION 'Category must be either "hardware" or "juices"';
    END IF;

    -- Fetch current inventory
    SELECT inv.quantity, inv.cost_price, inv.total_profit
    INTO cur_qty, cur_cost, cur_profit
    FROM inventory AS inv
    WHERE inv.id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    -- Resolve new values
    new_qty  := COALESCE(p_quantity, cur_qty);
    new_cost := COALESCE(p_cost_price, cur_cost);
    new_profit := COALESCE(cur_profit, 0);

    -- Calculate difference
    diff_qty := new_qty - cur_qty;

    -- Adjust total_profit based on quantity change
    -- Increase stock -> subtract cost
    -- Decrease stock -> add cost back
    IF diff_qty != 0 THEN
        new_profit := new_profit - (diff_qty * new_cost);
        -- Explanation:
        -- diff_qty > 0 : added stock, subtract cost
        -- diff_qty < 0 : removed stock, subtract negative = add back
    END IF;

    -- Update inventory
    UPDATE inventory AS inv
    SET
        category = COALESCE(p_category, inv.category),
        name = COALESCE(p_name, inv.name),
        description = COALESCE(p_description, inv.description),
        quantity = new_qty,
        cost_price = new_cost,
        sale_price = COALESCE(p_sale_price, inv.sale_price),
        qr_image_url = COALESCE(p_qr_image_url, inv.qr_image_url),
        images = COALESCE(p_images, inv.images),
        total_profit = new_profit,
        updated_at = NOW()
    WHERE inv.id = p_id;

    -- Return updated row
    RETURN QUERY
    SELECT *
    FROM inventory AS inv
    WHERE inv.id = p_id;
END;
$$ LANGUAGE plpgsql;
