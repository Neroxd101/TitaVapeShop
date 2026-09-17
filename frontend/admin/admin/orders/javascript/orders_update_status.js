/** Client for the matching orders_update_status backend route. */
const OrdersUpdateStatus = {
    async updateStatus(orderData) {
        const response = await fetch('/api/orders/update_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(orderData)
        });
        const result = await response.json();
        if (!response.ok || !result?.success) {
            return { success: false, error: result?.error || 'Unable to update order status.' };
        }
        return result;
    }
};

window.OrdersUpdateStatus = OrdersUpdateStatus;
