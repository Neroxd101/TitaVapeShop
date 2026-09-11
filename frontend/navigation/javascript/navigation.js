// =============================================
// Navigation Component - Reusable Navigation Logic
// =============================================

/**
 * Load navigation HTML component
 * @returns {Promise<void>}
 */
async function loadNavigation() {
  const container = document.getElementById('navigation-container');
  if (!container) {
    console.error('Navigation container not found');
    return;
  }

  try {
    const response = await fetch('/navigation/navigation.html');
    if (!response.ok) {
      throw new Error(`Failed to load navigation: ${response.statusText}`);
    }
    const html = await response.text();
    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading navigation:', error);
    // Fallback: show error message
    container.innerHTML = '<div class="error">Failed to load navigation</div>';
  }
}

/**
 * Initialize navigation functionality
 * @param {string} currentPage - Current page identifier (e.g., 'dashboard', 'inventory')
 */
async function initNavigation(currentPage) {
  // Load navigation HTML first
  await loadNavigation();

  // Set active nav item based on current page
  setActiveNavItem(currentPage);

  // Load user info
  loadUserInfo();

  // Setup event listeners
  setupNavigationListeners();
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

  // Also handle 'orders' page (if it exists)
  if (currentPage === 'orders') {
    const ordersNavItem = document.querySelector(`.nav-item[data-page="orders"]`);
    if (ordersNavItem) {
      ordersNavItem.classList.add('active');
    }
  }
}

/**
 * Load user information into navigation
 */
function loadUserInfo() {
  const userNameEl = document.getElementById('userName');
  const userRoleEl = document.getElementById('userRole');
  const userAvatarEl = document.getElementById('userAvatar');

  // Get user info from localStorage
  const userStr = localStorage.getItem('user');
  let username = 'Admin';
  let role = 'Administrator';
  let roles = ['admin'];

  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      username = user.username || user.email?.split('@')[0] || 'Admin';

      // Handle roles array (from new login) or single role (legacy)
      roles = user.roles || (user.role ? [user.role] : ['admin']);

      if (roles.includes('admin')) {
        role = 'Administrator';
      } else if (roles.includes('staff')) {
        role = 'Staff';
      } else {
        role = 'User';
      }
    } catch (e) {
      console.error('Error parsing user data:', e);
    }
  }

  // Update UI Elements
  if (userNameEl) userNameEl.textContent = username;
  if (userRoleEl) userRoleEl.textContent = role;

  // Set avatar initial
  if (userAvatarEl) {
    const initial = username.charAt(0).toUpperCase();
    const span = userAvatarEl.querySelector('span');
    if (span) {
      span.textContent = initial;
    } else {
      userAvatarEl.textContent = initial;
    }
  }

  // Update accessible links
  updateNavigationLinks(roles);
}

/**
 * Show/Hide navigation links based on user roles
 * @param {string[]} roles 
 */
function updateNavigationLinks(roles) {
  const navItems = document.querySelectorAll('.nav-item[data-page]');

  navItems.forEach(item => {
    const page = item.getAttribute('data-page');
    let isAllowed = false;

    // Admin has access to everything
    if (roles.includes('admin')) {
      isAllowed = true;
    }
    // Staff has restricted access
    else if (roles.includes('staff')) {
      if (['sales', 'orders'].includes(page)) {
        isAllowed = true;
      }
    }
    // Add other roles here if needed

    // Toggle visibility
    if (isAllowed) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

/**
 * Setup navigation event listeners
 */
function setupNavigationListeners() {
  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Menu toggle (mobile)
  const menuToggle = document.getElementById('menuToggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', toggleNavigation);
  }

  // Close navigation when clicking overlay (if exists)
  const overlay = document.querySelector('.navigation-overlay');
  if (overlay) {
    overlay.addEventListener('click', toggleNavigation);
  }
}

/**
 * Toggle navigation visibility on mobile
 */
function toggleNavigation() {
  const navigation = document.querySelector('.navigation');
  const overlay = document.querySelector('.navigation-overlay');

  if (navigation) {
    navigation.classList.toggle('open');
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
    await fetch('/api/logout', { method: 'POST' });
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
    initNavigation,
    setActiveNavItem,
    loadUserInfo,
    toggleNavigation,
    handleLogout
  };
}

// Backward compatibility - keep old function names for now
if (typeof initSidebar === 'undefined') {
  window.initSidebar = initNavigation;
  window.loadSidebar = loadNavigation;
  window.setupSidebarListeners = setupNavigationListeners;
  window.toggleSidebar = toggleNavigation;
}
