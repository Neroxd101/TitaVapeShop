async function dashboard_total_products() {
  const response = await fetch('/api/dashboard/dashboard_total_products', {
    headers: { Accept: 'application/json' }
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load dashboard data');
  return result.data;
}

function render_dashboard_total_products(total) {
  const element = document.getElementById('totalProducts');
  if (element) element.textContent = Number(total) || 0;
}

function dashboard_total_products_unavailable() {
  const element = document.getElementById('totalProducts');
  if (element) element.textContent = 'Unavailable';
}
