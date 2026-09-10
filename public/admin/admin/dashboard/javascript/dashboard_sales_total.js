async function dashboard_sales_total(start_date, end_date) {
  const query = new URLSearchParams({ start_date, end_date });
  const response = await fetch(`/api/dashboard/dashboard_sales_total?${query}`, {
    headers: { Accept: 'application/json' }
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load dashboard data');
  return result.data;
}
