async function dashboard_sales_total(start_date, end_date) {
  const query = new URLSearchParams({ start_date, end_date });
  const response = await fetch(`/api/dashboard/dashboard_sales_total?${query}`, {
    headers: { Accept: 'application/json' }
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load dashboard data');
  return result.data;
}

function render_dashboard_sales_total(todayAmount, monthAmount) {
  const todayElement = document.getElementById('todaySales');
  const monthElement = document.getElementById('monthSales');
  if (todayElement) todayElement.textContent = formatCurrency(parseFloat(todayAmount || 0));
  if (monthElement) monthElement.textContent = formatCurrency(parseFloat(monthAmount || 0));
}

function dashboard_sales_total_unavailable() {
  for (const id of ['todaySales', 'monthSales']) {
    const element = document.getElementById(id);
    if (element) element.textContent = 'Unavailable';
  }
}
