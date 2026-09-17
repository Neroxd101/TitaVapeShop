// Shared recent-order merge used by tracking and cancellation clients.
window.CustomerOrderCache = (() => {
  function upsert(order) {
    if (!order || !order.id) return;
    try {
      let orders = JSON.parse(localStorage.getItem('tita_recent_orders') || '[]');
      if (!Array.isArray(orders)) orders = [];

      const existingIndex = orders.findIndex(o => o.id === order.id);
      const orderEntry = {
        id: order.id,
        order_type: order.order_type,
        total_amount: order.total_amount,
        status: order.status,
        created_at: order.created_at,
        customer_name: order.customer_name,
        updated_at: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        orders[existingIndex] = { ...orders[existingIndex], ...orderEntry };
      } else {
        orders.unshift(orderEntry);
      }

      // Keep latest 15 orders
      orders = orders.slice(0, 15);
      localStorage.setItem('tita_recent_orders', JSON.stringify(orders));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  return { upsert };
})();
