const OrdersMarkRefunded = {
    async markRefunded(orderData) {
        const response = await fetch('/api/orders/mark_refunded', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify(orderData)
        });
        const result = await response.json();
        if (!response.ok || !result?.success) {
            return { success: false, error: result?.error || 'Unable to record refund.' };
        }
        return result;
    }
};

window.OrdersMarkRefunded = OrdersMarkRefunded;
