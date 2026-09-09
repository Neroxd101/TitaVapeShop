/**
 * Customer Get Orders Module
 * Frontend client module matching customer_get_orders RPC and backend route
 */

const CustomerGetOrders = {
  /**
   * Fetch recent orders for active customer
   * @param {number} [limit=25]
   * @returns {Promise<{success: boolean, orders: Array, requiresAuth?: boolean, error?: string}>}
   */
  async fetchOrders(limit = 25) {
    try {
      let res = await fetch('/api/customer/orders/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ limit })
      });

      if (!res.ok && res.status === 404) {
        // Fallback to alias if needed
        res = await fetch('/api/orders/track-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ limit })
        });
      }

      const data = await res.json();

      if (data.requiresAuth) {
        return { success: false, requiresAuth: true, error: data.error || 'Please sign in to view orders.', orders: [] };
      }

      if (data.success && Array.isArray(data.orders)) {
        // Update local storage recent orders cache
        try {
          const cached = data.orders.map(o => ({
            id: o.id,
            order_type: o.order_type,
            total_amount: o.total_amount,
            status: o.status,
            created_at: o.created_at,
            customer_name: o.customer_name
          }));
          localStorage.setItem('tita_recent_orders', JSON.stringify(cached));
        } catch (_) {}

        return { success: true, orders: data.orders };
      }

      return { success: false, error: data.error || 'Failed to fetch orders.', orders: [] };
    } catch (err) {
      console.error('[CustomerGetOrders] Fetch error:', err);
      return { success: false, error: err.message || 'Network error fetching orders.', orders: [] };
    }
  }
};

window.CustomerGetOrders = CustomerGetOrders;
