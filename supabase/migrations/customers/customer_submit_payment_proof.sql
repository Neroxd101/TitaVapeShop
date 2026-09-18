-- Ensure payment columns exist before defining the RPC.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';

DROP FUNCTION IF EXISTS public.customer_submit_payment_proof(UUID, VARCHAR, TEXT, VARCHAR);
DROP FUNCTION IF EXISTS public.customer_submit_payment_proof(UUID, VARCHAR, TEXT, UUID, VARCHAR, VARCHAR);

CREATE FUNCTION public.customer_submit_payment_proof(
    p_order_id UUID,
    p_reference VARCHAR(100),
    p_receipt_url TEXT,
    p_customer_id UUID DEFAULT NULL,
    p_customer_email VARCHAR(255) DEFAULT NULL,
    p_phone VARCHAR(20) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target public.orders%ROWTYPE;
    authorized BOOLEAN := FALSE;
    input_phone VARCHAR(20);
    order_phone VARCHAR(20);
    clean_reference VARCHAR(100);
    clean_url TEXT;
BEGIN
    IF p_order_id IS NULL THEN RAISE EXCEPTION 'Order ID is required'; END IF;
    clean_reference := BTRIM(p_reference);
    clean_url := BTRIM(p_receipt_url);
    IF clean_reference IS NULL OR length(clean_reference) NOT BETWEEN 4 AND 100 THEN
        RAISE EXCEPTION 'A valid reference number is required';
    END IF;
    IF clean_url IS NULL OR length(clean_url) > 2000 OR clean_url !~* '^https://[^[:space:]]+$' THEN
        RAISE EXCEPTION 'A valid HTTPS receipt URL is required';
    END IF;

    SELECT * INTO target FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

    IF p_customer_id IS NOT NULL AND target.customer_id = p_customer_id THEN
        authorized := TRUE;
    ELSIF p_customer_email IS NOT NULL
       AND LOWER(BTRIM(target.customer_email)) = LOWER(BTRIM(p_customer_email)) THEN
        authorized := TRUE;
    END IF;

    IF NOT authorized THEN
        input_phone := REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
        order_phone := REGEXP_REPLACE(COALESCE(target.contact_number, ''), '[^0-9]', '', 'g');
        authorized := length(input_phone) = 11 AND input_phone = order_phone;
    END IF;
    IF NOT authorized THEN RAISE EXCEPTION 'You are not authorized to update this order'; END IF;

    IF target.order_type <> 'delivery' OR target.status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION 'Payment proof cannot be submitted for this order';
    END IF;
    IF COALESCE(target.payment_status, 'unpaid') NOT IN ('unpaid', 'rejected') THEN
        RAISE EXCEPTION 'Payment proof is already awaiting verification or has been paid';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.orders
        WHERE LOWER(BTRIM(payment_reference)) = LOWER(clean_reference)
          AND id <> target.id
          AND status NOT IN ('cancelled', 'voided')
          AND COALESCE(payment_status, 'unpaid') <> 'rejected'
    ) THEN
        RAISE EXCEPTION 'This reference number has already been used';
    END IF;

    UPDATE public.orders
    SET payment_reference = clean_reference,
        payment_receipt_url = clean_url,
        payment_status = 'pending_verification',
        payment_method = 'gcash',
        updated_at = NOW()
    WHERE id = target.id;

    PERFORM public.transactions_log(
        p_action_type => 'order_payment_update',
        p_user_email => COALESCE(target.customer_email, 'Customer'),
        p_entity_id => target.id,
        p_entity_type => 'order',
        p_customer_name => target.customer_name,
        p_customer_email => target.customer_email,
        p_details => jsonb_build_object(
            'order_id', target.id,
            'previous_payment_status', COALESCE(target.payment_status, 'unpaid'),
            'new_payment_status', 'pending_verification',
            'submitted_by', 'customer'
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', target.id,
        'payment_status', 'pending_verification',
        'payment_reference', clean_reference,
        'payment_receipt_url', clean_url
    );
END;
$$;

REVOKE ALL ON FUNCTION public.customer_submit_payment_proof(UUID, VARCHAR, TEXT, UUID, VARCHAR, VARCHAR)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_submit_payment_proof(UUID, VARCHAR, TEXT, UUID, VARCHAR, VARCHAR)
TO service_role;
