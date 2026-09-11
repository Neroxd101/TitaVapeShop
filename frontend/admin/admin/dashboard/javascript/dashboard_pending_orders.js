async function dashboard_pending_orders() {
  const response = await fetch('/api/dashboard/dashboard_pending_orders', {
    headers: { Accept: 'application/json' }
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load dashboard data');
  return result.data;
}
