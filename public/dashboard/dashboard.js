// Check authentication (Local check for UI purposes)
function checkAuth() {
  const user = localStorage.getItem('user');

  if (!user) {
    window.location.href = '/';
    return null;
  }

  return JSON.parse(user);
}

// Logout function
function logout() {
  if (typeof handleLogout === 'function') {
    handleLogout();
  } else {
    localStorage.clear();
    window.location.href = '/';
  }
}

// Format currency
function formatCurrency(amount) {
  return '₱' + Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

// Format date
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Check if Google is connected
function isGoogleConnected() {
  return localStorage.getItem('google_connected') === 'true';
}

// Show Google connect modal for admin
function showGoogleConnectModal() {
  const modal = document.getElementById('googleConnectModal');
  if (modal) {
    modal.classList.add('show');
  }
}

// Close Google connect modal
function closeGoogleConnectModal() {
  const modal = document.getElementById('googleConnectModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Redirect to settings for Google OAuth flow
function connectGoogleAccount() {
  window.location.href = '/settings';
}

// Initialize dashboard
function initDashboard() {
  const user = checkAuth();
  if (!user) return;

  // User info is now set by sidebar.js

  // Check if admin needs to connect Google
  // Show modal after a brief delay to ensure DOM is ready
  const roles = user.roles || [];
  if (roles.includes('admin') && !isGoogleConnected()) {
    setTimeout(() => {
      showGoogleConnectModal();
    }, 500);
  }

  // Google connection status in header is handled by HeaderStatus

  // Load dashboard data
  loadDashboardData();
  
  // Load recent activity
  loadRecentActivity();
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
    const monthEndISO = todayEnd.toISOString();

    // Fetch all data in parallel
    const [inventoryResponse, todayStatsResponse, monthStatsResponse] = await Promise.all([
      // Get all inventory items
      fetch('/inventory/inventory_get_all'),
      // Get today's sales stats
      fetch(`/transactions/transactions_get_stats?start_date=${encodeURIComponent(todayStartISO)}&end_date=${encodeURIComponent(todayEndISO)}`),
      // Get this month's sales stats
      fetch(`/transactions/transactions_get_stats?start_date=${encodeURIComponent(monthStartISO)}&end_date=${encodeURIComponent(monthEndISO)}`)
    ]);

    // Parse responses
    const inventoryData = await inventoryResponse.json();
    const todayStatsData = await todayStatsResponse.json();
    const monthStatsData = await monthStatsResponse.json();

    // Get DOM elements
    const totalProductsEl = document.getElementById('totalProducts');
    const todaySalesEl = document.getElementById('todaySales');
    const lowStockEl = document.getElementById('lowStock');
    const monthSalesEl = document.getElementById('monthSales');

    // Calculate total products
    if (inventoryData.success && inventoryData.data) {
      const totalProducts = inventoryData.data.length;
      if (totalProductsEl) totalProductsEl.textContent = totalProducts;

      // Calculate low stock items (quantity <= 10)
      const lowStockCount = inventoryData.data.filter(item => item.quantity <= 10).length;
      if (lowStockEl) lowStockEl.textContent = lowStockCount;
    } else {
      if (totalProductsEl) totalProductsEl.textContent = '0';
      if (lowStockEl) lowStockEl.textContent = '0';
    }

    // Get today's sales
    if (todayStatsData.success && todayStatsData.stats) {
      const todaySalesAmount = parseFloat(todayStatsData.stats.total_sales_amount || 0);
      if (todaySalesEl) todaySalesEl.textContent = formatCurrency(todaySalesAmount);
    } else {
      if (todaySalesEl) todaySalesEl.textContent = formatCurrency(0);
    }

    // Get this month's sales
    if (monthStatsData.success && monthStatsData.stats) {
      const monthSalesAmount = parseFloat(monthStatsData.stats.total_sales_amount || 0);
      if (monthSalesEl) monthSalesEl.textContent = formatCurrency(monthSalesAmount);
    } else {
      if (monthSalesEl) monthSalesEl.textContent = formatCurrency(0);
    }
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    
    // Set default values on error
    const totalProducts = document.getElementById('totalProducts');
    const todaySales = document.getElementById('todaySales');
    const lowStock = document.getElementById('lowStock');
    const monthSales = document.getElementById('monthSales');

    if (totalProducts) totalProducts.textContent = '0';
    if (todaySales) todaySales.textContent = formatCurrency(0);
    if (lowStock) lowStock.textContent = '0';
    if (monthSales) monthSales.textContent = formatCurrency(0);
  }
}

// Load recent activity
async function loadRecentActivity() {
  try {
    // Fetch recent transactions (last 10)
    const response = await fetch('/transactions/transactions_get_all?limit=10&offset=0');
    const result = await response.json();

    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    if (!result.transactions || result.transactions.length === 0) {
      activityList.innerHTML = '<div class="activity-empty"><p>No recent activity</p></div>';
      return;
    }

    // Clear existing content
    activityList.innerHTML = '';

    // Render each activity item
    result.transactions.forEach(transaction => {
      const activityItem = createActivityItem(transaction);
      activityList.appendChild(activityItem);
    });
  } catch (error) {
    console.error('Error loading recent activity:', error);
    const activityList = document.getElementById('activityList');
    if (activityList) {
      activityList.innerHTML = '<div class="activity-empty"><p>Error loading activity</p></div>';
    }
  }
}

// Create activity item element
function createActivityItem(transaction) {
  const item = document.createElement('div');
  item.className = 'activity-item';

  const icon = getActivityIcon(transaction.action_type);
  const title = getActivityTitle(transaction);
  const time = formatActivityTime(transaction.created_at);

  item.innerHTML = `
    <div class="activity-icon">
      ${icon}
    </div>
    <div class="activity-details">
      <div class="activity-title">${title}</div>
      <div class="activity-time">${time}</div>
    </div>
  `;

  return item;
}

// Get icon SVG for activity type
function getActivityIcon(actionType) {
  const icons = {
    'sale_complete': `
      <svg viewBox="0 0 24 24">
        <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
      </svg>
    `,
    'inventory_add': `
      <svg viewBox="0 0 24 24">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
      </svg>
    `,
    'inventory_edit': `
      <svg viewBox="0 0 24 24">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
      </svg>
    `,
    'inventory_delete': `
      <svg viewBox="0 0 24 24">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
      </svg>
    `
  };

  return icons[actionType] || `
    <svg viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  `;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Get activity title text
function getActivityTitle(transaction) {
  const d = transaction.details || {};

  if (transaction.action_type === 'sale_complete') {
    const items = transaction.sale_items || [];
    const itemCount = items.reduce((sum, i) => sum + (i.qty || 0), 0);
    const customerName = escapeHtml(transaction.customer_name || 'Walk-in');
    const amount = transaction.sale_total ? formatCurrency(transaction.sale_total) : '';
    return `Sold ${itemCount} items to ${customerName}${amount ? ` - ${amount}` : ''}`;
  }

  if (transaction.action_type === 'inventory_add') {
    const name = escapeHtml(d.name || 'Item');
    const quantity = d.quantity || 0;
    return `Added "${name}" (${quantity} qty)`;
  }

  if (transaction.action_type === 'inventory_edit') {
    const itemName = escapeHtml(d.new?.name || d.old?.name || 'Item');
    return `Edited "${itemName}"`;
  }

  if (transaction.action_type === 'inventory_delete') {
    const name = escapeHtml(d.name || 'Item');
    return `Deleted "${name}"`;
  }

  return 'Activity';
}

// Format activity time
function formatActivityTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  // For older items, show date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

// Toggle sidebar on mobile
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');

  if (sidebar) {
    sidebar.classList.toggle('open');
  }

  if (overlay) {
    overlay.classList.toggle('show');
  }
}

// Quick Actions Handlers
function setupQuickActions() {
  // Add Product - Navigate to inventory and trigger add modal
  const addProductBtn = document.getElementById('quickActionAddProduct');
  if (addProductBtn) {
    addProductBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Store flag to open modal after navigation
      sessionStorage.setItem('openAddItemModal', 'true');
      window.location.href = '/inventory';
    });
  }

  // New Sale - Navigate to sales page
  const newSaleBtn = document.getElementById('quickActionNewSale');
  if (newSaleBtn) {
    newSaleBtn.addEventListener('click', (e) => {
      // Let default link behavior work (navigate to /sales)
      // No preventDefault needed
    });
  }

  // View Reports - Navigate to analytics
  const viewReportsBtn = document.getElementById('quickActionViewReports');
  if (viewReportsBtn) {
    viewReportsBtn.addEventListener('click', (e) => {
      // Let default link behavior work (navigate to /analytics)
      // No preventDefault needed
    });
  }

  // Orders - Navigate to orders page
  const ordersBtn = document.getElementById('quickActionSearchStock');
  if (ordersBtn) {
    ordersBtn.addEventListener('click', (e) => {
      // Let default link behavior work (navigate to /orders)
      // No preventDefault needed
    });
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize sidebar first
  await initSidebar('dashboard');

  // Then initialize dashboard
  initDashboard();

  // Setup quick actions
  setupQuickActions();

  // Google connect button
  const googleConnectBtn = document.getElementById('googleConnectBtn');
  if (googleConnectBtn) {
    googleConnectBtn.addEventListener('click', connectGoogleAccount);
  }

  // Skip Google connect
  const skipGoogleBtn = document.getElementById('skipGoogleBtn');
  if (skipGoogleBtn) {
    skipGoogleBtn.addEventListener('click', closeGoogleConnectModal);
  }

  // Close button (X) in modal header
  const closeGoogleModal = document.getElementById('closeGoogleModal');
  if (closeGoogleModal) {
    closeGoogleModal.addEventListener('click', closeGoogleConnectModal);
  }

  // Close modal on overlay click
  const googleModal = document.getElementById('googleConnectModal');
  if (googleModal) {
    googleModal.addEventListener('click', (e) => {
      if (e.target === googleModal) closeGoogleConnectModal();
    });
  }
});
