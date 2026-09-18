-- Customer checkout. The database owns customer identity, product prices,
-- order lines, totals, and initial payment state.
DROP FUNCTION IF EXISTS public.customer_create_order(UUID, VARCHAR, VARCHAR, JSONB, DECIMAL, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.customer_create_order(UUID, JSONB, VARCHAR);

CREATE FUNCTION public.customer_create_order(
    p_customer_id UUID,
    p_items JSONB,
    p_order_type VARCHAR(20) DEFAULT 'pickup'
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    customer_record public.customers%ROWTYPE;
    requested RECORD;
    product public.inventory%ROWTYPE;
    official_items JSONB := '[]'::jsonb;
    official_total DECIMAL(10,2) := 0;
BEGIN
    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Customer account is required';
    END IF;
    IF p_order_type NOT IN ('pickup', 'delivery') THEN
        RAISE EXCEPTION 'Order type must be pickup or delivery';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    SELECT * INTO customer_record
    FROM public.customers
    WHERE id = p_customer_id;

    IF NOT FOUND OR customer_record.is_verified IS NOT TRUE THEN
        RAISE EXCEPTION 'A verified customer account is required';
    END IF;

    FOR requested IN
        SELECT (value->>'id')::UUID AS id,
               SUM((value->>'quantity')::INTEGER)::INTEGER AS quantity
        FROM jsonb_array_elements(p_items)
        GROUP BY (value->>'id')::UUID
        ORDER BY (value->>'id')::UUID
    LOOP
        IF requested.id IS NULL OR requested.quantity IS NULL OR requested.quantity <= 0 THEN
            RAISE EXCEPTION 'Every order item requires a valid id and positive quantity';
        END IF;

        SELECT * INTO product
        FROM public.inventory
        WHERE id = requested.id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % was not found', requested.id;
        END IF;
        IF product.quantity < requested.quantity THEN
            RAISE EXCEPTION 'Not enough stock for %. Available: %', product.name, product.quantity;
        END IF;

        official_items := official_items || jsonb_build_array(jsonb_build_object(
            'id', product.id,
            'name', product.name,
            'quantity', requested.quantity,
            'price', product.sale_price,
            'category', product.category,
            'images', COALESCE(product.images, '[]'::jsonb)
        ));
        official_total := official_total + (product.sale_price * requested.quantity);
    END LOOP;

    RETURN QUERY
    INSERT INTO public.orders (
        customer_id, customer_name, contact_number, customer_email,
        order_type, items, total_amount, status,
        payment_method, payment_status
    ) VALUES (
        customer_record.id, customer_record.full_name, customer_record.contact_number,
        LOWER(customer_record.email), p_order_type, official_items, official_total, 'pending',
        CASE WHEN p_order_type = 'delivery' THEN 'gcash' ELSE 'cash' END,
        'unpaid'
    )
    RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_create_order(UUID, JSONB, VARCHAR)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_create_order(UUID, JSONB, VARCHAR)
TO service_role;
