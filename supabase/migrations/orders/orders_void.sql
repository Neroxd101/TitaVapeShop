-- Apply after orders_update_status.sql and sales/sales_process.sql.
-- All stock restoration, revenue reversal and audit logging commit together.
CREATE OR REPLACE FUNCTION public.orders_void(
    p_order_id UUID,
    p_reason TEXT,
    p_user_email VARCHAR(255) DEFAULT NULL
)
RETURNS SETOF public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    target public.orders%ROWTYPE;
    item JSONB;
    item_id UUID;
    qty INTEGER;
    price NUMERIC;
    logged_items JSONB := '[]'::jsonb;
BEGIN
    IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000 THEN
        RAISE EXCEPTION 'A void reason of 1–1000 characters is required';
    END IF;
    SELECT * INTO target FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    IF target.status IS DISTINCT FROM 'completed' THEN
        RAISE EXCEPTION 'Only completed orders can be voided';
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(target.items) ORDER BY value->>'id'
    LOOP
        item_id := (item->>'id')::UUID;
        qty := (item->>'quantity')::INTEGER;
        price := (item->>'price')::NUMERIC;
        IF item_id IS NULL OR qty IS NULL OR qty <= 0 OR price IS NULL OR price <= 0 THEN
            RAISE EXCEPTION 'Invalid original item data; cannot safely reverse this order';
        END IF;
        UPDATE public.inventory
        SET quantity = quantity + qty,
            total_profit = COALESCE(total_profit, 0) - price * qty,
            updated_at = NOW()
        WHERE id = item_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Cannot restore missing inventory item %', item_id; END IF;
        logged_items := logged_items || jsonb_build_array(jsonb_build_object('id', item_id, 'qty', qty, 'price', price));
    END LOOP;
    PERFORM public.transactions_log(
        p_action_type => 'sale_void', p_user_email => p_user_email,
        p_entity_id => p_order_id, p_entity_type => 'order',
        p_sale_total => -target.total_amount, p_sale_items => logged_items,
        p_customer_name => target.customer_name, p_customer_email => target.customer_email,
        p_details => jsonb_build_object('order_id', p_order_id, 'reason', btrim(p_reason),
            'previous_status', target.status, 'stock_restored', true)
    );
    RETURN QUERY UPDATE public.orders SET status = 'voided', updated_at = NOW()
        WHERE id = p_order_id RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION public.orders_void(UUID, TEXT, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_void(UUID, TEXT, VARCHAR) TO service_role;
