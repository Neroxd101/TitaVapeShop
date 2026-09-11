/**
 * Customer Cancel Order Module
 * Frontend client module matching customer_cancel_order RPC and backend route
 */

const CustomerCancelOrder = {
  /**
   * Cancel a pending order
   * @param {string} orderId - UUID of the order
   * @param {string} [phone] - Optional contact phone number for guest verification
   * @returns {Promise<{success: boolean, order?: object, error?: string}>}
   */
  async cancelOrder(orderId, phone = '') {
    if (!orderId) {
      return { success: false, error: 'A valid order ID is required.' };
    }

    try {
      let res = await fetch('/api/customer/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: orderId, phone: phone ? phone.trim() : undefined })
      });

      // Fallback to alias if needed
      if (!res.ok && res.status === 404) {
        res = await fetch('/api/orders/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id: orderId, phone: phone ? phone.trim() : undefined })
        });
      }

      if (res.redirected || !res.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Cancellation service is unavailable. Please try again.');
      }

      const data = await res.json();

      if (!res.ok || !data.success || !data.order) {
        return {
          success: false,
          error: data.error || 'Unable to cancel your order. Please try again.'
        };
      }

      // Update cached order status in localStorage if present
      try {
        const storedOrders = JSON.parse(localStorage.getItem('tita_recent_orders') || '[]');
        if (Array.isArray(storedOrders)) {
          const updated = storedOrders.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o);
          localStorage.setItem('tita_recent_orders', JSON.stringify(updated));
        }

        const activeOrder = JSON.parse(localStorage.getItem('activeOrder') || 'null');
        if (activeOrder && activeOrder.id === orderId) {
          activeOrder.status = 'cancelled';
          localStorage.setItem('activeOrder', JSON.stringify(activeOrder));
        }
      } catch (_) {}

      return { success: true, order: data.order };
    } catch (err) {
      console.error('[CustomerCancelOrder] Error:', err);
      return {
        success: false,
        error: err.message || 'Network error occurred while cancelling order.'
      };
    }
  }
};

window.CustomerCancelOrder = CustomerCancelOrder;
