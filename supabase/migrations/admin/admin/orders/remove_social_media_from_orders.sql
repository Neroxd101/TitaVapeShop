-- ========================================================
-- Migration: Remove Unused social_media Column from Orders
-- ========================================================

-- 1. Drop the unused social_media column from orders table
ALTER TABLE public.orders DROP COLUMN IF EXISTS social_media;

-- ========================================================
-- 2. Drop existing functions whose return types/parameters are changing
-- Note: PostgreSQL requires dropping functions when table return types change
-- ========================================================

DROP FUNCTION IF EXISTS public.orders_create_order(VARCHAR, VARCHAR, JSONB, DECIMAL, VARCHAR, TEXT, VARCHAR);
DROP FUNCTION IF EXISTS public.orders_create_order(VARCHAR, VARCHAR, JSONB, NUMERIC, VARCHAR, TEXT, VARCHAR);
DROP FUNCTION IF EXISTS public.orders_create_order;

DROP FUNCTION IF EXISTS public.customer_create_order(UUID, VARCHAR, VARCHAR, JSONB, DECIMAL, VARCHAR, TEXT, VARCHAR);
DROP FUNCTION IF EXISTS public.customer_create_order(UUID, VARCHAR, VARCHAR, JSONB, NUMERIC, VARCHAR, TEXT, VARCHAR);
DROP FUNCTION IF EXISTS public.customer_create_order;

DROP FUNCTION IF EXISTS public.orders_get_all(VARCHAR, INTEGER, INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS public.orders_get_all;

DROP FUNCTION IF EXISTS public.orders_update_status(UUID, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.orders_update_status;

DROP FUNCTION IF EXISTS public.customer_track_order(UUID, UUID, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.customer_track_order;

DROP FUNCTION IF EXISTS public.customer_cancel_order(UUID, UUID, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.customer_cancel_order;

-- ========================================================
-- 3. Recreate orders_create_order without social_media
-- ========================================================

CREATE OR REPLACE FUNCTION public.orders_create_order(
    p_customer_name VARCHAR(255),
    p_contact_number VARCHAR(20),
    p_items JSONB,
    p_total_amount DECIMAL(10, 2),
    p_order_type VARCHAR(20) DEFAULT 'pickup',
    p_customer_email VARCHAR(255) DEFAULT NULL
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
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    new_order RECORD;
BEGIN
    -- Validate required fields
    IF p_customer_name IS NULL OR TRIM(p_customer_name) = '' THEN
        RAISE EXCEPTION 'Customer name is required';
    END IF;

    IF p_contact_number IS NULL OR TRIM(p_contact_number) = '' THEN
        RAISE EXCEPTION 'Contact number is required';
    END IF;

    -- Validate contact number format (11 digits)
    IF LENGTH(REGEXP_REPLACE(p_contact_number, '[^0-9]', '', 'g')) != 11 THEN
        RAISE EXCEPTION 'Contact number must be 11 digits';
    END IF;

    -- Validate order type
    IF p_order_type NOT IN ('pickup', 'delivery') THEN
        RAISE EXCEPTION 'Order type must be either "pickup" or "delivery"';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
        RAISE EXCEPTION 'Total amount must be greater than 0';
    END IF;

    -- Insert order
    INSERT INTO public.orders (
        customer_name,
        contact_number,
        customer_email,
        order_type,
        items,
        total_amount,
        status
    ) VALUES (
        TRIM(p_customer_name),
        TRIM(p_contact_number),
        CASE WHEN p_customer_email IS NOT NULL THEN TRIM(p_customer_email) ELSE NULL END,
        p_order_type,
        p_items,
        p_total_amount,
        'pending'
    )
    RETURNING * INTO new_order;

    -- Return the created order
    RETURN QUERY
    SELECT
        new_order.id,
        new_order.customer_name,
        new_order.contact_number,
        new_order.customer_email,
        new_order.order_type,
        new_order.items,
        new_order.total_amount,
        new_order.status,
        new_order.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================
-- 4. Recreate customer_create_order without social_media
-- ========================================================

CREATE OR REPLACE FUNCTION public.customer_create_order(
    p_customer_id UUID,
    p_customer_name VARCHAR(255),
    p_contact_number VARCHAR(20),
    p_items JSONB,
    p_total_amount DECIMAL(10, 2),
    p_order_type VARCHAR(20) DEFAULT 'pickup',
    p_customer_email VARCHAR(255) DEFAULT NULL
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
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    new_order RECORD;
    v_clean_name VARCHAR(255);
    v_clean_contact VARCHAR(20);
    v_clean_email VARCHAR(255);
BEGIN
    v_clean_name := TRIM(p_customer_name);
    v_clean_contact := TRIM(p_contact_number);
    v_clean_email := CASE WHEN p_customer_email IS NOT NULL THEN LOWER(TRIM(p_customer_email)) ELSE NULL END;

    -- Validation
    IF v_clean_name IS NULL OR v_clean_name = '' THEN
        RAISE EXCEPTION 'Customer name is required';
    END IF;

    IF v_clean_contact IS NULL OR v_clean_contact = '' THEN
        RAISE EXCEPTION 'Contact number is required';
    END IF;

    IF LENGTH(REGEXP_REPLACE(v_clean_contact, '[^0-9]', '', 'g')) != 11 THEN
        RAISE EXCEPTION 'Contact number must be exactly 11 digits';
    END IF;

    IF p_order_type NOT IN ('pickup', 'delivery') THEN
        RAISE EXCEPTION 'Order type must be either "pickup" or "delivery"';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
        RAISE EXCEPTION 'Total amount must be greater than 0';
    END IF;

    -- Insert order with customer_id explicitly linked
    INSERT INTO public.orders (
        customer_id,
        customer_name,
        contact_number,
        customer_email,
        order_type,
        items,
        total_amount,
        status
    ) VALUES (
        p_customer_id,
        v_clean_name,
        v_clean_contact,
        v_clean_email,
        p_order_type,
        p_items,
        p_total_amount,
        'pending'
    )
    RETURNING * INTO new_order;

    RETURN QUERY
    SELECT
        new_order.id,
        new_order.customer_id,
        new_order.customer_name,
        new_order.contact_number,
        new_order.customer_email,
        new_order.order_type,
        new_order.items,
        new_order.total_amount,
        new_order.status,
        new_order.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================
-- 5. Recreate orders_get_all without social_media
-- ========================================================

CREATE OR REPLACE FUNCTION public.orders_get_all(
    p_status VARCHAR(50) DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_search VARCHAR(255) DEFAULT NULL
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
    total_count BIGINT
) AS $$
BEGIN
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
            COUNT(*) OVER() as total_count
        FROM public.orders o
        WHERE (p_status IS NULL OR o.status = p_status)
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
        fo.total_count
    FROM filtered_orders fo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================
-- 6. Recreate orders_update_status without social_media
-- ========================================================

CREATE OR REPLACE FUNCTION public.orders_update_status(
    p_order_id UUID,
    p_status VARCHAR(50),
    p_user_email VARCHAR(255) DEFAULT NULL
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
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    updated_order RECORD;
    current_status VARCHAR(50);
    order_items JSONB;
    order_customer_name VARCHAR(255);
    order_customer_email VARCHAR(255);
    order_total_amount DECIMAL(10,2);
    order_type VARCHAR(20);
    item_record JSONB;
    item_id UUID;
    item_qty INTEGER;
    item_price DECIMAL(10,2);
    sale_items_formatted JSONB;
    sale_item_formatted JSONB;
BEGIN
    -- Validate status
    IF p_status NOT IN ('pending', 'confirmed', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status. Must be pending, confirmed, completed, or cancelled';
    END IF;

    -- Get current order details
    SELECT 
        o.status, 
        o.items, 
        o.customer_name, 
        o.customer_email, 
        o.total_amount, 
        o.order_type
    INTO 
        current_status, 
        order_items, 
        order_customer_name, 
        order_customer_email, 
        order_total_amount, 
        order_type
    FROM public.orders o
    WHERE o.id = p_order_id;

    IF current_status IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Prevent modifying completed or cancelled orders
    IF current_status IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot update order that is already %', current_status;
    END IF;

    -- If status is changing to 'completed', deduct inventory and record sale
    IF p_status = 'completed' AND current_status != 'completed' THEN
        -- Verify items exist
        IF order_items IS NULL OR jsonb_array_length(order_items) = 0 THEN
            RAISE EXCEPTION 'Order has no items to process';
        END IF;

        -- Initialize formatted items array for sales table
        sale_items_formatted := '[]'::JSONB;

        -- Loop through order items and deduct inventory
        FOR item_record IN SELECT * FROM jsonb_array_elements(order_items)
        LOOP
            item_id := (item_record->>'id')::UUID;
            item_qty := (item_record->>'quantity')::INTEGER;
            item_price := COALESCE((item_record->>'price')::DECIMAL(10,2), 0);

            -- Validate item exists and has enough stock
            IF NOT EXISTS (
                SELECT 1 FROM public.inventory 
                WHERE public.inventory.id = item_id AND public.inventory.quantity >= item_qty
            ) THEN
                RAISE EXCEPTION 'Insufficient stock for item % (need %, available less)', 
                    COALESCE(item_record->>'name', item_id::TEXT), item_qty;
            END IF;

            -- Deduct stock from inventory
            UPDATE public.inventory
            SET 
                quantity = quantity - item_qty,
                updated_at = NOW()
            WHERE public.inventory.id = item_id;

            -- Format item for sales table
            sale_item_formatted := jsonb_build_object(
                'id', item_id,
                'name', item_record->>'name',
                'category', item_record->>'category',
                'price', item_price,
                'quantity', item_qty,
                'subtotal', item_price * item_qty
            );
            sale_items_formatted := sale_items_formatted || jsonb_build_array(sale_item_formatted);
        END LOOP;

        -- Record sale in sales table
        INSERT INTO public.sales (
            items,
            total_amount,
            payment_method,
            notes,
            created_at
        ) VALUES (
            sale_items_formatted,
            order_total_amount,
            'Cash',
            'Order #' || SUBSTRING(p_order_id::TEXT, 1, 8) || ' (' || order_type || ') - Customer: ' || order_customer_name || ' (Processed by ' || COALESCE(p_user_email, 'system') || ')',
            NOW()
        );

        -- Log transaction
        PERFORM public.transactions_log(
            p_action_type := 'SALE',
            p_entity_id := p_order_id,
            p_entity_type := 'order',
            p_user_email := COALESCE(p_user_email, 'system'),
            p_sale_total := order_total_amount,
            p_sale_items := sale_items_formatted,
            p_customer_name := order_customer_name,
            p_customer_email := order_customer_email,
            p_details := jsonb_build_object(
                'order_id', p_order_id,
                'order_type', order_type,
                'action', 'order_completed',
                'items_count', jsonb_array_length(order_items),
                'total_amount', order_total_amount
            )
        );
    END IF;

    -- Update order status
    UPDATE public.orders o
    SET 
        status = p_status,
        updated_at = NOW()
    WHERE o.id = p_order_id
    RETURNING 
        o.id,
        o.customer_name,
        o.contact_number,
        o.customer_email,
        o.order_type,
        o.items,
        o.total_amount,
        o.status,
        o.created_at,
        o.updated_at
    INTO updated_order;

    -- Check if order was found
    IF updated_order.id IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Return the updated order
    RETURN QUERY
    SELECT
        updated_order.id,
        updated_order.customer_name,
        updated_order.contact_number,
        updated_order.customer_email,
        updated_order.order_type,
        updated_order.items,
        updated_order.total_amount,
        updated_order.status,
        updated_order.created_at,
        updated_order.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================
-- 7. Recreate customer_track_order without social_media
-- ========================================================

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
    updated_at TIMESTAMPTZ
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

        IF LENGTH(v_input_digits) >= 4 AND (
            v_order_digits = v_input_digits OR 
            RIGHT(v_order_digits, LENGTH(v_input_digits)) = v_input_digits
        ) THEN
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
        v_order.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.customer_track_order IS 'Retrieves order details for an order after validating authenticated customer session or contact phone match.';

-- ========================================================
-- 8. Recreate customer_cancel_order without social_media
-- ========================================================

CREATE OR REPLACE FUNCTION public.customer_cancel_order(
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
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_order RECORD;
    v_is_authorized BOOLEAN := FALSE;
    v_clean_email VARCHAR(255);
    v_input_digits VARCHAR(50);
    v_order_digits VARCHAR(50);
    v_updated_order RECORD;
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

    -- 3. Verify order status allows cancellation
    IF v_order.status != 'pending' THEN
        RAISE EXCEPTION 'Only pending orders can be cancelled. Current status is %', v_order.status;
    END IF;

    -- 4. Verify customer authorization
    v_clean_email := CASE WHEN p_customer_email IS NOT NULL THEN LOWER(TRIM(p_customer_email)) ELSE NULL END;

    IF p_customer_id IS NOT NULL AND v_order.customer_id IS NOT NULL AND v_order.customer_id = p_customer_id THEN
        v_is_authorized := TRUE;
    ELSIF v_clean_email IS NOT NULL AND v_order.customer_email IS NOT NULL AND LOWER(TRIM(v_order.customer_email)) = v_clean_email THEN
        v_is_authorized := TRUE;
    END IF;

    IF NOT v_is_authorized THEN
        IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
            RAISE EXCEPTION 'REQUIRES_PHONE: Please enter the contact number used during checkout to cancel this order.';
        END IF;

        v_input_digits := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
        v_order_digits := REGEXP_REPLACE(COALESCE(v_order.contact_number, ''), '[^0-9]', '', 'g');

        IF LENGTH(v_input_digits) >= 4 AND (
            v_order_digits = v_input_digits OR 
            RIGHT(v_order_digits, LENGTH(v_input_digits)) = v_input_digits
        ) THEN
            v_is_authorized := TRUE;
        ELSE
            RAISE EXCEPTION 'The contact number entered does not match this order.';
        END IF;
    END IF;

    -- 5. Cancel order
    UPDATE public.orders
    SET 
        status = 'cancelled',
        updated_at = NOW()
    WHERE public.orders.id = p_order_id
      AND public.orders.status = 'pending'
    RETURNING * INTO v_updated_order;

    IF v_updated_order.id IS NULL THEN
        RAISE EXCEPTION 'Failed to cancel order or order status changed.';
    END IF;

    -- Optional: Log transaction
    BEGIN
        PERFORM public.transactions_log(
            p_action_type => 'ORDER_CANCELLED',
            p_entity_id => v_updated_order.id,
            p_entity_type => 'order',
            p_sale_total => v_updated_order.total_amount,
            p_sale_items => v_updated_order.items,
            p_customer_name => v_updated_order.customer_name,
            p_customer_email => v_updated_order.customer_email,
            p_details => jsonb_build_object(
                'order_id', v_updated_order.id,
                'order_type', v_updated_order.order_type,
                'previous_status', 'pending',
                'cancelled_by', 'customer',
                'items_count', CASE WHEN jsonb_typeof(v_updated_order.items) = 'array' THEN jsonb_array_length(v_updated_order.items) ELSE 0 END
            )
        );
    EXCEPTION WHEN OTHERS THEN
        -- Fail silently on audit logging error so cancellation is not blocked
        NULL;
    END;

    -- 6. Return updated order
    RETURN QUERY
    SELECT
        v_updated_order.id,
        v_updated_order.customer_id,
        v_updated_order.customer_name,
        v_updated_order.contact_number,
        v_updated_order.customer_email,
        v_updated_order.order_type,
        v_updated_order.items,
        v_updated_order.total_amount,
        v_updated_order.status,
        v_updated_order.created_at,
        v_updated_order.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
