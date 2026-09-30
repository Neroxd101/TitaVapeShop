-- Remove the old item-level functions. Order completion will receive its own
-- stock-processing function when the Orders module is refactored.
DROP FUNCTION IF EXISTS public.inventory_complete_sale(UUID, INTEGER, DECIMAL);
DROP FUNCTION IF EXISTS public.pos_process(UUID, INTEGER, DECIMAL);

-- =============================================
-- Atomic POS checkout
-- Validates the whole cart, uses database prices, deducts stock, and logs
-- one sale in a single transaction. Any error rolls back every change.
-- =============================================
CREATE OR REPLACE FUNCTION public.pos_process_sale(
    p_items JSONB,
    p_cash DECIMAL(10,2),
    p_customer_name VARCHAR(255) DEFAULT NULL,
    p_customer_email VARCHAR(255) DEFAULT NULL,
    p_user_email VARCHAR(255) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cart_item RECORD;
    inventory_item public.inventory%ROWTYPE;
    variation_stock INTEGER;
    variation_matches INTEGER;
    sale_items JSONB := '[]'::jsonb;
    sale_total DECIMAL(10,2) := 0;
    sale_id UUID;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cart must contain at least one item';
    END IF;

    IF p_cash IS NULL OR p_cash < 0 THEN
        RAISE EXCEPTION 'Cash must be zero or greater';
    END IF;

    -- Validate each line before aggregation so negative quantities cannot
    -- cancel out valid lines for the same product/variation.
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_items) AS entry
        WHERE jsonb_typeof(entry) IS DISTINCT FROM 'object'
           OR NULLIF(entry->>'id', '') IS NULL
           OR COALESCE(entry->>'qty', '') !~ '^[0-9]+$'
           OR (entry->>'qty')::NUMERIC <= 0
           OR (entry->>'qty')::NUMERIC > 2147483647
           OR (entry->'selected_variation' IS NOT NULL
               AND jsonb_typeof(entry->'selected_variation') NOT IN ('string', 'null'))
    ) THEN
        RAISE EXCEPTION 'Every cart item requires a valid id, positive integer quantity, and valid variation';
    END IF;

    -- Keep variations separate and lock products in a consistent order.
    FOR cart_item IN
        SELECT (value->>'id')::UUID AS id,
               NULLIF(BTRIM(value->>'selected_variation'), '') AS selected_variation,
               SUM((value->>'qty')::INTEGER)::INTEGER AS qty
        FROM jsonb_array_elements(p_items)
        GROUP BY (value->>'id')::UUID, NULLIF(BTRIM(value->>'selected_variation'), '')
        ORDER BY (value->>'id')::UUID, NULLIF(BTRIM(value->>'selected_variation'), '')
    LOOP
        IF cart_item.id IS NULL OR cart_item.qty IS NULL OR cart_item.qty <= 0 THEN
            RAISE EXCEPTION 'Every cart item requires a valid id and positive quantity';
        END IF;

        SELECT * INTO inventory_item
        FROM public.inventory
        WHERE id = cart_item.id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Inventory item % was not found', cart_item.id;
        END IF;

        IF inventory_item.quantity IS NULL OR inventory_item.quantity < cart_item.qty THEN
            RAISE EXCEPTION 'Not enough stock for %. Available: %',
                inventory_item.name, inventory_item.quantity;
        END IF;

        IF jsonb_array_length(COALESCE(inventory_item.variations, '[]'::jsonb)) > 0 THEN
            IF cart_item.selected_variation IS NULL THEN
                RAISE EXCEPTION 'A variation is required for %', inventory_item.name;
            END IF;

            SELECT COUNT(*), MIN((variation->>'quantity')::INTEGER)
            INTO variation_matches, variation_stock
            FROM jsonb_array_elements(inventory_item.variations) AS variation
            WHERE variation->>'name' = cart_item.selected_variation;

            IF variation_matches <> 1 THEN
                RAISE EXCEPTION 'Variation % is missing or ambiguous for %',
                    cart_item.selected_variation, inventory_item.name;
            END IF;
            IF variation_stock IS NULL OR variation_stock < cart_item.qty THEN
                RAISE EXCEPTION 'Not enough stock for % (%). Available: %',
                    inventory_item.name, cart_item.selected_variation, COALESCE(variation_stock, 0);
            END IF;
        ELSIF cart_item.selected_variation IS NOT NULL THEN
            RAISE EXCEPTION 'Product % does not have variations', inventory_item.name;
        END IF;

        sale_total := sale_total + (inventory_item.sale_price * cart_item.qty);
        sale_items := sale_items || jsonb_build_array(jsonb_build_object(
            'id', inventory_item.id,
            'name', inventory_item.name,
            'category', inventory_item.category,
            'qty', cart_item.qty,
            'price', inventory_item.sale_price,
            'cost_price', inventory_item.cost_price,
            'selected_variation', cart_item.selected_variation
        ));

        UPDATE public.inventory
        SET quantity = quantity - cart_item.qty,
            variations = CASE
                WHEN cart_item.selected_variation IS NULL THEN variations
                ELSE (
                    SELECT jsonb_agg(
                        CASE WHEN variation->>'name' = cart_item.selected_variation THEN
                            jsonb_set(variation, '{quantity}', to_jsonb(variation_stock - cart_item.qty), true)
                        ELSE variation END
                        ORDER BY position
                    )
                    FROM jsonb_array_elements(inventory_item.variations)
                        WITH ORDINALITY AS entries(variation, position)
                )
            END,
            total_profit = COALESCE(total_profit, 0) + (inventory_item.sale_price * cart_item.qty),
            updated_at = NOW()
        WHERE id = cart_item.id;
    END LOOP;

    IF p_cash < sale_total THEN
        RAISE EXCEPTION 'Cash is not enough. Required: %', sale_total;
    END IF;

    SELECT logged.id INTO sale_id
    FROM public.transactions_log(
        p_action_type => 'sale_complete',
        p_user_email => p_user_email,
        p_entity_type => 'sale',
        p_details => jsonb_build_object('items_count', jsonb_array_length(sale_items)),
        p_sale_total => sale_total,
        p_sale_items => sale_items,
        p_customer_name => COALESCE(NULLIF(BTRIM(p_customer_name), ''), 'Walk-in'),
        p_customer_email => NULLIF(BTRIM(p_customer_email), '')
    ) AS logged
    LIMIT 1;

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', sale_id,
        'items', sale_items,
        'total', sale_total,
        'cash', p_cash,
        'change', p_cash - sale_total
    );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_process_sale(JSONB, DECIMAL, VARCHAR, VARCHAR, VARCHAR)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.pos_process_sale(JSONB, DECIMAL, VARCHAR, VARCHAR, VARCHAR)
TO service_role;
