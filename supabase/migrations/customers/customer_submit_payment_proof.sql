-- Ensure columns exist in orders table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_method') THEN
        ALTER TABLE public.orders ADD COLUMN payment_method VARCHAR(50) DEFAULT 'cash';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_reference') THEN
        ALTER TABLE public.orders ADD COLUMN payment_reference VARCHAR(100) DEFAULT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_receipt_url') THEN
        ALTER TABLE public.orders ADD COLUMN payment_receipt_url TEXT DEFAULT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_status') THEN
        ALTER TABLE public.orders ADD COLUMN payment_status VARCHAR(50) DEFAULT 'unpaid';
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION customer_submit_payment_proof(
    p_order_id UUID,
    p_reference VARCHAR(100),
    p_receipt_url TEXT,
    p_phone VARCHAR(20) DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_input_digits VARCHAR(50);
    v_order_digits VARCHAR(50);
BEGIN
    IF p_order_id IS NULL THEN
        RAISE EXCEPTION 'Order ID is required';
    END IF;

    SELECT * INTO v_order 
    FROM public.orders 
    WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Verify phone match if supplied
    IF p_phone IS NOT NULL AND TRIM(p_phone) != '' THEN
        v_input_digits := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
        v_order_digits := REGEXP_REPLACE(COALESCE(v_order.contact_number, ''), '[^0-9]', '', 'g');
        IF LENGTH(v_input_digits) >= 4 AND (
            v_order_digits != v_input_digits AND 
            RIGHT(v_order_digits, LENGTH(v_input_digits)) != v_input_digits
        ) THEN
            RAISE EXCEPTION 'Contact number does not match this order.';
        END IF;
    END IF;

    -- Check if reference number has already been used by another active order
    IF EXISTS (
        SELECT 1 FROM public.orders 
        WHERE LOWER(TRIM(payment_reference)) = LOWER(TRIM(p_reference))
          AND id != p_order_id
          AND status NOT IN ('cancelled', 'voided')
          AND payment_status NOT IN ('rejected')
    ) THEN
        RAISE EXCEPTION 'This reference number has already been used for another order. Please enter a valid reference number.';
    END IF;

    UPDATE public.orders
    SET
        payment_reference = TRIM(p_reference),
        payment_receipt_url = TRIM(p_receipt_url),
        payment_status = 'pending_verification',
        payment_method = 'gcash',
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'order_id', p_order_id,
        'payment_status', 'pending_verification',
        'payment_reference', TRIM(p_reference),
        'payment_receipt_url', TRIM(p_receipt_url)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION customer_submit_payment_proof IS '1-to-1 RPC for POST /api/customer/orders/submit-payment to record GCash proof and mark payment pending verification';
