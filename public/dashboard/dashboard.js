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

// Start Google OAuth flow
async function connectGoogleAccount() {
  try {
    const response = await fetch('/auth/google');
    const data = await response.json();

    if (data.success && data.authUrl) {
      window.location.href = data.authUrl;
    } else {
      alert('Failed to start Google authentication');
    }
  } catch (error) {
    console.error('Google auth error:', error);
    alert('Failed to connect Google account');
  }
}

// Initialize dashboard
function initDashboard() {
  const user = checkAuth();
  if (!user) return;

  console.log('User data:', user); // Debug log
  console.log('User role:', user.role); // Debug log
  console.log('Google connected:', isGoogleConnected()); // Debug log

  // User info is now set by sidebar.js

  // Header widgets (Google status + date/time)
  if (window.HeaderStatus && HeaderStatus.init) {
    HeaderStatus.init();
  }

  // Check if admin needs to connect Google
  // Show modal after a brief delay to ensure DOM is ready
  if (user.role === 'admin' && !isGoogleConnected()) {
    console.log('Admin detected, showing Google modal...'); // Debug log
    setTimeout(() => {
      showGoogleConnectModal();
    }, 500);
  }

  // Google connection status in header is handled by HeaderStatus

  // Load dashboard data
  loadDashboardData();
}

// Load dashboard data
async function loadDashboardData() {
  // TODO: Fetch actual data from API
  // For now, display placeholder values

  const totalProducts = document.getElementById('totalProducts');
  const todaySales = document.getElementById('todaySales');
  const lowStock = document.getElementById('lowStock');
  const monthSales = document.getElementById('monthSales');

  if (totalProducts) totalProducts.textContent = '0';
  if (todaySales) todaySales.textContent = formatCurrency(0);
  if (lowStock) lowStock.textContent = '0';
  if (monthSales) monthSales.textContent = formatCurrency(0);
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

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize sidebar first
  await initSidebar('dashboard');

  // Main header (shared layout / design)
  if (window.MainHeader && MainHeader.render) {
    MainHeader.render({ page: 'dashboard', title: 'Dashboard' });
  }

  // Then initialize dashboard
  initDashboard();

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
