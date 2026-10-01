DROP FUNCTION IF EXISTS public.inventory_update_item(UUID, VARCHAR, VARCHAR, JSONB, TEXT, INTEGER, DECIMAL, DECIMAL, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.inventory_update_item(UUID, VARCHAR, VARCHAR, VARCHAR, JSONB, TEXT, INTEGER, DECIMAL, DECIMAL, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.inventory_update_item(
    p_id UUID,
    p_category VARCHAR(20) DEFAULT NULL,
    p_name VARCHAR(100) DEFAULT NULL,
    p_variations JSONB DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_quantity INTEGER DEFAULT NULL,
    p_cost_price DECIMAL(10, 2) DEFAULT NULL,
    p_sale_price DECIMAL(10, 2) DEFAULT NULL,
    p_qr_image_url TEXT DEFAULT NULL,
    p_images JSONB DEFAULT NULL,
    p_expected_quantity INTEGER DEFAULT NULL,
    p_expected_variations JSONB DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    category VARCHAR(20),
    name VARCHAR(100),
    variations JSONB,
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
    cur_variations JSONB;

    new_qty INTEGER;
    new_cost DECIMAL(10,2);
    new_profit DECIMAL(10,2);
    diff_qty INTEGER;
    removed_variations TEXT[];
    target public.orders%ROWTYPE;
    revised_items JSONB;
    revised_total NUMERIC(10,2);
    has_available_items BOOLEAN;
BEGIN
    -- Match whole-product deletion's lock order to coordinate with checkout,
    -- confirmation, completion and cancellation before locking inventory.
    IF p_variations IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(746482, 1);
        IF jsonb_typeof(p_variations) <> 'array' THEN
            RAISE EXCEPTION 'Variations must be an array';
        END IF;
    ELSE
        PERFORM pg_advisory_xact_lock_shared(746482, 1);
    END IF;
    -- Validate ID
    IF p_id IS NULL THEN
        RAISE EXCEPTION 'Item ID is required';
    END IF;

    -- Validate category
    IF p_category IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.inventory_categories AS c
        WHERE c.slug = LOWER(BTRIM(p_category)) AND c.is_active
    ) THEN
        RAISE EXCEPTION 'Selected category is not available';
    END IF;

    -- Fetch current inventory
    SELECT inv.quantity, inv.cost_price, inv.total_profit, inv.variations
    INTO cur_qty, cur_cost, cur_profit, cur_variations
    FROM inventory AS inv
    WHERE inv.id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    -- Resolve new values
    IF p_quantity IS NOT NULL AND
       (p_expected_quantity IS NULL OR p_expected_quantity <> cur_qty) THEN
        RAISE EXCEPTION 'Inventory quantity changed; reload the item before adjusting stock';
    END IF;
    IF p_variations IS NOT NULL AND
       (p_expected_variations IS NULL OR p_expected_variations <> cur_variations) THEN
        RAISE EXCEPTION 'Inventory variations changed; reload the item before adjusting stock';
    END IF;

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
        variations = COALESCE(p_variations, inv.variations),
        description = COALESCE(p_description, inv.description),
        quantity = CASE WHEN p_quantity IS NULL THEN inv.quantity ELSE new_qty END,
        cost_price = new_cost,
        sale_price = COALESCE(p_sale_price, inv.sale_price),
        qr_image_url = COALESCE(p_qr_image_url, inv.qr_image_url),
        images = COALESCE(p_images, inv.images),
        total_profit = CASE WHEN p_quantity IS NULL THEN inv.total_profit ELSE new_profit END,
        updated_at = NOW()
    WHERE inv.id = p_id;

    -- Return updated row
    IF p_variations IS NOT NULL THEN
        -- Include active selections stranded by older edits as well as names
        -- removed now. Renaming a variation removes its old selection too.
        SELECT ARRAY_AGG(DISTINCT candidates.variation_name)
        INTO removed_variations
        FROM (
            SELECT NULLIF(BTRIM(v->>'name'), '') AS variation_name
            FROM jsonb_array_elements(COALESCE(cur_variations, '[]'::JSONB)) v
            UNION
            SELECT COALESCE(NULLIF(BTRIM(i->>'selected_variation'), ''), NULLIF(BTRIM(i->>'variation'), ''))
            FROM public.orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) i
            WHERE o.status IN ('pending', 'confirmed') AND i->>'id' = p_id::TEXT
                AND i->>'unavailable' IS DISTINCT FROM 'true'
        ) candidates
        WHERE candidates.variation_name IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_variations) v
                WHERE v->>'name' = candidates.variation_name);

        FOR target IN
            SELECT o.* FROM public.orders o
            WHERE o.status IN ('pending', 'confirmed')
                AND EXISTS (SELECT 1 FROM jsonb_array_elements(o.items) i
                    WHERE i->>'id' = p_id::TEXT AND i->>'unavailable' IS DISTINCT FROM 'true'
                        AND COALESCE(NULLIF(BTRIM(i->>'selected_variation'), ''), NULLIF(BTRIM(i->>'variation'), ''))
                            = ANY(removed_variations))
            ORDER BY o.id FOR UPDATE
        LOOP
            SELECT jsonb_agg(CASE WHEN i->>'id' = p_id::TEXT
                AND i->>'unavailable' IS DISTINCT FROM 'true'
                AND COALESCE(NULLIF(BTRIM(i->>'selected_variation'), ''), NULLIF(BTRIM(i->>'variation'), ''))
                    = ANY(removed_variations) THEN
                i || jsonb_build_object('unavailable', true,
                    'unavailable_reason', 'Variation deleted by the store', 'unavailable_at', NOW())
                ELSE i END ORDER BY position)
            INTO revised_items
            FROM jsonb_array_elements(target.items) WITH ORDINALITY AS entries(i, position);

            SELECT COALESCE(SUM((i->>'price')::NUMERIC * (i->>'quantity')::INTEGER), 0), COUNT(*) > 0
            INTO revised_total, has_available_items
            FROM jsonb_array_elements(revised_items) i WHERE i->>'unavailable' IS DISTINCT FROM 'true';

            UPDATE public.orders o
            SET items = revised_items, total_amount = revised_total,
                status = CASE WHEN has_available_items THEN target.status ELSE 'cancelled' END,
                cancellation_reason = CASE WHEN has_available_items THEN o.cancellation_reason
                    ELSE 'All products in this order are unavailable.' END,
                stock_reserved = CASE WHEN has_available_items THEN o.stock_reserved ELSE FALSE END,
                payment_amount = CASE WHEN target.payment_status IN ('paid', 'pending_verification')
                    THEN COALESCE(target.payment_amount, target.total_amount) ELSE o.payment_amount END,
                refund_due_amount = CASE WHEN target.payment_status = 'paid' THEN
                    GREATEST(target.refund_due_amount,
                        COALESCE(target.payment_amount, target.total_amount) - revised_total - target.refunded_amount, 0)
                    ELSE o.refund_due_amount END,
                updated_at = NOW()
            WHERE o.id = target.id;

            PERFORM public.transactions_log(
                p_action_type => CASE WHEN has_available_items THEN 'inventory_edit' ELSE 'order_cancel' END,
                p_entity_id => target.id, p_entity_type => 'order',
                p_sale_total => revised_total, p_sale_items => revised_items,
                p_customer_name => target.customer_name, p_customer_email => target.customer_email,
                p_details => jsonb_build_object('reason', CASE WHEN has_available_items
                        THEN 'Unavailable variations removed from order' ELSE 'All products in this order are unavailable.' END,
                    'order_id', target.id, 'order_type', target.order_type,
                    'items_count', jsonb_array_length(revised_items),
                    'new_status', CASE WHEN has_available_items THEN target.status ELSE 'cancelled' END,
                    'previous_status', target.status, 'product_id', p_id,
                    'previous_total', target.total_amount, 'new_total', revised_total,
                    'removed_variations', removed_variations, 'cancelled_by', 'variation_deletion')
            );
        END LOOP;
    END IF;

    RETURN QUERY
    SELECT
        inv.id,
        inv.category,
        inv.name,
        inv.variations,
        inv.description,
        inv.quantity,
        inv.cost_price,
        inv.sale_price,
        inv.qr_image_url,
        inv.images,
        inv.total_profit,
        inv.created_at,
        inv.updated_at
    FROM inventory AS inv
    WHERE inv.id = p_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Only the trusted backend service-role client may update inventory items.
REVOKE ALL ON FUNCTION public.inventory_update_item(
    UUID, VARCHAR, VARCHAR, JSONB, TEXT, INTEGER, DECIMAL, DECIMAL, TEXT, JSONB, INTEGER, JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.inventory_update_item(
    UUID, VARCHAR, VARCHAR, JSONB, TEXT, INTEGER, DECIMAL, DECIMAL, TEXT, JSONB, INTEGER, JSONB
) TO service_role;
