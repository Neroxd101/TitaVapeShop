-- =============================================
-- Complete Sale Function: pos_process
-- Updates inventory after completing a sale
-- Adds sale revenue to total_profit
-- 1-to-1 matching RPC name, backend route, and frontend module
-- =============================================

CREATE OR REPLACE FUNCTION pos_process(
    p_id UUID,
    p_qty_sold INTEGER,
    p_sale_price DECIMAL(10,2) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    category VARCHAR(20),
    name VARCHAR(100),
    description TEXT,
    quantity INTEGER,
    cost_price DECIMAL(10,2),
    sale_price DECIMAL(10,2),
    qr_image_url TEXT,
    images JSONB,
    total_profit DECIMAL(10,2),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    cur_qty INTEGER;
    cur_sale_price DECIMAL(10,2);
    cur_profit DECIMAL(10,2);

    new_qty INTEGER;
    new_profit DECIMAL(10,2);
BEGIN
    -- Validate inputs
    IF p_id IS NULL THEN
        RAISE EXCEPTION 'Item ID is required';
    END IF;
    IF p_qty_sold IS NULL OR p_qty_sold <= 0 THEN
        RAISE EXCEPTION 'Quantity sold must be greater than 0';
    END IF;

    -- Fetch current inventory
    SELECT inv.quantity, inv.sale_price, inv.total_profit
    INTO cur_qty, cur_sale_price, cur_profit
    FROM inventory AS inv
    WHERE inv.id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    -- Check if enough stock
    IF p_qty_sold > cur_qty THEN
        RAISE EXCEPTION 'Not enough stock. Available: %', cur_qty;
    END IF;

    -- Use provided sale_price or fallback to inventory sale_price
    IF p_sale_price IS NULL OR p_sale_price <= 0 THEN
        p_sale_price := cur_sale_price;
    END IF;

    -- Update quantity
    new_qty := cur_qty - p_qty_sold;

    -- Update profit: add sale revenue
    -- Note: cost was already subtracted when stock was added
    new_profit := COALESCE(cur_profit,0) + (p_sale_price * p_qty_sold);

    -- Update inventory table
    UPDATE inventory AS inv
    SET
        quantity = new_qty,
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

-- Backward compatibility alias for existing references (e.g. orders_update_status)
CREATE OR REPLACE FUNCTION inventory_complete_sale(
    p_id UUID,
    p_qty_sold INTEGER,
    p_sale_price DECIMAL(10,2) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    category VARCHAR(20),
    name VARCHAR(100),
    description TEXT,
    quantity INTEGER,
    cost_price DECIMAL(10,2),
    sale_price DECIMAL(10,2),
    qr_image_url TEXT,
    images JSONB,
    total_profit DECIMAL(10,2),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM pos_process(p_id, p_qty_sold, p_sale_price);
END;
$$ LANGUAGE plpgsql;
