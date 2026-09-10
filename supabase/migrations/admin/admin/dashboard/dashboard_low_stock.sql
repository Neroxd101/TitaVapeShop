-- Dashboard metric: server-only access after Express admin authorization.
CREATE OR REPLACE FUNCTION public.dashboard_low_stock()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'count', (SELECT count(*) FROM public.inventory WHERE quantity <= 10 OR quantity IS NULL),
    'items', (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.created_at DESC, i.id), '[]'::jsonb)
      FROM (SELECT id, name, quantity, created_at FROM public.inventory
        WHERE quantity <= 10 OR quantity IS NULL
        ORDER BY created_at DESC, id LIMIT 4) i)
  );
$$;

REVOKE ALL ON FUNCTION public.dashboard_low_stock() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_low_stock() TO service_role;

