/**
 * Catalog Customer Orders Modal
 * Manages guest orders history, tracking lookup, and navbar badge
 */

const CatalogOrdersModal = {
  modal: null,
  closeBtn: null,
  ordersList: null,
  emptyState: null,
  loadingState: null,
  badgeEl: null,

  /**
   * Initialize modal
   */
  async init() {
    this.badgeEl = document.getElementById('ordersBadge');
    this.updateBadge();

    const container = document.getElementById('orders-modal-container');
    if (!container) return;

    try {
      const res = await fetch('/catalog/catalog-orders-modal.html');
      if (!res.ok) return;
      container.innerHTML = await res.text();

      this.modal = document.getElementById('ordersModal');
      this.closeBtn = document.getElementById('closeOrdersModalBtn');
      this.ordersList = document.getElementById('ordersList');
      this.emptyState = document.getElementById('ordersModalEmpty');
      this.loadingState = document.getElementById('ordersModalLoading');

      this.setupEventListeners();
    } catch (err) {
      console.error('[Orders Modal] Init error:', err);
    }
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const openBtn = document.getElementById('ordersBtn');
    if (openBtn) {
      openBtn.addEventListener('click', () => this.open());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }

    const trackBtn = document.getElementById('trackOrderSubmitBtn');
    const trackInput = document.getElementById('trackOrderIdInput');
    if (trackBtn && trackInput) {
      const handleTrack = () => {
        const id = trackInput.value.trim();
        if (!id) return;
        window.location.href = `/order-status?id=${encodeURIComponent(id)}`;
      };
      trackBtn.addEventListener('click', handleTrack);
      trackInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleTrack();
      });
    }
  },

  /**
   * Get orders from localStorage
   */
  getSavedOrders() {
    try {
      const saved = JSON.parse(localStorage.getItem('tita_recent_orders') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch (e) {
      return [];
    }
  },

  /**
   * Update active orders badge in navbar
   */
  updateBadge() {
    if (!this.badgeEl) {
      this.badgeEl = document.getElementById('ordersBadge');
    }
    if (!this.badgeEl) return;

    const isLoggedIn = Boolean(window.CustomerAuth && window.CustomerAuth.currentUser);
    if (!isLoggedIn) {
      this.badgeEl.textContent = '0';
      this.badgeEl.classList.remove('has-items');
      return;
    }

    const orders = this.getSavedOrders();
    // Count active orders (pending or confirmed)
    const activeCount = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;

    const navBadge = document.getElementById('navOrdersBadge');

    if (activeCount > 0) {
      this.badgeEl.textContent = activeCount;
      this.badgeEl.classList.add('has-items');
      if (navBadge) {
        navBadge.textContent = activeCount;
        navBadge.style.display = 'inline-block';
      }
    } else if (orders.length > 0) {
      this.badgeEl.textContent = orders.length;
      this.badgeEl.classList.add('has-items');
      if (navBadge) {
        navBadge.textContent = orders.length;
        navBadge.style.display = 'inline-block';
      }
    } else {
      this.badgeEl.textContent = '0';
      this.badgeEl.classList.remove('has-items');
      if (navBadge) {
        navBadge.style.display = 'none';
      }
    }
  },

  /**
   * Open modal and refresh order statuses
   */
  async open() {
    if (!this.modal) return;
    this.modal.classList.add('show');
    await this.render();
  },

  /**
   * Close modal
   */
  close() {
    if (this.modal) {
      this.modal.classList.remove('show');
    }
  },

  /**
   * Render orders list
   */
  async render() {
    const isLoggedIn = Boolean(window.CustomerAuth && window.CustomerAuth.currentUser);

    if (!isLoggedIn) {
      if (this.ordersList) {
        this.ordersList.innerHTML = '';
        this.ordersList.style.display = 'none';
      }
      if (this.emptyState) {
        this.emptyState.innerHTML = `
          <svg viewBox="0 0 24 24" width="48" height="48" fill="var(--text-secondary)" style="opacity: 0.5; margin-bottom: 12px;">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
          <h4 style="margin: 0 0 6px; font-size: 16px; color: #fff;">Sign In to View Orders</h4>
          <p style="color: var(--text-secondary); font-size: 13px; margin: 0 0 16px;">Sign in to your account to view your past orders and live tracking status.</p>
          <button id="ordersModalSignInBtn" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px; margin: 0 auto;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z"/></svg>
            Sign In to Account
          </button>
        `;
        this.emptyState.style.display = 'block';
        const signInBtn = document.getElementById('ordersModalSignInBtn');
        if (signInBtn) {
          signInBtn.addEventListener('click', () => {
            this.close();
            if (window.CustomerAuth) {
              window.CustomerAuth.open('signin');
            }
          });
        }
      }
      this.updateBadge();
      return;
    }

    let orders = this.getSavedOrders();

    if (orders.length > 0) {
      this.emptyState.style.display = 'none';
      this.ordersList.style.display = 'flex';
      this.renderCards(orders);
    }

    // Sync from server for authenticated customer account
    try {
      let data;
      if (window.CustomerGetOrders) {
        data = await window.CustomerGetOrders.fetchOrders(25);
      } else {
        const response = await fetch('/api/orders/track-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({})
        });
        data = await response.json();
      }

      if (data.success && Array.isArray(data.orders)) {
        orders = data.orders.map(remote => ({
          id: remote.id,
          order_type: remote.order_type,
          total_amount: remote.total_amount,
          status: remote.status,
          created_at: remote.created_at,
          customer_name: remote.customer_name
        }));
        try {
          localStorage.setItem('tita_recent_orders', JSON.stringify(orders));
        } catch (_) {}

        if (orders.length > 0) {
          this.emptyState.style.display = 'none';
          this.ordersList.style.display = 'flex';
          this.renderCards(orders);
        } else {
          this.ordersList.innerHTML = '';
          this.ordersList.style.display = 'none';
          this.emptyState.innerHTML = `
            <svg viewBox="0 0 24 24" width="48" height="48" fill="var(--text-secondary)" style="opacity: 0.5; margin-bottom: 12px;">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
            </svg>
            <h4 style="margin: 0 0 6px; font-size: 16px;">No Recent Orders</h4>
            <p style="color: var(--text-secondary); font-size: 13px; margin: 0;">You have not placed any orders on this account yet.</p>
          `;
          this.emptyState.style.display = 'block';
        }
        this.updateBadge();
        return;
      }
    } catch (e) {
      console.warn('[Orders Modal] Sync failed:', e);
    }

    if (orders.length === 0) {
      this.ordersList.innerHTML = '';
      this.ordersList.style.display = 'none';
      this.emptyState.style.display = 'block';
    }
  },

  /**
   * Render HTML cards for orders
   */
  renderCards(orders) {
    if (!this.ordersList) return;
    this.ordersList.innerHTML = '';

    orders.forEach(order => {
      const card = document.createElement('div');
      card.style.cssText = `
        padding: 14px 16px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--border);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        transition: all 0.2s ease;
      `;

      const isPickup = (order.order_type || 'pickup') === 'pickup';
      const status = (order.status || 'pending').toLowerCase();

      let badgeClass = 'badge-warning';
      let statusText = 'Pending';
      if (status === 'confirmed') {
        badgeClass = 'badge-info';
        statusText = 'Confirmed';
      } else if (status === 'completed') {
        badgeClass = 'badge-success';
        statusText = 'Completed';
      } else if (status === 'cancelled') {
        badgeClass = 'badge-danger';
        statusText = 'Cancelled';
      }

      let dateStr = 'Recent';
      if (order.created_at) {
        try {
          const d = new Date(order.created_at);
          dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch (e) {}
      }

      const orderUrl = `/order-status?id=${encodeURIComponent(order.id)}`;

      card.innerHTML = `
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
            <span style="font-weight: 700; font-size: 13px; color: #fff;">#${order.id.slice(0, 8)}...</span>
            <span class="badge ${badgeClass}" style="padding: 2px 6px; font-size: 9px;">${statusText}</span>
            <span style="font-size: 11px; color: var(--text-secondary);">${isPickup ? 'Pickup' : 'Delivery'}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary);">
            ${dateStr} • <span style="color: var(--accent); font-weight: 600;">₱${parseFloat(order.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
        <a href="${orderUrl}" class="btn btn-secondary btn-sm" style="padding: 6px 12px; font-size: 12px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
          <span>View Details</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
          </svg>
        </a>
      `;

      this.ordersList.appendChild(card);
    });
  }
};

window.CatalogOrdersModal = CatalogOrdersModal;
