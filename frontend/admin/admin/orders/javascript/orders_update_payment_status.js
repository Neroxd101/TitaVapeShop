const OrdersUpdatePaymentStatus = {
    async update(orderData) {
        const response = await fetch('/api/orders/update_payment_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(orderData)
        });
        const result = await response.json();
        if (!response.ok || !result?.success) {
            return { success: false, error: result?.error || 'Unable to update payment status.' };
        }
        return result;
    }
};

window.OrdersUpdatePaymentStatus = OrdersUpdatePaymentStatus;
