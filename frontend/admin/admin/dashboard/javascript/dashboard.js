// Check authentication (Local check for UI purposes)
function checkAuth() {
  const user = localStorage.getItem('user');

  if (!user) {
    window.location.href = '/';
    return null;
  }

  return JSON.parse(user);
}

// Format currency
function formatCurrency(amount) {
  return '₱' + Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

// Update greeting based on time of day and user
function updateGreeting(user) {
  const greetingEl = document.getElementById('greetingUserName');
  const greetingTimeEl = document.getElementById('greetingTimeOfDay');
  const hour = new Date().getHours();
  let timeOfDay = 'Good morning';
  if (hour >= 12 && hour < 18) timeOfDay = 'Good afternoon';
  else if (hour >= 18 || hour < 5) timeOfDay = 'Good evening';

  if (greetingTimeEl) greetingTimeEl.textContent = timeOfDay;
  if (greetingEl && user) {
    const name = user.username || user.email?.split('@')[0] || 'Admin';
    greetingEl.textContent = name;
  }
}

// Update live date in header
function updateLiveDate() {
  const dateEl = document.getElementById('liveDateText');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-PH', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }
}

// Initialize dashboard
function initDashboard() {
  const user = checkAuth();
  if (!user) return;

  // Personalize greeting & live date
  updateGreeting(user);
  updateLiveDate();
  dashboard_store_profile();

  DashboardGoogleConnection.init(user);

  // Load dashboard data
  loadDashboardData();
  
}

// Load dashboard data
async function loadDashboardData() {
  try {
    // Get today's date range (start and end of today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get current month date range (first day of month to today)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    // Format dates for API (ISO string)
    const todayStartISO = today.toISOString();
    const todayEndISO = todayEnd.toISOString();
    const monthStartISO = monthStart.toISOString();
    const [totalProducts, lowStock, todaySales, monthSales, pendingOrders, transactions] = await Promise.all([
      dashboard_total_products(),
      dashboard_low_stock(),
      dashboard_sales_total(todayStartISO, todayEndISO),
      dashboard_sales_total(monthStartISO, todayEndISO),
      dashboard_pending_orders(),
      dashboard_recent_activity()
    ]);
    render_dashboard_total_products(totalProducts);
    render_dashboard_low_stock({ low_stock_count: lowStock.count, low_stock_items: lowStock.items });
    render_dashboard_sales_total(todaySales, monthSales);
    render_dashboard_pending_orders(pendingOrders);
    render_dashboard_recent_activity({ transactions });
    DashboardGoogleConnection.updateStatus();
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    
    dashboard_total_products_unavailable();
    dashboard_low_stock_unavailable();
    dashboard_sales_total_unavailable();
    dashboard_pending_orders_unavailable();
    dashboard_recent_activity_unavailable();
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize sidebar first
  await initSidebar('dashboard');

  // Then initialize dashboard
  initDashboard();

  DashboardQuickOperations.init();
});
