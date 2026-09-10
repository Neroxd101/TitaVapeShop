-- Dashboard metric: server-only access after Express admin authorization.
CREATE OR REPLACE FUNCTION public.dashboard_total_products()
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*) FROM public.inventory;
$$;

REVOKE ALL ON FUNCTION public.dashboard_total_products() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_total_products() TO service_role;

