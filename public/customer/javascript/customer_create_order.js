/**
 * Customer Create Order Module
 * Frontend client module matching customer_create_order RPC and backend route
 */

const CustomerCreateOrder = {
  /**
   * Submit an order to the customer order creation endpoint
   * @param {{customer_name: string, contact_number: string, customer_email: string, order_type: string, items: Array, total_amount: number, social_media?: string}} orderData
   * @returns {Promise<{success: boolean, order?: object, trackingUrl?: string, error?: string, requiresAuth?: boolean}>}
   */
  async submit(orderData) {
    try {
      let response = await fetch('/api/customer/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(orderData)
      });

      if (!response.ok && response.status === 404) {
        // Fallback to alias if needed
        response = await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(orderData)
        });
      }

      const result = await response.json();

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          requiresAuth: true,
          error: result.error || 'Please sign in or create a verified account to place your order.'
        };
      }

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || 'Failed to place order.'
        };
      }

      // Save order to customer's local recent orders cache
      if (result.order && result.order.id) {
        try {
          let orders = JSON.parse(localStorage.getItem('tita_recent_orders') || '[]');
          if (!Array.isArray(orders)) orders = [];
          orders.unshift({
            id: result.order.id,
            order_type: result.order.order_type,
            total_amount: result.order.total_amount,
            status: result.order.status || 'pending',
            created_at: result.order.created_at || new Date().toISOString(),
            customer_name: result.order.customer_name
          });
          orders = orders.slice(0, 15);
          localStorage.setItem('tita_recent_orders', JSON.stringify(orders));

          if (window.CatalogOrdersModal && typeof window.CatalogOrdersModal.updateBadge === 'function') {
            window.CatalogOrdersModal.updateBadge();
          }
        } catch (e) {
          console.warn('[CustomerCreateOrder] Failed to save order cache:', e);
        }
      }

      return {
        success: true,
        order: result.order,
        trackingUrl: result.trackingUrl || `/order-status?id=${encodeURIComponent(result.order?.id)}`
      };
    } catch (err) {
      console.error('[CustomerCreateOrder] Submission error:', err);
      return {
        success: false,
        error: err.message || 'Unable to connect to server. Please check your connection.'
      };
    }
  }
};

window.CustomerCreateOrder = CustomerCreateOrder;
