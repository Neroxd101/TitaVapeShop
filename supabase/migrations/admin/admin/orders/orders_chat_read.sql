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
