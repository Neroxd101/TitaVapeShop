BEGIN;
-- Read status belongs to the recipient: customer reads admin messages; store reads customer messages.
ALTER TABLE public.order_chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS order_chat_unread_idx ON public.order_chat_messages(order_id, sender, id) WHERE read_at IS NULL;
NOTIFY pgrst, 'reload schema';

-- Requires order_chat_unread.sql. A read receipt covers only messages already displayed.
CREATE OR REPLACE FUNCTION public.customer_order_chat_read(
    p_order_id UUID, p_through_id BIGINT,
    p_customer_id UUID DEFAULT NULL, p_customer_email VARCHAR(255) DEFAULT NULL,
    p_phone VARCHAR(20) DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    target public.orders%ROWTYPE;
    clean_email TEXT := NULLIF(LOWER(BTRIM(p_customer_email)), '');
    input_digits TEXT := REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
    order_digits TEXT;
BEGIN
    SELECT * INTO target FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    order_digits := REGEXP_REPLACE(COALESCE(target.contact_number, ''), '[^0-9]', '', 'g');
    IF (p_customer_id IS NULL OR target.customer_id IS NULL OR target.customer_id <> p_customer_id)
       AND (clean_email IS NULL OR target.customer_email IS NULL OR LOWER(BTRIM(target.customer_email)) <> clean_email)
       AND (LENGTH(input_digits) <> 11 OR input_digits <> order_digits) THEN
        RAISE EXCEPTION 'You are not authorized to update this order';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.order_chat_messages WHERE order_id = p_order_id AND id = p_through_id AND sender = 'admin') THEN
        RAISE EXCEPTION 'The last displayed message does not belong to this conversation';
    END IF;
    UPDATE public.order_chat_messages SET read_at = NOW()
        WHERE order_id = p_order_id AND sender = 'admin' AND id <= p_through_id AND read_at IS NULL;
    RETURN jsonb_build_object('read_through_id', p_through_id::TEXT, 'read_at', NOW(), 'unread_count',
        (SELECT COUNT(*) FROM public.order_chat_messages WHERE order_id = p_order_id AND sender = 'admin' AND read_at IS NULL));
END;
$$;
REVOKE ALL ON FUNCTION public.customer_order_chat_read(UUID, BIGINT, UUID, VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_order_chat_read(UUID, BIGINT, UUID, VARCHAR, VARCHAR) TO service_role;
NOTIFY pgrst, 'reload schema';

-- Shared store inbox: a staff/admin reader marks customer messages as read for the store.
CREATE OR REPLACE FUNCTION public.orders_chat_read(p_order_id UUID, p_through_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.order_chat_messages WHERE order_id = p_order_id AND id = p_through_id AND sender = 'customer') THEN
        RAISE EXCEPTION 'The last displayed message does not belong to this conversation';
    END IF;
    UPDATE public.order_chat_messages SET read_at = NOW()
        WHERE order_id = p_order_id AND sender = 'customer' AND id <= p_through_id AND read_at IS NULL;
    RETURN jsonb_build_object('read_through_id', p_through_id::TEXT, 'read_at', NOW(), 'unread_count',
        (SELECT COUNT(*) FROM public.order_chat_messages WHERE order_id = p_order_id AND sender = 'customer' AND read_at IS NULL));
END;
$$;
REVOKE ALL ON FUNCTION public.orders_chat_read(UUID, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_chat_read(UUID, BIGINT) TO service_role;
NOTIFY pgrst, 'reload schema';

-- Fetch counts only for displayed rows; no message bodies are returned.
CREATE OR REPLACE FUNCTION public.orders_chat_unread(p_order_ids UUID[])
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSONB;
BEGIN
    IF p_order_ids IS NULL OR CARDINALITY(p_order_ids) > 200 THEN RAISE EXCEPTION 'Up to 200 order IDs are allowed'; END IF;
    SELECT COALESCE(jsonb_object_agg(order_id::TEXT, unread_count), '{}'::JSONB) INTO result
    FROM (SELECT requested.order_id, COUNT(m.id) AS unread_count
        FROM (SELECT DISTINCT UNNEST(p_order_ids) AS order_id) requested
        LEFT JOIN public.order_chat_messages m ON m.order_id = requested.order_id AND m.sender = 'customer' AND m.read_at IS NULL
        GROUP BY requested.order_id) counts;
    RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.orders_chat_unread(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_chat_unread(UUID[]) TO service_role;
NOTIFY pgrst, 'reload schema';

-- =============================================
-- Customer Track Order RPC Function
-- Allows customers or guest orderers (with verified phone) to view order status & details
-- =============================================

DROP FUNCTION IF EXISTS public.customer_track_order(UUID, UUID, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION public.customer_track_order(
    p_order_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_customer_email VARCHAR(255) DEFAULT NULL,
    p_phone VARCHAR(20) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    customer_id UUID,
    customer_name VARCHAR(255),
    contact_number VARCHAR(20),
    customer_email VARCHAR(255),
    order_type VARCHAR(20),
    items JSONB,
    total_amount DECIMAL(10, 2),
    status VARCHAR(50),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    payment_receipt_url TEXT,
    payment_status VARCHAR(50),
    payment_status_reason TEXT,
    delivery_confirmed_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    payment_amount NUMERIC,
    refund_due_amount NUMERIC,
    refunded_amount NUMERIC,
    refunded_at TIMESTAMPTZ,
    chat_messages JSONB
) AS $$
DECLARE
    v_order RECORD;
    v_is_authorized BOOLEAN := FALSE;
    v_clean_email VARCHAR(255);
    v_input_digits VARCHAR(50);
    v_order_digits VARCHAR(50);
BEGIN
    -- 1. Validate order ID
    IF p_order_id IS NULL THEN
        RAISE EXCEPTION 'A valid order ID is required.';
    END IF;

    -- 2. Fetch order
    SELECT * INTO v_order
    FROM public.orders
    WHERE public.orders.id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.';
    END IF;

    -- 3. Verify customer authorization
    v_clean_email := CASE WHEN p_customer_email IS NOT NULL THEN LOWER(TRIM(p_customer_email)) ELSE NULL END;

    -- Check if authenticated customer owns this order
    IF p_customer_id IS NOT NULL AND v_order.customer_id IS NOT NULL AND v_order.customer_id = p_customer_id THEN
        v_is_authorized := TRUE;
    ELSIF v_clean_email IS NOT NULL AND v_order.customer_email IS NOT NULL AND LOWER(TRIM(v_order.customer_email)) = v_clean_email THEN
        v_is_authorized := TRUE;
    END IF;

    -- Check contact phone verification if not yet authorized
    IF NOT v_is_authorized THEN
        IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
            RAISE EXCEPTION 'REQUIRES_PHONE: Please enter the contact number used during checkout to view this order.';
        END IF;

        v_input_digits := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
        v_order_digits := REGEXP_REPLACE(COALESCE(v_order.contact_number, ''), '[^0-9]', '', 'g');

        IF LENGTH(v_input_digits) = 11 AND v_order_digits = v_input_digits THEN
            v_is_authorized := TRUE;
        ELSE
            RAISE EXCEPTION 'The contact number entered does not match this order.';
        END IF;
    END IF;

    -- 4. Return order details
    RETURN QUERY
    SELECT
        v_order.id,
        v_order.customer_id,
        v_order.customer_name,
        v_order.contact_number,
        v_order.customer_email,
        v_order.order_type,
        v_order.items,
        v_order.total_amount,
        v_order.status,
        v_order.created_at,
        v_order.updated_at,
        v_order.payment_method,
        v_order.payment_reference,
        v_order.payment_receipt_url,
        COALESCE(v_order.payment_status, 'unpaid') AS payment_status,
        v_order.payment_status_reason,
        v_order.delivery_confirmed_at,
        v_order.cancellation_reason,
        v_order.payment_amount,
        v_order.refund_due_amount,
        v_order.refunded_amount,
        v_order.refunded_at,
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'id', m.id::TEXT, 'sender', m.sender, 'body', m.body, 'created_at', m.created_at, 'read_at', m.read_at
        ) ORDER BY m.created_at NULLS FIRST, m.id)
        FROM public.order_chat_messages m WHERE m.order_id = v_order.id), '[]'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.customer_track_order(UUID, UUID, VARCHAR, VARCHAR)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_track_order(UUID, UUID, VARCHAR, VARCHAR)
TO service_role;

COMMENT ON FUNCTION public.customer_track_order(UUID, UUID, VARCHAR, VARCHAR) IS
'Retrieves an order after validating customer ownership or an exact full contact-number match.';

-- =============================================
-- Get All Orders Function
-- Retrieves all orders with optional filtering (status, search, dates)
-- 1-to-1 matching RPC for GET /api/orders/get_all
-- =============================================

-- Drop obsolete 4-parameter overload if it exists to avoid PostgREST ambiguity error
DROP FUNCTION IF EXISTS orders_get_all(VARCHAR(50), INTEGER, INTEGER, VARCHAR(255));
DROP FUNCTION IF EXISTS public.orders_get_all(VARCHAR, INTEGER, INTEGER, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.orders_get_all(
    p_status VARCHAR(50) DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_search VARCHAR(255) DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    customer_name VARCHAR(255),
    contact_number VARCHAR(20),
    customer_email VARCHAR(255),
    order_type VARCHAR(20),
    items JSONB,
    total_amount DECIMAL(10, 2),
    status VARCHAR(50),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    payment_receipt_url TEXT,
    payment_status VARCHAR(50),
    void_reason TEXT,
    delivery_confirmed_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    payment_amount NUMERIC,
    refund_due_amount NUMERIC,
    refunded_amount NUMERIC,
    refunded_at TIMESTAMPTZ,
    chat_messages JSONB,
    total_count BIGINT
) AS $$
BEGIN
    IF p_limit < 1 OR p_limit > 200 THEN
        RAISE EXCEPTION 'Limit must be between 1 and 200';
    END IF;
    IF p_offset < 0 THEN
        RAISE EXCEPTION 'Offset cannot be negative';
    END IF;

    RETURN QUERY
    WITH filtered_orders AS (
        SELECT 
            o.id,
            o.customer_name,
            o.contact_number,
            o.customer_email,
            o.order_type,
            o.items,
            o.total_amount,
            o.status,
            o.created_at,
            o.updated_at,
            o.payment_method,
            o.payment_reference,
            o.payment_receipt_url,
            COALESCE(o.payment_status, 'unpaid') AS payment_status,
            (
                SELECT NULLIF(BTRIM(t.details->>'reason'), '')
                FROM transactions t
                WHERE t.action_type = 'sale_void'
                  AND t.entity_type = 'order'
                  AND t.entity_id = o.id
                ORDER BY t.created_at DESC
                LIMIT 1
            ) AS void_reason,
            o.delivery_confirmed_at,
            o.cancellation_reason,
            o.payment_amount,
            o.refund_due_amount,
            o.refunded_amount,
            o.refunded_at,
            COUNT(*) OVER() as total_count
        FROM orders o
        WHERE (p_status IS NULL OR o.status = p_status)
          AND (p_start_date IS NULL OR o.created_at >= p_start_date)
          AND (p_end_date IS NULL OR o.created_at <= p_end_date)
          AND (
              p_search IS NULL 
              OR o.id::text ILIKE '%' || TRIM(LEADING '#' FROM p_search) || '%'
              OR o.customer_name ILIKE '%' || p_search || '%'
              OR o.contact_number ILIKE '%' || p_search || '%'
              OR o.customer_email ILIKE '%' || p_search || '%'
              OR o.items::text ILIKE '%' || p_search || '%'
          )
        ORDER BY o.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    )
    SELECT 
        fo.id,
        fo.customer_name,
        fo.contact_number,
        fo.customer_email,
        COALESCE(fo.order_type, 'pickup') as order_type,
        fo.items,
        fo.total_amount,
        fo.status,
        fo.created_at,
        fo.updated_at,
        fo.payment_method,
        fo.payment_reference,
        fo.payment_receipt_url,
        fo.payment_status,
        fo.void_reason,
        fo.delivery_confirmed_at,
        fo.cancellation_reason,
        fo.payment_amount,
        fo.refund_due_amount,
        fo.refunded_amount,
        fo.refunded_at,
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'id', m.id::TEXT, 'sender', m.sender, 'body', m.body, 'created_at', m.created_at, 'read_at', m.read_at
        ) ORDER BY m.created_at NULLS FIRST, m.id)
        FROM public.order_chat_messages m WHERE m.order_id = fo.id), '[]'::JSONB),
        fo.total_count
    FROM filtered_orders fo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.orders_get_all(VARCHAR, INTEGER, INTEGER, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_get_all(VARCHAR, INTEGER, INTEGER, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
