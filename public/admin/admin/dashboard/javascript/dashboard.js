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

  // Check if admin needs to connect Google
  const roles = user.roles || [];
  if (roles.includes('admin') && !isGoogleConnected()) {
    setTimeout(() => {
      showGoogleConnectModal();
    }, 500);
  }

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
    const summary = await dashboard_summary(todayStartISO, todayEndISO, monthStartISO);
    const inventoryData = { success: true, data: summary.inventory.low_stock_items };
    const todayStatsData = { success: true, stats: summary.today };
    const monthStatsData = { success: true, stats: summary.month };
    const ordersData = { success: true, total: summary.pending_orders };
    loadRecentActivity(summary);

    // Get DOM elements
    const totalProductsEl = document.getElementById('totalProducts');
    const todaySalesEl = document.getElementById('todaySales');
    const lowStockEl = document.getElementById('lowStock');
    const monthSalesEl = document.getElementById('monthSales');
    const pendingOrdersEl = document.getElementById('pendingOrders');
    const lowStockPill = document.getElementById('lowStockPill');
    const lowStockPillText = document.getElementById('lowStockPillText');
    const lowStockStatusMsg = document.getElementById('lowStockStatusMsg');
    const lowStockCard = document.getElementById('lowStockCard');
    const lowStockWatchList = document.getElementById('lowStockWatchList');

    // Calculate total products & low stock items
    if (inventoryData.success && Array.isArray(inventoryData.data)) {
      const products = inventoryData.data;
      const totalProducts = summary.inventory.total;
      if (totalProductsEl) totalProductsEl.textContent = totalProducts;

      // Low stock items (quantity <= 10)
      const lowStockItems = products;
      const lowStockCount = summary.inventory.low_stock_count;
      if (lowStockEl) lowStockEl.textContent = lowStockCount;

      if (lowStockCount > 0) {
        if (lowStockPill) {
          lowStockPill.className = 'metric-pill pill-neutral';
          if (lowStockPillText) lowStockPillText.textContent = `${lowStockCount} items low`;
        }
        if (lowStockStatusMsg) lowStockStatusMsg.textContent = `${lowStockCount} items need restock`;

        // Render low stock watchlist in sidebar
        if (lowStockWatchList) {
          lowStockWatchList.innerHTML = lowStockItems.slice(0, 4).map(item => `
            <div class="low-stock-row">
              <span class="low-stock-name" title="${escapeHtml(item.name || 'Product')}">${escapeHtml(item.name || 'Product')}</span>
              <span class="low-stock-qty">${item.quantity || 0} in stock</span>
            </div>
          `).join('');
        }
      } else {
        if (lowStockPill) {
          lowStockPill.className = 'metric-pill pill-neutral';
          if (lowStockPillText) lowStockPillText.textContent = 'All Healthy';
        }
        if (lowStockStatusMsg) lowStockStatusMsg.textContent = 'All inventory levels safe';
        if (lowStockWatchList) {
          lowStockWatchList.innerHTML = '<p class="low-stock-empty">✓ All products have healthy stock levels.</p>';
        }
      }
    } else {
      if (totalProductsEl) totalProductsEl.textContent = '0';
      if (lowStockEl) lowStockEl.textContent = '0';
      if (lowStockWatchList) {
        lowStockWatchList.innerHTML = '<p class="low-stock-empty">No stock warnings available.</p>';
      }
    }

    // Today's sales
    if (todayStatsData.success && todayStatsData.stats) {
      const todaySalesAmount = parseFloat(todayStatsData.stats.total_sales_amount || 0);
      if (todaySalesEl) todaySalesEl.textContent = formatCurrency(todaySalesAmount);
    } else {
      if (todaySalesEl) todaySalesEl.textContent = formatCurrency(0);
    }

    // Month's sales
    if (monthStatsData.success && monthStatsData.stats) {
      const monthSalesAmount = parseFloat(monthStatsData.stats.total_sales_amount || 0);
      if (monthSalesEl) monthSalesEl.textContent = formatCurrency(monthSalesAmount);
    } else {
      if (monthSalesEl) monthSalesEl.textContent = formatCurrency(0);
    }

    // Pending online orders count
    if (pendingOrdersEl) {
      const orderCount = ordersData.success ? (ordersData.total || (Array.isArray(ordersData.orders) ? ordersData.orders.length : 0)) : 0;
      pendingOrdersEl.textContent = orderCount;
    }

    // Google Drive status description
    const googleStatusDesc = document.getElementById('googleStatusDesc');
    if (googleStatusDesc) {
      if (isGoogleConnected()) {
        googleStatusDesc.textContent = 'Connected · Product photos synced with Google Drive';
        googleStatusDesc.style.color = 'var(--dash-emerald)';
      } else {
        googleStatusDesc.textContent = 'Not connected · Connect to enable cloud image storage';
        googleStatusDesc.style.color = 'var(--dash-text-dim)';
      }
    }
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    
    // Fallbacks
    const totalProducts = document.getElementById('totalProducts');
    const todaySales = document.getElementById('todaySales');
    const lowStock = document.getElementById('lowStock');
    const monthSales = document.getElementById('monthSales');
    const pendingOrders = document.getElementById('pendingOrders');

    for (const element of [totalProducts, todaySales, lowStock, monthSales, pendingOrders]) {
      if (element) element.textContent = 'Unavailable';
    }
    const activityList = document.getElementById('activityList');
    if (activityList) activityList.textContent = 'Unable to load recent activity.';
  }
}

// Load recent activity (limited to 8 items)
function loadRecentActivity(result) {
  try {

    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    if (!result.transactions || result.transactions.length === 0) {
      activityList.innerHTML = `
        <div class="activity-empty">
          <div class="empty-icon-wrap">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <h4>No recent transactions</h4>
          <p>Transactions from the POS register and catalog will appear here in real time.</p>
        </div>
      `;
      return;
    }

    // Clear existing content
    activityList.innerHTML = '';

    // Render at most 8 activity items
    const recentTransactions = (result.transactions || []).slice(0, 8);
    recentTransactions.forEach(transaction => {
      const activityItem = createActivityItem(transaction);
      activityList.appendChild(activityItem);
    });
  } catch (error) {
    console.error('Error loading recent activity:', error);
    const activityList = document.getElementById('activityList');
    if (activityList) {
      activityList.innerHTML = '<div class="activity-empty"><p>Error loading activity records.</p></div>';
    }
  }
}

// Create activity item element with clean retail ledger tags
function createActivityItem(transaction) {
  const item = document.createElement('div');
  item.className = 'activity-item';

  const actionType = normalizeActionType(transaction.action_type);
  const title = getActivityTitle(transaction);
  const meta = getActivityMeta(transaction);
  const time = formatActivityTime(transaction.created_at);

  let badgeTag = 'LOG';
  let badgeClass = 'tag-inventory';
  if (actionType === 'sale_complete') {
    badgeTag = 'SALE';
    badgeClass = 'tag-sale';
  } else if (actionType.startsWith('inventory')) {
    badgeTag = 'STOCK';
    badgeClass = 'tag-inventory';
  } else if (actionType.startsWith('order')) {
    badgeTag = 'ORDER';
    badgeClass = 'tag-order';
  } else if (actionType.includes('void') || actionType.includes('cancel')) {
    badgeTag = 'VOID';
    badgeClass = 'tag-void';
  }

  item.innerHTML = `
    <span class="activity-badge-tag ${badgeClass}">${badgeTag}</span>
    <div class="activity-details">
      <div class="activity-top-row">
        <span class="activity-title">${title}</span>
        <span class="activity-time">${time}</span>
      </div>
      ${meta ? `<div class="activity-meta">${meta}</div>` : ''}
    </div>
  `;

  return item;
}

// Get icon SVG for activity type
function getActivityIcon(actionType) {
  const type = normalizeActionType(actionType);
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

  return icons[type] || `
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
  const actionType = normalizeActionType(transaction.action_type);
  const d = transaction.details || {};

  if (actionType === 'sale_complete') {
    const items = transaction.sale_items || [];
    const itemCount = items.reduce((sum, i) => sum + (i.qty || 0), 0);
    const customerName = escapeHtml(transaction.customer_name || 'Walk-in');
    const amount = transaction.sale_total ? formatCurrency(transaction.sale_total) : '';
    return `Sold ${itemCount} items to ${customerName}${amount ? ` - ${amount}` : ''}`;
  }

  if (actionType === 'inventory_add') {
    const name = escapeHtml(d.name || 'Item');
    const quantity = d.quantity || 0;
    return `Added "${name}" (${quantity} qty)`;
  }

  if (actionType === 'inventory_edit') {
    const itemName = escapeHtml(d.new?.name || d.old?.name || 'Item');
    return `Edited "${itemName}"`;
  }

  if (actionType === 'inventory_delete') {
    const name = escapeHtml(d.name || 'Item');
    return `Deleted "${name}"`;
  }

  if (actionType === 'sale_void') {
    const reason = escapeHtml(d.reason || 'No reason provided');
    return `Voided sale (${reason})`;
  }

  if (actionType === 'order_confirm') {
    const orderId = d.order_id ? escapeHtml(String(d.order_id).substring(0, 8)) : 'N/A';
    return `Confirmed order ${orderId}`;
  }

  if (actionType === 'order_cancel') {
    const orderId = d.order_id ? escapeHtml(String(d.order_id).substring(0, 8)) : 'N/A';
    return `Cancelled order ${orderId}`;
  }

  return humanizeActionType(actionType);
}

function getActivityMeta(transaction) {
  const actionType = normalizeActionType(transaction.action_type);
  const d = transaction.details || {};

  if (actionType === 'sale_complete') {
    const items = transaction.sale_items || [];
    const topItem = items[0]?.name ? escapeHtml(items[0].name) : '';
    const moreItemsCount = items.length > 1 ? items.length - 1 : 0;
    const amount = transaction.sale_total ? formatCurrency(transaction.sale_total) : '';
    const cash = d.cash ? formatCurrency(d.cash) : '';
    const change = d.change ? formatCurrency(d.change) : '';

    const parts = [];
    if (amount) parts.push(`Total: ${amount}`);
    if (topItem) {
      parts.push(
        `Items: ${topItem}${moreItemsCount > 0 ? ` +${moreItemsCount} more` : ''}`
      );
    }
    if (cash) parts.push(`Cash: ${cash}`);
    if (change) parts.push(`Change: ${change}`);

    return parts.join(' · ');
  }

  if (actionType === 'inventory_add') {
    const name = escapeHtml(d.name || 'Item');
    const category = escapeHtml(d.category || 'Uncategorized');
    const quantity = d.quantity || 0;
    const salePrice = d.sale_price ? formatCurrency(d.sale_price) : '';
    return `${name} · ${category} · Qty: ${quantity}${salePrice ? ` · Price: ${salePrice}` : ''}`;
  }

  if (actionType === 'inventory_edit') {
    const changes = d.changes || {};
    const changedFields = Object.keys(changes).filter(
      (field) => !['updated_at', 'images', 'qr_image_url'].includes(field)
    );
    if (!changedFields.length) return '';

    return `Updated: ${changedFields
      .slice(0, 3)
      .map(formatFieldName)
      .join(', ')}${changedFields.length > 3 ? ' +more' : ''}`;
  }

  if (actionType === 'inventory_delete') {
    const category = escapeHtml(d.category || 'Uncategorized');
    const quantity = d.quantity || 0;
    return `${category} · Last qty: ${quantity}`;
  }

  return '';
}

function normalizeActionType(actionType) {
  return String(actionType || '').trim().toLowerCase();
}

function humanizeActionType(actionType) {
  if (!actionType) return 'Activity';
  return actionType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFieldName(field) {
  return String(field)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function formatExactDateTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
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
    });
  }

  // Header Add Stock button
  const headerAddProductBtn = document.getElementById('headerAddProductBtn');
  if (headerAddProductBtn) {
    headerAddProductBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sessionStorage.setItem('openAddItemModal', 'true');
      window.location.href = '/inventory';
    });
  }

  // Manage Google Drive button
  const manageGoogleBtn = document.getElementById('manageGoogleBtn');
  if (manageGoogleBtn) {
    manageGoogleBtn.addEventListener('click', () => {
      window.location.href = '/settings';
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

