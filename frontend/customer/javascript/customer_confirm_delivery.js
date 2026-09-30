const CustomerConfirmDelivery = {
    async confirm(orderData) {
        const response = await fetch('/api/customer/orders/confirm-delivery', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Unable to confirm delivery.');
        return result;
    }
};

window.CustomerConfirmDelivery = CustomerConfirmDelivery;
