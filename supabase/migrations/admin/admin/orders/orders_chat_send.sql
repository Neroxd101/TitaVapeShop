-- Admin order chat: appends one message. Called by the admin-only API route.
-- Requires customers/order_chat_history.sql.
DROP FUNCTION IF EXISTS public.orders_chat_send(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.orders_chat_send(p_order_id UUID, p_message TEXT)
RETURNS SETOF public.order_chat_messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE target public.orders%ROWTYPE;
BEGIN
    IF p_message IS NULL OR LENGTH(BTRIM(p_message)) NOT BETWEEN 1 AND 1000 THEN
        RAISE EXCEPTION 'Messages must contain 1–1,000 characters';
    END IF;
    SELECT * INTO target FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND OR target.order_type IS DISTINCT FROM 'delivery' OR target.status IS DISTINCT FROM 'confirmed' THEN
        RAISE EXCEPTION 'Messages can only be sent for confirmed third-party delivery orders';
    END IF;
    RETURN QUERY INSERT INTO public.order_chat_messages(order_id, sender, body, created_at)
        VALUES (target.id, 'admin', BTRIM(p_message), NOW()) RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION public.orders_chat_send(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_chat_send(UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
