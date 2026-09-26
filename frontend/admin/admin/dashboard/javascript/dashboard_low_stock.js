async function dashboard_low_stock() {
  const response = await fetch('/api/dashboard/dashboard_low_stock', {
    headers: { Accept: 'application/json' }
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load dashboard data');
  return result.data;
}

function render_dashboard_low_stock(data) {
  const lowStockEl = document.getElementById('lowStock');
  const lowStockPillText = document.getElementById('lowStockPillText');
  const lowStockStatusMsg = document.getElementById('lowStockStatusMsg');
  const lowStockWatchList = document.getElementById('lowStockWatchList');

  if (!Array.isArray(data?.low_stock_items)) {
    if (lowStockEl) lowStockEl.textContent = '0';
    if (lowStockWatchList) lowStockWatchList.innerHTML = '<p class="low-stock-empty">No stock warnings available.</p>';
    return;
  }

  const items = data.low_stock_items;
  const count = Number(data.low_stock_count) || 0;
  if (lowStockEl) lowStockEl.textContent = count;

  if (count > 0) {
    if (lowStockPillText) lowStockPillText.textContent = `${count} items low`;
    if (lowStockStatusMsg) lowStockStatusMsg.textContent = `${count} items need restock`;
    if (lowStockWatchList) {
      lowStockWatchList.replaceChildren(...items.slice(0, 5).map(item => {
        const row = document.createElement('div');
        row.className = 'low-stock-row';
        const name = document.createElement('span');
        name.className = 'low-stock-name';
        name.title = item.name || 'Product';
        name.textContent = item.name || 'Product';
        const quantity = document.createElement('span');
        quantity.className = 'low-stock-qty';
        quantity.textContent = `${item.quantity || 0} in stock`;
        row.append(name, quantity);
        return row;
      }));
    }
  } else {
    if (lowStockPillText) lowStockPillText.textContent = 'All Healthy';
    if (lowStockStatusMsg) lowStockStatusMsg.textContent = 'All inventory levels safe';
    if (lowStockWatchList) lowStockWatchList.innerHTML = '<p class="low-stock-empty">✓ All products have healthy stock levels.</p>';
  }
}

function dashboard_low_stock_unavailable() {
  const lowStockEl = document.getElementById('lowStock');
  const lowStockWatchList = document.getElementById('lowStockWatchList');
  if (lowStockEl) lowStockEl.textContent = 'Unavailable';
  if (lowStockWatchList) lowStockWatchList.innerHTML = '<p class="low-stock-empty">No stock warnings available.</p>';
}
