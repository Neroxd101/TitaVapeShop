-- Atomic POS void: preserve sale snapshot, reverse revenue, automatically restore stock.
DROP FUNCTION IF EXISTS public.pos_void_sale(UUID, TEXT, BOOLEAN, VARCHAR);
CREATE OR REPLACE FUNCTION public.pos_void_sale(
    p_sale_id UUID, p_reason TEXT,
    p_user_email VARCHAR(255) DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    sale public.transactions%ROWTYPE;
    product public.inventory%ROWTYPE;
    item JSONB;
    item_id UUID;
    qty INTEGER;
    price NUMERIC;
    variant TEXT;
    matches INTEGER;
    restorable BOOLEAN;
    skipped_reason TEXT;
    restored JSONB := '[]';
    skipped JSONB := '[]';
    logged JSONB := '[]';
    line JSONB;
    void_id UUID;
BEGIN
    PERFORM pg_advisory_xact_lock_shared(746482, 1);
    IF p_reason IS NULL OR LENGTH(BTRIM(p_reason)) NOT BETWEEN 1 AND 1000 THEN
        RAISE EXCEPTION 'A reason of 1–1,000 characters is required';
    END IF;
    SELECT * INTO sale FROM public.transactions WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND OR sale.action_type IS DISTINCT FROM 'sale_complete' OR sale.entity_type IS DISTINCT FROM 'sale' THEN
        RAISE EXCEPTION 'Completed POS sale not found';
    END IF;
    IF EXISTS (SELECT 1 FROM public.transactions v WHERE v.action_type = 'sale_void'
        AND v.entity_type = 'sale' AND v.entity_id = sale.id) THEN
        RAISE EXCEPTION 'This POS sale has already been voided';
    END IF;
    IF sale.sale_total IS NULL OR sale.sale_total < 0 OR jsonb_typeof(sale.sale_items) IS DISTINCT FROM 'array'
        OR jsonb_array_length(sale.sale_items) = 0 THEN
        RAISE EXCEPTION 'Original sale data is incomplete; cannot safely void';
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(sale.sale_items) ORDER BY value->>'id', value->>'selected_variation'
    LOOP
        item_id := (item->>'id')::UUID;
        IF COALESCE(item->>'qty', '') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Invalid original quantity'; END IF;
        qty := (item->>'qty')::INTEGER;
        price := (item->>'price')::NUMERIC;
        IF item_id IS NULL OR qty IS NULL OR qty <= 0 OR price IS NULL OR price < 0 THEN
            RAISE EXCEPTION 'Invalid original sale item';
        END IF;
        variant := COALESCE(NULLIF(BTRIM(item->>'selected_variation'), ''), NULLIF(BTRIM(item->>'variation'), ''));
        SELECT * INTO product FROM public.inventory WHERE id = item_id FOR UPDATE;
        restorable := FOUND;
        skipped_reason := CASE WHEN NOT FOUND THEN 'Product no longer exists' ELSE NULL END;
        IF restorable AND variant IS NOT NULL THEN
            SELECT COUNT(*) INTO matches FROM jsonb_array_elements(COALESCE(product.variations,'[]')) v WHERE v->>'name' = variant;
            IF matches <> 1 THEN restorable := FALSE; skipped_reason := 'Original variant is missing or ambiguous'; END IF;
        ELSIF restorable AND jsonb_array_length(COALESCE(product.variations,'[]')) > 0 THEN
            restorable := FALSE; skipped_reason := 'Original sale has no variant for this product';
        END IF;
        UPDATE public.inventory SET
            quantity = quantity + CASE WHEN restorable THEN qty ELSE 0 END,
            variations = CASE WHEN restorable AND variant IS NOT NULL THEN (
                SELECT jsonb_agg(CASE WHEN v->>'name' = variant THEN
                    jsonb_set(v, '{quantity}', to_jsonb(COALESCE((v->>'quantity')::INTEGER, 0) + qty), TRUE)
                    ELSE v END ORDER BY position)
                FROM jsonb_array_elements(product.variations) WITH ORDINALITY AS entries(v, position)
            ) ELSE variations END,
            total_profit = COALESCE(total_profit, 0) - price * qty,
            updated_at = NOW()
        WHERE id = item_id;
        line := item || jsonb_build_object('stock_restored', restorable, 'restock_skipped_reason', skipped_reason);
        logged := logged || jsonb_build_array(line);
        IF restorable THEN restored := restored || jsonb_build_array(line);
        ELSE skipped := skipped || jsonb_build_array(line); END IF;
    END LOOP;
    SELECT t.id INTO void_id FROM public.transactions_log(
        p_action_type => 'sale_void', p_user_email => p_user_email,
        p_entity_id => sale.id, p_entity_type => 'sale',
        p_sale_total => -sale.sale_total, p_sale_items => logged,
        p_customer_name => sale.customer_name, p_customer_email => sale.customer_email,
        p_details => jsonb_build_object('sale_id', sale.id, 'reason', BTRIM(p_reason),
            'stock_restored', jsonb_array_length(skipped) = 0,
            'restocked_items', restored, 'restock_skipped_items', skipped,
            'refund_status', 'refund_due', 'refund_amount', sale.sale_total)
    ) t LIMIT 1;
    RETURN jsonb_build_object('success', TRUE, 'void_id', void_id, 'restocked_items', restored,
        'restock_skipped_items', skipped, 'refund_status', 'refund_due', 'refund_amount', sale.sale_total);
END;
$$;
REVOKE ALL ON FUNCTION public.pos_void_sale(UUID, TEXT, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_void_sale(UUID, TEXT, VARCHAR) TO service_role;
NOTIFY pgrst, 'reload schema';
