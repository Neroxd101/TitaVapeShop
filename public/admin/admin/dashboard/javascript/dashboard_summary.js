async function dashboard_summary(start_date, end_date, month_start) {
  const query = new URLSearchParams({ start_date, end_date, month_start });
  const response = await fetch(`/api/dashboard/dashboard_summary?${query}`, {
    headers: { Accept: 'application/json' }
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load dashboard data');
  return result.data;
}
