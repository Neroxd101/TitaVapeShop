BEGIN;
-- =============================================
-- Transactions Log Function
-- Logs a transaction/activity via RPC
-- =============================================

-- Keep the table constraint synchronized with the action types accepted below.
ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_action_type_check;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_action_type_check
CHECK (action_type IN (
    'inventory_add',
    'inventory_edit',
    'inventory_delete',
    'category_add',
    'category_delete',
    'sale_complete',
    'sale_void',
    'order_confirm',
    'order_cancel',
    'order_payment_update',
    'order_refund'
));

CREATE OR REPLACE FUNCTION public.transactions_log(
    p_action_type VARCHAR(50),
    p_user_email VARCHAR(255) DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_entity_type VARCHAR(50) DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb,
    p_sale_total DECIMAL(10, 2) DEFAULT NULL,
    p_sale_items JSONB DEFAULT NULL,
    p_customer_name VARCHAR(255) DEFAULT NULL,
    p_customer_email VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    action_type VARCHAR(50),
    user_email VARCHAR(255),
    entity_id UUID,
    entity_type VARCHAR(50),
    details JSONB,
    sale_total DECIMAL(10, 2),
    sale_items JSONB,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    new_transaction RECORD;
BEGIN
    -- Validate required fields
    IF p_action_type IS NULL OR p_action_type = '' THEN
        RAISE EXCEPTION 'action_type is required';
    END IF;

    -- Validate action_type
    IF p_action_type NOT IN ('inventory_add', 'inventory_edit', 'inventory_delete', 'category_add', 'category_delete', 'sale_complete', 'sale_void', 'order_confirm', 'order_cancel', 'order_payment_update', 'order_refund') THEN
        RAISE EXCEPTION 'Invalid action_type: %', p_action_type;
    END IF;

    -- Insert transaction
    INSERT INTO transactions (
        action_type,
        user_email,
        entity_id,
        entity_type,
        details,
        sale_total,
        sale_items,
        customer_name,
        customer_email
    ) VALUES (
        p_action_type,
        p_user_email,
        p_entity_id,
        p_entity_type,
        COALESCE(p_details, '{}'::jsonb),
        p_sale_total,
        p_sale_items,
        p_customer_name,
        p_customer_email
    )
    RETURNING * INTO new_transaction;

    -- Return the created transaction
    RETURN QUERY
    SELECT
        new_transaction.id,
        new_transaction.action_type,
        new_transaction.user_email,
        new_transaction.entity_id,
        new_transaction.entity_type,
        new_transaction.details,
        new_transaction.sale_total,
        new_transaction.sale_items,
        new_transaction.customer_name,
        new_transaction.customer_email,
        new_transaction.created_at;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.transactions_log(
    VARCHAR, VARCHAR, UUID, VARCHAR, JSONB, DECIMAL, JSONB, VARCHAR, VARCHAR
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.transactions_log(
    VARCHAR, VARCHAR, UUID, VARCHAR, JSONB, DECIMAL, JSONB, VARCHAR, VARCHAR
) TO service_role;

-- POS sales only; online orders have their own Orders history.
CREATE OR REPLACE FUNCTION public.pos_sales_history(
    p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0,
    p_search TEXT DEFAULT NULL, p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSONB;
BEGIN
    IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset < 0 THEN
        RAISE EXCEPTION 'Invalid history pagination';
    END IF;
    WITH matching AS (
        SELECT s.*, v.details AS void_details, v.created_at AS voided_at, v.user_email AS voided_by,
            (v.id IS NOT NULL) AS voided
        FROM public.transactions s
        LEFT JOIN LATERAL (
            SELECT t.* FROM public.transactions t
            WHERE t.action_type = 'sale_void' AND t.entity_type = 'sale'
              AND t.entity_id = s.id
            ORDER BY t.created_at, t.id LIMIT 1
        ) v ON TRUE
        WHERE s.action_type = 'sale_complete' AND s.entity_type = 'sale'
          AND (p_start_date IS NULL OR s.created_at >= p_start_date)
          AND (p_end_date IS NULL OR s.created_at < p_end_date)
          AND (NULLIF(BTRIM(p_search), '') IS NULL OR s.id::TEXT ILIKE '%' || p_search || '%'
            OR s.customer_name ILIKE '%' || p_search || '%' OR s.user_email ILIKE '%' || p_search || '%')
    ), page AS (
        SELECT * FROM matching ORDER BY created_at DESC, id DESC LIMIT p_limit OFFSET p_offset
    ) SELECT jsonb_build_object('sales', COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY created_at DESC, id DESC) FROM page), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM matching)) INTO result;
    RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.pos_sales_history(INTEGER, INTEGER, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_sales_history(INTEGER, INTEGER, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
NOTIFY pgrst, 'reload schema';

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

-- =============================================
-- Analytics: Category Statistics
-- Gets revenue and units sold statistics by category
-- =============================================

CREATE OR REPLACE FUNCTION public.analytics_category_stats(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    category_stats JSONB;
BEGIN
    -- Calculate category stats
    -- If end_date is provided, include the entire day (up to end of day)
    WITH filtered_transactions_cat AS (
        SELECT id, sale_items
        FROM transactions sale_tx
        WHERE sale_tx.action_type = 'sale_complete'
        -- Voids remove the original sale even when voided outside the selected dates.
        AND NOT EXISTS (
            SELECT 1 FROM transactions void_tx
            WHERE void_tx.action_type = 'sale_void'
                AND void_tx.entity_type = sale_tx.entity_type
                AND void_tx.entity_id = CASE WHEN sale_tx.entity_type = 'sale' THEN sale_tx.id ELSE COALESCE(sale_tx.entity_id, sale_tx.id) END
        )
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at < (p_end_date + INTERVAL '1 day'))
            AND sale_items IS NOT NULL
    ),
    item_aggregates AS (
        SELECT 
            COALESCE(
                NULLIF(BTRIM(inv.category), ''),
                NULLIF(BTRIM(sale_item->>'category'), ''),
                'Uncategorized'
            ) as item_category,
            SUM(COALESCE((sale_item->>'qty')::INTEGER, 0)) as units_sold,
            SUM(COALESCE((sale_item->>'qty')::INTEGER, 0) * COALESCE(ROUND((sale_item->>'price')::NUMERIC, 2), 0)) as revenue
        FROM filtered_transactions_cat t,
        LATERAL jsonb_array_elements(t.sale_items) as sale_item
        LEFT JOIN inventory inv ON inv.id = (sale_item->>'id')::UUID
        WHERE (sale_item->>'id')::UUID IS NOT NULL
        GROUP BY COALESCE(
            NULLIF(BTRIM(inv.category), ''),
            NULLIF(BTRIM(sale_item->>'category'), ''),
            'Uncategorized'
        )
    )
    SELECT COALESCE(jsonb_object_agg(
        COALESCE(item_category, 'Uncategorized'),
        jsonb_build_object(
            'name', COALESCE(item_category, 'Uncategorized'),
            'unitsSold', units_sold,
            'revenue', revenue
        )
    ), '{}'::jsonb) INTO category_stats
    FROM item_aggregates;

    RETURN category_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.analytics_category_stats(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_category_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- =============================================
-- Analytics: Gross Sales
-- Calculates the total gross sales amount from all sales transactions
-- =============================================

DROP FUNCTION IF EXISTS public.analytics_avg_basket(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.analytics_gross_sales(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
    total_gross NUMERIC;
BEGIN
    -- Calculate total gross sales amount from all non-voided sale transactions
    -- If end_date is provided, include the entire day (up to end of day)
    SELECT COALESCE(SUM(t.sale_total), 0)
    INTO total_gross
    FROM transactions t
    WHERE t.action_type = 'sale_complete'
        -- Voids remove the original sale even when voided outside the selected dates.
        AND NOT EXISTS (
            SELECT 1 FROM transactions void_tx
            WHERE void_tx.action_type = 'sale_void'
                AND void_tx.entity_type = t.entity_type
                AND void_tx.entity_id = CASE WHEN t.entity_type = 'sale' THEN t.id ELSE COALESCE(t.entity_id, t.id) END
        )
        AND (p_start_date IS NULL OR t.created_at >= p_start_date)
        AND (p_end_date IS NULL OR t.created_at < (p_end_date + INTERVAL '1 day'));

    RETURN ROUND(total_gross, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.analytics_gross_sales(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_gross_sales(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- =============================================
-- Analytics: Items Sold
-- Calculates the total number of items sold across all sales
-- =============================================

CREATE OR REPLACE FUNCTION public.analytics_items_sold(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    items_sold INTEGER;
BEGIN
    -- Calculate total items sold by summing quantities from sale_items JSONB
    -- If end_date is provided, include the entire day (up to end of day)
    WITH filtered_transactions AS (
        SELECT id, sale_items
        FROM transactions sale_tx
        WHERE sale_tx.action_type = 'sale_complete'
        -- Voids remove the original sale even when voided outside the selected dates.
        AND NOT EXISTS (
            SELECT 1 FROM transactions void_tx
            WHERE void_tx.action_type = 'sale_void'
                AND void_tx.entity_type = sale_tx.entity_type
                AND void_tx.entity_id = CASE WHEN sale_tx.entity_type = 'sale' THEN sale_tx.id ELSE COALESCE(sale_tx.entity_id, sale_tx.id) END
        )
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at < (p_end_date + INTERVAL '1 day'))
            AND sale_items IS NOT NULL
    )
    SELECT COALESCE(SUM(COALESCE((sale_item->>'qty')::INTEGER, 0)), 0)
    INTO items_sold
    FROM filtered_transactions t,
    LATERAL jsonb_array_elements(t.sale_items) as sale_item;

    RETURN items_sold;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.analytics_items_sold(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_items_sold(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- =============================================
-- Analytics Modal: Gross Sales Details
-- Returns total gross sales and order sales breakdown for the modal
-- =============================================

CREATE OR REPLACE FUNCTION public.analytics_modal_gross_sales(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_total NUMERIC;
    v_rows JSONB;
BEGIN
    WITH filtered_transactions AS (
        SELECT 
            s.id,
            COALESCE(s.entity_id::text, s.id::text) AS order_id,
            s.created_at,
            COALESCE(s.customer_name, 'Customer not recorded') AS customer,
            COALESCE(s.sale_total, 0) AS total_amount
        FROM transactions s
        WHERE s.action_type = 'sale_complete'
          AND NOT EXISTS (
              SELECT 1 FROM transactions v
              WHERE v.action_type = 'sale_void'
                AND v.entity_type = s.entity_type
                AND v.entity_id = CASE WHEN s.entity_type = 'sale' THEN s.id ELSE COALESCE(s.entity_id, s.id) END
          )
          AND (p_start_date IS NULL OR s.created_at >= p_start_date)
          AND (p_end_date IS NULL OR s.created_at < (p_end_date + INTERVAL '1 day'))
    ),
    order_list AS (
        SELECT
            order_id,
            created_at,
            customer,
            total_amount
        FROM filtered_transactions
        ORDER BY created_at DESC, order_id DESC
    )
    SELECT
        COALESCE(SUM(total_amount), 0),
        COALESCE(jsonb_agg(jsonb_build_object(
            'order_id', order_id,
            'date', created_at,
            'customer', customer,
            'total_amount', total_amount
        )), '[]'::jsonb)
    INTO v_total, v_rows
    FROM order_list;

    RETURN jsonb_build_object(
        'total', COALESCE(v_total, 0),
        'rows', COALESCE(v_rows, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.analytics_modal_gross_sales(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_modal_gross_sales(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- =============================================
-- Analytics Modal: Items Sold Details
-- Returns total items sold and per-product quantity breakdown for the modal
-- =============================================

CREATE OR REPLACE FUNCTION public.analytics_modal_items_sold(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_total BIGINT;
    v_rows JSONB;
BEGIN
    WITH filtered_transactions AS (
        SELECT s.id, s.sale_items
        FROM transactions s
        WHERE s.action_type = 'sale_complete'
          AND NOT EXISTS (
              SELECT 1 FROM transactions v
              WHERE v.action_type = 'sale_void'
                AND v.entity_type = s.entity_type
                AND v.entity_id = CASE WHEN s.entity_type = 'sale' THEN s.id ELSE COALESCE(s.entity_id, s.id) END
          )
          AND (p_start_date IS NULL OR s.created_at >= p_start_date)
          AND (p_end_date IS NULL OR s.created_at < (p_end_date + INTERVAL '1 day'))
          AND s.sale_items IS NOT NULL
    ),
    expanded_items AS (
        SELECT
            COALESCE(
                item->>'name',
                inv.name,
                'Unknown Product'
            ) AS product_name,
            COALESCE((item->>'qty')::INTEGER, 0) AS qty
        FROM filtered_transactions t,
        LATERAL jsonb_array_elements(t.sale_items) AS item
        LEFT JOIN inventory inv ON (
            CASE 
                WHEN (item->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (item->>'id')::UUID 
                ELSE NULL 
            END
        ) = inv.id
    ),
    product_summary AS (
        SELECT
            product_name,
            SUM(qty) AS quantity_sold
        FROM expanded_items
        GROUP BY product_name
        ORDER BY quantity_sold DESC, product_name ASC
    )
    SELECT
        COALESCE(SUM(quantity_sold), 0),
        COALESCE(jsonb_agg(jsonb_build_object(
            'product_name', product_name,
            'quantity_sold', quantity_sold
        )), '[]'::jsonb)
    INTO v_total, v_rows
    FROM product_summary;

    RETURN jsonb_build_object(
        'total', COALESCE(v_total, 0),
        'rows', COALESCE(v_rows, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.analytics_modal_items_sold(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_modal_items_sold(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- =============================================
-- Analytics Modal: Total Orders Details
-- Returns total orders count and order details breakdown for the modal
-- =============================================

CREATE OR REPLACE FUNCTION public.analytics_modal_total_orders(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_total BIGINT;
    v_rows JSONB;
BEGIN
    WITH filtered_transactions AS (
        SELECT 
            s.id,
            COALESCE(s.entity_id::text, s.id::text) AS order_id,
            s.created_at,
            COALESCE(s.customer_name, 'Customer not recorded') AS customer,
            CASE WHEN s.entity_type = 'order' THEN 'Customer order' ELSE 'POS sale' END AS source,
            COALESCE(s.sale_total, 0) AS total_amount,
            s.sale_items
        FROM transactions s
        WHERE s.action_type = 'sale_complete'
          AND NOT EXISTS (
              SELECT 1 FROM transactions v
              WHERE v.action_type = 'sale_void'
                AND v.entity_type = s.entity_type
                AND v.entity_id = CASE WHEN s.entity_type = 'sale' THEN s.id ELSE COALESCE(s.entity_id, s.id) END
          )
          AND (p_start_date IS NULL OR s.created_at >= p_start_date)
          AND (p_end_date IS NULL OR s.created_at < (p_end_date + INTERVAL '1 day'))
    ),
    order_items AS (
        SELECT 
            t.id,
            string_agg(
                concat(
                    COALESCE(item->>'name', inv.name, 'Unknown Product'),
                    ' × ',
                    COALESCE(item->>'qty', '1')
                ),
                ', '
            ) AS items_summary
        FROM filtered_transactions t
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(t.sale_items) = 'array' THEN t.sale_items 
                ELSE '[]'::jsonb 
            END
        ) AS item
        LEFT JOIN inventory inv ON (
            CASE 
                WHEN (item->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (item->>'id')::UUID 
                ELSE NULL 
            END
        ) = inv.id
        GROUP BY t.id
    ),
    order_list AS (
        SELECT
            t.order_id,
            t.created_at,
            t.customer,
            t.source,
            COALESCE(oi.items_summary, 'No item details recorded') AS items_summary,
            t.total_amount
        FROM filtered_transactions t
        LEFT JOIN order_items oi ON oi.id = t.id
        ORDER BY t.created_at DESC, t.order_id DESC
    )
    SELECT
        COUNT(*),
        COALESCE(jsonb_agg(jsonb_build_object(
            'order_id', order_id,
            'date', created_at,
            'customer', customer,
            'source', source,
            'items_summary', items_summary,
            'total_amount', total_amount
        )), '[]'::jsonb)
    INTO v_total, v_rows
    FROM order_list;

    RETURN jsonb_build_object(
        'total', COALESCE(v_total, 0),
        'rows', COALESCE(v_rows, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.analytics_modal_total_orders(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_modal_total_orders(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- =============================================
-- Analytics Modal: Total Profit Details
-- Returns total profit and per-product profit breakdown for the modal
-- =============================================

CREATE OR REPLACE FUNCTION public.analytics_modal_total_profit(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_total NUMERIC;
    v_rows JSONB;
BEGIN
    WITH filtered_transactions AS (
        SELECT s.id, s.sale_items
        FROM transactions s
        WHERE s.action_type = 'sale_complete'
          AND NOT EXISTS (
              SELECT 1 FROM transactions v
              WHERE v.action_type = 'sale_void'
                AND v.entity_type = s.entity_type
                AND v.entity_id = CASE WHEN s.entity_type = 'sale' THEN s.id ELSE COALESCE(s.entity_id, s.id) END
          )
          AND (p_start_date IS NULL OR s.created_at >= p_start_date)
          AND (p_end_date IS NULL OR s.created_at < (p_end_date + INTERVAL '1 day'))
          AND s.sale_items IS NOT NULL
    ),
    expanded_items AS (
        SELECT
            COALESCE(
                item->>'name',
                inv.name,
                'Unknown Product'
            ) AS product_name,
            COALESCE((item->>'qty')::NUMERIC, 0) AS qty,
            COALESCE(ROUND((item->>'price')::NUMERIC, 2), 0) AS price,
            COALESCE(ROUND((item->>'cost_price')::NUMERIC, 2), inv.cost_price, 0) AS cost_price
        FROM filtered_transactions t,
        LATERAL jsonb_array_elements(t.sale_items) AS item
        LEFT JOIN inventory inv ON (
            CASE 
                WHEN (item->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (item->>'id')::UUID 
                ELSE NULL 
            END
        ) = inv.id
    ),
    product_summary AS (
        SELECT
            product_name,
            SUM(qty) AS quantity_sold,
            ROUND(SUM(qty * (price - cost_price)), 2) AS profit
        FROM expanded_items
        GROUP BY product_name
        ORDER BY profit DESC, product_name ASC
    )
    SELECT
        COALESCE(SUM(profit), 0),
        COALESCE(jsonb_agg(jsonb_build_object(
            'product_name', product_name,
            'quantity_sold', quantity_sold,
            'profit', profit
        )), '[]'::jsonb)
    INTO v_total, v_rows
    FROM product_summary;

    RETURN jsonb_build_object(
        'total', COALESCE(v_total, 0),
        'rows', COALESCE(v_rows, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.analytics_modal_total_profit(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_modal_total_profit(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- =============================================
-- Analytics: Sales Trend
-- Gets daily gross sales and daily profit grouped by date for trend analysis
-- =============================================

DROP FUNCTION IF EXISTS public.analytics_revenue_trend(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.analytics_sales_trend(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    daily_revenue JSONB;
BEGIN
    -- Calculate daily gross sales and profit (grouped by date)
    WITH filtered_transactions AS (
        SELECT id, created_at, sale_total, sale_items
        FROM transactions sale_tx
        WHERE sale_tx.action_type = 'sale_complete'
        -- Voids remove the original sale even when voided outside the selected dates.
        AND NOT EXISTS (
            SELECT 1 FROM transactions void_tx
            WHERE void_tx.action_type = 'sale_void'
                AND void_tx.entity_type = sale_tx.entity_type
                AND void_tx.entity_id = CASE WHEN sale_tx.entity_type = 'sale' THEN sale_tx.id ELSE COALESCE(sale_tx.entity_id, sale_tx.id) END
        )
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at < (p_end_date + INTERVAL '1 day'))
    ),
    daily_sales AS (
        SELECT 
            date_trunc('day', created_at)::date as daily_date,
            SUM(COALESCE(sale_total, 0)) as daily_gross
        FROM filtered_transactions
        GROUP BY date_trunc('day', created_at)::date
    ),
    daily_profit AS (
        SELECT 
            date_trunc('day', t.created_at)::date as daily_date,
            COALESCE(SUM(
                COALESCE((sale_item->>'qty')::INTEGER, 0) * (
                    COALESCE(ROUND((sale_item->>'price')::NUMERIC, 2), 0) -
                    COALESCE(ROUND((sale_item->>'cost_price')::NUMERIC, 2), inv.cost_price, 0)
                )
            ), 0) as daily_profit_total
        FROM filtered_transactions t,
        LATERAL jsonb_array_elements(t.sale_items) as sale_item
        LEFT JOIN inventory inv ON inv.id = (
            CASE 
                WHEN (sale_item->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
                THEN (sale_item->>'id')::UUID 
                ELSE NULL 
            END
        )
        WHERE t.sale_items IS NOT NULL
        GROUP BY date_trunc('day', t.created_at)::date
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'date', ds.daily_date::text,
            'grossSales', ds.daily_gross,
            'profit', COALESCE(dp.daily_profit_total, 0),
            'revenue', ds.daily_gross
        ) ORDER BY ds.daily_date
    ), '[]'::jsonb) INTO daily_revenue
    FROM daily_sales ds
    LEFT JOIN daily_profit dp ON dp.daily_date = ds.daily_date;

    RETURN daily_revenue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.analytics_sales_trend(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_sales_trend(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- =============================================
-- Analytics: Top Products
-- Gets top selling products with revenue, units sold, and stock info
-- =============================================

CREATE OR REPLACE FUNCTION public.analytics_top_products(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    top_products JSONB;
BEGIN
    -- Calculate top products and category stats from sale_items JSONB
    -- Aggregate items across all sales, joining with inventory to get category and stock
    -- If end_date is provided, include the entire day (up to end of day)
    WITH filtered_transactions AS (
        SELECT id, sale_items
        FROM transactions sale_tx
        WHERE sale_tx.action_type = 'sale_complete'
        -- Voids remove the original sale even when voided outside the selected dates.
        AND NOT EXISTS (
            SELECT 1 FROM transactions void_tx
            WHERE void_tx.action_type = 'sale_void'
                AND void_tx.entity_type = sale_tx.entity_type
                AND void_tx.entity_id = CASE WHEN sale_tx.entity_type = 'sale' THEN sale_tx.id ELSE COALESCE(sale_tx.entity_id, sale_tx.id) END
        )
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at < (p_end_date + INTERVAL '1 day'))
            AND sale_items IS NOT NULL
    ),
    item_aggregates AS (
        SELECT 
            (sale_item->>'id')::UUID as item_id,
            COALESCE(sale_item->>'name', inv.name, 'Unknown Product') as item_name,
            COALESCE(
                NULLIF(BTRIM(inv.category), ''),
                NULLIF(BTRIM(sale_item->>'category'), ''),
                'Uncategorized'
            ) as item_category,
            SUM(COALESCE((sale_item->>'qty')::INTEGER, 0)) as units_sold,
            SUM(COALESCE((sale_item->>'qty')::INTEGER, 0) * COALESCE(ROUND((sale_item->>'price')::NUMERIC, 2), 0)) as revenue
        FROM filtered_transactions t,
        LATERAL jsonb_array_elements(t.sale_items) as sale_item
        LEFT JOIN inventory inv ON inv.id = (sale_item->>'id')::UUID
        GROUP BY (sale_item->>'id')::UUID,
            COALESCE(sale_item->>'name', inv.name, 'Unknown Product'),
            COALESCE(NULLIF(BTRIM(inv.category), ''), NULLIF(BTRIM(sale_item->>'category'), ''), 'Uncategorized')
    ),
    products_with_stock AS (
        SELECT 
            ia.item_id,
            ia.item_name,
            ia.item_category,
            ia.units_sold,
            ia.revenue,
            COALESCE(inv.quantity, 0) as stock_left
        FROM item_aggregates ia
        LEFT JOIN inventory inv ON inv.id = ia.item_id
    ),
    products_sorted AS (
        SELECT 
            item_name,
            units_sold,
            revenue,
            item_category,
            stock_left
        FROM products_with_stock
        ORDER BY revenue DESC
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'name', item_name,
            'unitsSold', units_sold,
            'revenue', revenue,
            'category', item_category,
            'stockLeft', stock_left
        )
    ), '[]'::jsonb) INTO top_products
    FROM products_sorted;

    RETURN top_products;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.analytics_top_products(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_top_products(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- =============================================
-- Analytics: Total Orders (Order Transactions Count)
-- Counts the total number of completed order/sale transactions
-- =============================================

DROP FUNCTION IF EXISTS public.analytics_total_sales(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.analytics_total_orders(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    total_orders INTEGER;
BEGIN
    -- Count total number of completed order/sale transactions
    -- If end_date is provided, include the entire day (up to end of day)
    SELECT COUNT(*)
    INTO total_orders
    FROM transactions t
    WHERE t.action_type = 'sale_complete'
        -- Voids remove the original sale/order even when voided outside the selected dates.
        AND NOT EXISTS (
            SELECT 1 FROM transactions void_tx
            WHERE void_tx.action_type = 'sale_void'
                AND void_tx.entity_type = t.entity_type
                AND void_tx.entity_id = CASE WHEN t.entity_type = 'sale' THEN t.id ELSE COALESCE(t.entity_id, t.id) END
        )
        AND (p_start_date IS NULL OR t.created_at >= p_start_date)
        AND (p_end_date IS NULL OR t.created_at < (p_end_date + INTERVAL '1 day'));

    RETURN total_orders;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.analytics_total_orders(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_total_orders(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- =============================================
-- Analytics: Total Profit
-- Calculates the total profit (sale price minus cost price) from all completed sales
-- =============================================

DROP FUNCTION IF EXISTS public.analytics_total_revenue(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.analytics_total_profit(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
    total_profit NUMERIC;
BEGIN
    -- Calculate total profit from all non-voided sale transactions:
    -- Profit = sum of (selling_price - cost_price) * quantity for each sold item
    -- If end_date is provided, include the entire day (up to end of day)
    WITH filtered_transactions AS (
        SELECT id, sale_items
        FROM transactions sale_tx
        WHERE sale_tx.action_type = 'sale_complete'
        -- Voids remove the original sale even when voided outside the selected dates.
        AND NOT EXISTS (
            SELECT 1 FROM transactions void_tx
            WHERE void_tx.action_type = 'sale_void'
                AND void_tx.entity_type = sale_tx.entity_type
                AND void_tx.entity_id = CASE WHEN sale_tx.entity_type = 'sale' THEN sale_tx.id ELSE COALESCE(sale_tx.entity_id, sale_tx.id) END
        )
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at < (p_end_date + INTERVAL '1 day'))
            AND sale_items IS NOT NULL
    )
    SELECT COALESCE(
        SUM(
            COALESCE((sale_item->>'qty')::INTEGER, 0) * (
                COALESCE(ROUND((sale_item->>'price')::NUMERIC, 2), 0) -
                COALESCE(ROUND((sale_item->>'cost_price')::NUMERIC, 2), inv.cost_price, 0)
            )
        ), 0
    )
    INTO total_profit
    FROM filtered_transactions t,
    LATERAL jsonb_array_elements(t.sale_items) as sale_item
    LEFT JOIN inventory inv ON inv.id = (
        CASE 
            WHEN (sale_item->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            THEN (sale_item->>'id')::UUID 
            ELSE NULL 
        END
    );

    RETURN ROUND(total_profit, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.analytics_total_profit(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_total_profit(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
