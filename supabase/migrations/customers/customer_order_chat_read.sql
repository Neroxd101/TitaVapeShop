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
