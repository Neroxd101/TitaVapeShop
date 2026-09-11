async function dashboard_total_products() {
  const response = await fetch('/api/dashboard/dashboard_total_products', {
    headers: { Accept: 'application/json' }
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load dashboard data');
  return result.data;
}
