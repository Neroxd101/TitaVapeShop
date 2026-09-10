-- Dashboard metric: server-only access after Express admin authorization.
CREATE OR REPLACE FUNCTION public.dashboard_pending_orders()
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*) FROM public.orders WHERE status = 'pending';
$$;

REVOKE ALL ON FUNCTION public.dashboard_pending_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_pending_orders() TO service_role;

