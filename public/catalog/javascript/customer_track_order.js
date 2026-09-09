/**
 * Customer Track Order Module
 * Frontend client module matching customer_track_order RPC and backend route
 */

const CustomerTrackOrder = {
  /**
   * Track order by ID and optional contact phone number
   * @param {string} orderId - UUID of the order
   * @param {string} [phone] - Optional contact phone number for guest verification
   * @returns {Promise<{success: boolean, order?: object, requiresPhone?: boolean, error?: string, status?: number}>}
   */
  async trackOrder(orderId, phone = '') {
    if (!orderId) {
      return { success: false, error: 'A valid order ID is required.' };
    }

    const trimmedId = encodeURIComponent(orderId.trim());
    let query = `id=${trimmedId}`;
    if (phone && phone.trim()) {
      query += `&phone=${encodeURIComponent(phone.trim())}`;
    }

    try {
      let res = await fetch(`/api/customer/orders/track?${query}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      // Fallback to alias if needed
      if (!res.ok && res.status === 404) {
        res = await fetch(`/api/orders/track?${query}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'include'
        });
      }

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401 && data?.requiresPhone) {
          return {
            success: false,
            requiresPhone: true,
            status: 401,
            error: data?.error || 'Please enter your contact number to view this order.'
          };
        }
        if (res.status === 403) {
          return {
            success: false,
            status: 403,
            error: data?.error || 'Contact number does not match this order.'
          };
        }
        return {
          success: false,
          status: res.status,
          error: data?.error || 'We could not find the order matching this request.'
        };
      }

      if (data && data.success && data.order) {
        // Synchronize localStorage cache
        try {
          let orders = JSON.parse(localStorage.getItem('tita_recent_orders') || '[]');
          if (!Array.isArray(orders)) orders = [];
          const existingIndex = orders.findIndex(o => o.id === data.order.id);
          const orderEntry = {
            id: data.order.id,
            order_type: data.order.order_type,
            total_amount: data.order.total_amount,
            status: data.order.status,
            created_at: data.order.created_at,
            customer_name: data.order.customer_name,
            updated_at: new Date().toISOString()
          };
          if (existingIndex >= 0) {
            orders[existingIndex] = { ...orders[existingIndex], ...orderEntry };
          } else {
            orders.unshift(orderEntry);
          }
          localStorage.setItem('tita_recent_orders', JSON.stringify(orders));
        } catch (_) {}

        return { success: true, order: data.order, status: 200 };
      }

      return {
        success: false,
        status: res.status,
        error: data?.error || 'Unable to retrieve order details.'
      };
    } catch (err) {
      console.error('[CustomerTrackOrder] Network error:', err);
      return {
        success: false,
        error: err.message || 'Connection error. Unable to retrieve order.'
      };
    }
  }
};

window.CustomerTrackOrder = CustomerTrackOrder;
