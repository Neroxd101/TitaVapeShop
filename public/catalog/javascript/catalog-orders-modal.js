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

    const orders = this.getSavedOrders();
    // Count active orders (pending or confirmed)
    const activeCount = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;

    if (activeCount > 0) {
      this.badgeEl.textContent = activeCount;
      this.badgeEl.classList.add('has-items');
    } else if (orders.length > 0) {
      this.badgeEl.textContent = orders.length;
      this.badgeEl.classList.add('has-items');
    } else {
      this.badgeEl.textContent = '0';
      this.badgeEl.classList.remove('has-items');
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
    const orders = this.getSavedOrders();

    if (orders.length === 0) {
      this.ordersList.innerHTML = '';
      this.ordersList.style.display = 'none';
      this.emptyState.style.display = 'block';
      return;
    }

    this.emptyState.style.display = 'none';
    this.ordersList.style.display = 'flex';

    // Render immediate cache first
    this.renderCards(orders);

    // Sync latest status from server in background
    try {
      const payload = orders.map(o => ({ id: o.id, token: o.token }));
      const response = await fetch('/api/orders/track-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: payload })
      });
      const data = await response.json();

      if (data.success && Array.isArray(data.orders)) {
        // Merge updated statuses
        const serverMap = new Map(data.orders.map(o => [o.id, o]));
        let hasChanges = false;

        orders.forEach(localOrder => {
          const remote = serverMap.get(localOrder.id);
          if (remote && remote.status !== localOrder.status) {
            localOrder.status = remote.status;
            hasChanges = true;
          }
        });

        if (hasChanges) {
          localStorage.setItem('tita_recent_orders', JSON.stringify(orders));
          this.renderCards(orders);
          this.updateBadge();
        }
      }
    } catch (e) {
      console.warn('[Orders Modal] Sync failed:', e);
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

      const orderUrl = order.token
        ? `/order-status?token=${encodeURIComponent(order.token)}`
        : `/order-status?id=${encodeURIComponent(order.id)}`;

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
