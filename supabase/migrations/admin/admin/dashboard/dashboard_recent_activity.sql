-- Dashboard metric: server-only access after Express admin authorization.
CREATE OR REPLACE FUNCTION public.dashboard_recent_activity()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC, t.id), '[]'::jsonb)
  FROM (SELECT id, action_type, details, sale_total, sale_items, customer_name, created_at
    FROM public.transactions ORDER BY created_at DESC, id LIMIT 8) t;
$$;

REVOKE ALL ON FUNCTION public.dashboard_recent_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_recent_activity() TO service_role;

