-- Apply before the updated order read/payment/status functions.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_due_amount NUMERIC(10,2) NOT NULL DEFAULT 0
    CHECK (refund_due_amount >= 0);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10,2) NOT NULL DEFAULT 0
    CHECK (refunded_amount >= 0);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.inventory_delete_preview(p_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    WITH affected AS (
        SELECT o.* FROM public.orders o
        WHERE o.status IN ('pending', 'confirmed')
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(o.items) i
              WHERE i->>'id' = p_id::TEXT AND i->>'unavailable' IS DISTINCT FROM 'true')
    )
    SELECT jsonb_build_object(
        'success', EXISTS (SELECT 1 FROM public.inventory WHERE id = p_id),
        'affected_orders', COUNT(*),
        'cancelled_orders', COUNT(*) FILTER (WHERE NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(affected.items) i
            WHERE i->>'id' IS DISTINCT FROM p_id::TEXT
              AND i->>'unavailable' IS DISTINCT FROM 'true'
        )),
        'payment_review_orders', COUNT(*) FILTER (WHERE payment_status IN ('paid', 'pending_verification'))
    ) FROM affected;
$$;

DROP FUNCTION IF EXISTS public.inventory_delete_item(UUID);
CREATE OR REPLACE FUNCTION public.inventory_delete_item(
    p_id UUID, p_user_email VARCHAR(255) DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    product public.inventory%ROWTYPE;
    target public.orders%ROWTYPE;
    revised_items JSONB;
    revised_total NUMERIC(10,2);
    has_available_items BOOLEAN;
    affected_orders JSONB := '[]'::jsonb;
    cancelled_count INTEGER := 0;
    payment_review_count INTEGER := 0;
BEGIN
    IF p_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item ID is required');
    END IF;

    -- Exclusive deletion barrier. Checkout/status/void functions take the
    -- shared form of this same transaction lock before reading or locking rows.
    -- Ordinary sales remain concurrent; deletion cannot miss an in-flight order.
    PERFORM pg_advisory_xact_lock(746482, 1);
    SELECT * INTO product FROM public.inventory WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item not found');
    END IF;

    FOR target IN
        SELECT o.* FROM public.orders o
        WHERE o.status IN ('pending', 'confirmed')
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(o.items) i
              WHERE i->>'id' = p_id::TEXT AND i->>'unavailable' IS DISTINCT FROM 'true')
        ORDER BY o.id FOR UPDATE
    LOOP
        SELECT jsonb_agg(CASE WHEN i->>'id' = p_id::TEXT THEN
            i || jsonb_build_object('unavailable', true,
                'unavailable_reason', 'Product deleted by the store', 'unavailable_at', NOW())
            ELSE i END ORDER BY position)
        INTO revised_items
        FROM jsonb_array_elements(target.items) WITH ORDINALITY AS entries(i, position);

        SELECT COALESCE(SUM((i->>'price')::NUMERIC * (i->>'quantity')::INTEGER), 0), COUNT(*) > 0
        INTO revised_total, has_available_items
        FROM jsonb_array_elements(revised_items) i
        WHERE i->>'unavailable' IS DISTINCT FROM 'true';

        UPDATE public.orders
        SET items = revised_items, total_amount = revised_total,
            status = CASE WHEN has_available_items THEN target.status ELSE 'cancelled' END,
            cancellation_reason = CASE WHEN has_available_items THEN cancellation_reason
                ELSE 'All products in this order are unavailable.' END,
            stock_reserved = CASE WHEN has_available_items THEN stock_reserved ELSE FALSE END,
            payment_amount = CASE WHEN target.payment_status IN ('paid', 'pending_verification')
                THEN COALESCE(target.payment_amount, target.total_amount) ELSE payment_amount END,
            refund_due_amount = CASE WHEN target.payment_status = 'paid' THEN
                GREATEST(target.refund_due_amount,
                    COALESCE(target.payment_amount, target.total_amount) - revised_total - target.refunded_amount, 0)
                ELSE refund_due_amount END,
            updated_at = NOW()
        WHERE id = target.id;

        -- Removed reservations belong to the deleted product. Surviving lines
        -- retain their reservations; an empty order has none left to release.
        IF NOT has_available_items THEN
            cancelled_count := cancelled_count + 1;
            PERFORM public.transactions_log(
                p_action_type => 'order_cancel', p_user_email => p_user_email,
                p_entity_id => target.id, p_entity_type => 'order',
                p_sale_total => revised_total, p_sale_items => revised_items,
                p_customer_name => target.customer_name, p_customer_email => target.customer_email,
                p_details => jsonb_build_object('reason', 'All products in this order are unavailable.',
                    'order_id', target.id, 'order_type', target.order_type,
                    'items_count', jsonb_array_length(revised_items), 'new_status', 'cancelled',
                    'previous_status', target.status, 'product_id', p_id, 'cancelled_by', 'product_deletion')
            );
        END IF;
        IF target.payment_status IN ('paid', 'pending_verification') THEN
            payment_review_count := payment_review_count + 1;
        END IF;
        affected_orders := affected_orders || jsonb_build_array(jsonb_build_object(
            'order_id', target.id, 'previous_total', target.total_amount,
            'new_total', revised_total, 'cancelled', NOT has_available_items,
            'payment_status', target.payment_status
        ));
    END LOOP;

    DELETE FROM public.inventory WHERE id = p_id;
    PERFORM public.transactions_log(
        p_action_type => 'inventory_delete', p_user_email => p_user_email,
        p_entity_id => p_id, p_entity_type => 'inventory',
        p_details => jsonb_build_object('name', product.name, 'category', product.category,
            'quantity', product.quantity, 'affected_orders', affected_orders)
    );
    RETURN jsonb_build_object('success', true, 'message', 'Item deleted',
        'affected_orders', jsonb_array_length(affected_orders),
        'cancelled_orders', cancelled_count, 'payment_review_orders', payment_review_count);
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_delete_preview(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_delete_preview(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.inventory_delete_item(UUID, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_delete_item(UUID, VARCHAR) TO service_role;
