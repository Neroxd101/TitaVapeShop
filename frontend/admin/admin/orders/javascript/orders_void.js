/**
 * Orders Void Client
 * 1-to-1 client for /api/orders/void RPC
 */
const OrdersVoid = {
    /**
     * Void a completed order
     * @param {string} orderId - The ID of the order to void
     * @param {string} reason - The reason for voiding
     * @returns {Promise<Object>}
     */
    async voidOrder(orderId, reason) {
        try {
            const response = await fetch('/api/orders/void', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    order_id: orderId,
                    reason: reason
                })
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                return {
                    success: false,
                    error: result.error || 'Unable to void order.'
                };
            }

            return { success: true, ...result };
        } catch (error) {
            console.error('Error voiding order:', error);
            return {
                success: false,
                error: error.message || 'Network error occurred while voiding order.'
            };
        }
    }
};

window.OrdersVoid = OrdersVoid;
