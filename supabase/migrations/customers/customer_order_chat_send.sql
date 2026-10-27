-- Customer order chat: validates ownership and appends one message.
-- Requires customers/order_chat_history.sql.
DROP FUNCTION IF EXISTS public.customer_order_chat_send(UUID, TEXT, UUID, VARCHAR, VARCHAR);
CREATE OR REPLACE FUNCTION public.customer_order_chat_send(
    p_order_id UUID,
    p_message TEXT,
    p_customer_id UUID DEFAULT NULL,
    p_customer_email VARCHAR(255) DEFAULT NULL,
    p_phone VARCHAR(20) DEFAULT NULL
)
RETURNS SETOF public.order_chat_messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    target public.orders%ROWTYPE;
    clean_email TEXT := NULLIF(LOWER(BTRIM(p_customer_email)), '');
    input_digits TEXT := REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
    order_digits TEXT;
BEGIN
    IF p_message IS NULL OR LENGTH(BTRIM(p_message)) NOT BETWEEN 1 AND 1000 THEN
        RAISE EXCEPTION 'Messages must contain 1–1,000 characters';
    END IF;
    SELECT * INTO target FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    order_digits := REGEXP_REPLACE(COALESCE(target.contact_number, ''), '[^0-9]', '', 'g');
    IF (p_customer_id IS NULL OR target.customer_id IS NULL OR target.customer_id <> p_customer_id)
       AND (clean_email IS NULL OR target.customer_email IS NULL OR LOWER(BTRIM(target.customer_email)) <> clean_email)
       AND (LENGTH(input_digits) <> 11 OR input_digits <> order_digits) THEN
        RAISE EXCEPTION 'You are not authorized to update this order';
    END IF;
    IF target.order_type IS DISTINCT FROM 'delivery' OR target.status IS DISTINCT FROM 'confirmed' THEN
        RAISE EXCEPTION 'Messages can only be sent for confirmed third-party delivery orders';
    END IF;
    RETURN QUERY INSERT INTO public.order_chat_messages(order_id, sender, body, created_at)
        VALUES (target.id, 'customer', BTRIM(p_message), NOW()) RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION public.customer_order_chat_send(UUID, TEXT, UUID, VARCHAR, VARCHAR)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_order_chat_send(UUID, TEXT, UUID, VARCHAR, VARCHAR)
    TO service_role;

NOTIFY pgrst, 'reload schema';
