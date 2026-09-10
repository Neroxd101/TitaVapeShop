-- Dashboard metric: server-only access after Express admin authorization.
CREATE OR REPLACE FUNCTION public.dashboard_sales_total(p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce(sum(sale_total), 0) FROM public.transactions
  WHERE action_type IN ('sale_complete', 'sale_void')
    AND created_at >= p_start_date AND created_at <= p_end_date;
$$;

REVOKE ALL ON FUNCTION public.dashboard_sales_total(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_sales_total(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

