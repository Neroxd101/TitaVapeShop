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
