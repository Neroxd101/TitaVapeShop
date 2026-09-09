/**
 * Customer Login Module
 * Frontend client module matching customer_login RPC and backend route
 */
const CustomerLogin = {
  /**
   * Log in customer with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, requires_verification?: boolean, email?: string, user?: object, message?: string, error?: string}>}
   */
  async login(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, error: 'Email and password are required.' };
    }

    try {
      const res = await fetch('/api/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: cleanEmail, password })
      });
      const data = await res.json();
      if (!res.ok && !data.requires_verification) {
        throw new Error(data.error || 'Invalid credentials');
      }
      return data;
    } catch (err) {
      console.error('[CustomerLogin] Login error:', err);
      return { success: false, error: err.message || 'Sign in failed.' };
    }
  },

  /**
   * Check active customer session
   * @returns {Promise<object|null>} Customer object or null
   */
  async checkSession() {
    try {
      const res = await fetch('/api/customer/me', { credentials: 'include' });
      const data = await res.json();
      if (data && data.authenticated && data.user) {
        return data.user;
      }
      return null;
    } catch (err) {
      console.error('[CustomerLogin] Session check error:', err);
      return null;
    }
  },

  /**
   * Log out active customer
   */
  async logout() {
    try {
      await fetch('/api/customer/logout', { method: 'POST', credentials: 'include' });
    } catch (_) {}
    try {
      localStorage.removeItem('tita_recent_orders');
    } catch (_) {}
    window.location.reload();
  },

  /**
   * Render Navigation UI based on logged-in state
   * @param {object|null} currentUser
   * @param {object} callbacks { onOpenProfile, onOpenOrders, onOpenSignIn }
   */
  updateNavUI(currentUser, callbacks = {}) {
    const container = document.getElementById('customerNavContainer');
    if (!container) return;

    const ordersBtn = document.getElementById('ordersBtn');
    if (ordersBtn) {
      ordersBtn.style.display = currentUser ? 'none' : '';
    }
    document.body.classList.toggle('customer-logged-in', Boolean(currentUser));

    if (currentUser) {
      const initials = (currentUser.full_name || currentUser.email || 'C')
        .trim()
        .charAt(0)
        .toUpperCase();
      const displayName = (currentUser.full_name || currentUser.email || 'Customer').split(' ')[0];

      container.innerHTML = `
        <div class="cart-button customer-profile-pill" id="customerProfileBtn" title="Account Menu">
          <div class="customer-avatar">${this.escapeHtml(initials)}</div>
          <span class="customer-profile-name">${this.escapeHtml(displayName)}</span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="opacity: 0.7; flex-shrink: 0;">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
          <div class="customer-dropdown-menu" id="customerDropdownMenu">
            <div class="customer-dropdown-header">
              <strong style="font-size: 13px; display: block; color: var(--text-primary);">${this.escapeHtml(currentUser.full_name || 'Customer')}</strong>
              <span class="customer-dropdown-email">${this.escapeHtml(currentUser.email)}</span>
            </div>
            <button type="button" class="customer-dropdown-item" id="navProfileItem">
              <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              <span>My Profile</span>
            </button>
            <button type="button" class="customer-dropdown-item" id="navMyOrdersItem">
              <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
              <span>My Orders</span>
              <span id="navOrdersBadge" style="display: none; margin-left: auto; background: var(--accent); color: #0a0a0f; border-radius: 10px; padding: 1px 7px; font-size: 11px; font-weight: 700;"></span>
            </button>
            <button type="button" class="customer-dropdown-item logout-item" id="navLogoutItem">
              <svg viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      `;

      const pill = document.getElementById('customerProfileBtn');
      const menu = document.getElementById('customerDropdownMenu');
      if (pill && menu) {
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          menu.classList.toggle('show');
        });
      }

      const profileItem = document.getElementById('navProfileItem');
      if (profileItem && callbacks.onOpenProfile) {
        profileItem.addEventListener('click', () => {
          if (menu) menu.classList.remove('show');
          callbacks.onOpenProfile();
        });
      }

      const myOrdersItem = document.getElementById('navMyOrdersItem');
      if (myOrdersItem) {
        myOrdersItem.addEventListener('click', () => {
          if (menu) menu.classList.remove('show');
          if (callbacks.onOpenOrders) {
            callbacks.onOpenOrders();
          } else if (window.CatalogOrdersModal) {
            window.CatalogOrdersModal.open();
          }
        });
      }

      const logoutItem = document.getElementById('navLogoutItem');
      if (logoutItem) {
        logoutItem.addEventListener('click', () => this.logout());
      }
    } else {
      container.innerHTML = `
        <button type="button" class="cart-button customer-nav-btn" id="customerSignInNavBtn">
          <svg viewBox="0 0 24 24">
            <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
          <span>Sign In</span>
        </button>
      `;
      const signInBtn = document.getElementById('customerSignInNavBtn');
      if (signInBtn && callbacks.onOpenSignIn) {
        signInBtn.addEventListener('click', () => callbacks.onOpenSignIn());
      }
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

window.CustomerLogin = CustomerLogin;
