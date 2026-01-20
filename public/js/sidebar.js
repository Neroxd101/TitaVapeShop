// =============================================
// Sidebar Component - Reusable Sidebar Logic
// =============================================

/**
 * Load sidebar HTML component
 * @returns {Promise<void>}
 */
async function loadSidebar() {
  const container = document.getElementById('sidebar-container');
  if (!container) {
    console.error('Sidebar container not found');
    return;
  }

  try {
    const response = await fetch('/components/sidebar.html');
    if (!response.ok) {
      throw new Error(`Failed to load sidebar: ${response.statusText}`);
    }
    const html = await response.text();
    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading sidebar:', error);
    // Fallback: show error message
    container.innerHTML = '<div class="error">Failed to load sidebar</div>';
  }
}

/**
 * Initialize sidebar functionality
 * @param {string} currentPage - Current page identifier (e.g., 'dashboard', 'inventory')
 */
async function initSidebar(currentPage) {
  // Load sidebar HTML first
  await loadSidebar();

  // Set active nav item based on current page
  setActiveNavItem(currentPage);

  // Load user info
  loadUserInfo();

  // Setup event listeners
  setupSidebarListeners();
}

/**
 * Set the active navigation item
 * @param {string} currentPage - Current page identifier
 */
function setActiveNavItem(currentPage) {
  // Remove active class from all nav items
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));

  // Add active class to current page nav item
  const currentNavItem = document.querySelector(`.nav-item[data-page="${currentPage}"]`);
  if (currentNavItem) {
    currentNavItem.classList.add('active');
  }
}

/**
 * Load user information into sidebar
 */
function loadUserInfo() {
  const userNameEl = document.getElementById('userName');
  const userRoleEl = document.getElementById('userRole');
  const userAvatarEl = document.getElementById('userAvatar');

  // Get user info from localStorage
  const userStr = localStorage.getItem('user');
  let username = 'Admin';
  let role = 'Administrator';

  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      username = user.username || user.email?.split('@')[0] || 'Admin';
      role = user.role === 'admin' ? 'Administrator' : (user.role === 'staff' ? 'Staff' : 'Administrator');
    } catch (e) {
      console.error('Error parsing user data:', e);
    }
  }

  if (userNameEl) userNameEl.textContent = username;
  if (userRoleEl) userRoleEl.textContent = role;

  // Set avatar initial
  if (userAvatarEl) {
    const initial = username.charAt(0).toUpperCase();
    userAvatarEl.textContent = initial;
  }
}

/**
 * Setup sidebar event listeners
 */
function setupSidebarListeners() {
  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Menu toggle (mobile)
  const menuToggle = document.getElementById('menuToggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', toggleSidebar);
  }

  // Close sidebar when clicking overlay (if exists)
  const overlay = document.querySelector('.sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', toggleSidebar);
  }
}

/**
 * Toggle sidebar visibility on mobile
 */
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

/**
 * Handle logout
 */
async function handleLogout() {
  try {
    // Call server-side logout to destroy session
    await fetch('/logout', { method: 'POST' });
  } catch (err) {
    console.error('Logout error:', err);
  }

  // Clear localStorage
  localStorage.clear();

  // Redirect to login
  window.location.href = '/';
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initSidebar,
    setActiveNavItem,
    loadUserInfo,
    toggleSidebar,
    handleLogout
  };
}
