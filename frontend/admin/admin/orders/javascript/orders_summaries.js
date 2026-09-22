// Dedicated client module for orders_summaries backend route and RPC
const OrdersSummaries = {
    async fetchSummaries() {
        try {
            const response = await fetch('/orders/orders_summaries', {
                method: 'GET',
                credentials: 'include'
            });
            const result = await response.json();
            if (!response.ok || !result?.success) {
                return { success: false, error: result?.error || 'Unable to load order summaries.' };
            }
            return result;
        } catch (error) {
            console.error('Error fetching order summaries:', error);
            return { success: false, error: error.message };
        }
    },

    async updateKPIs(elements) {
        try {
            const result = await this.fetchSummaries();
            if (result?.success && result.data) {
                const {
                    total_pending_orders,
                    total_ready_orders,
                    total_pickup_orders,
                    total_delivery_orders
                } = result.data;

                const pendingCount = Number(total_pending_orders ?? 0);
                const readyCount = Number(total_ready_orders ?? 0);
                const pickupCount = Number(total_pickup_orders ?? 0);
                const deliveryCount = Number(total_delivery_orders ?? 0);

                if (elements.kpiPendingCount) {
                    elements.kpiPendingCount.textContent = pendingCount;
                }
                if (elements.kpiReadyCount) {
                    elements.kpiReadyCount.textContent = readyCount;
                }
                if (elements.kpiPickupCount) {
                    elements.kpiPickupCount.textContent = pickupCount;
                }
                if (elements.kpiDeliveryCount) {
                    elements.kpiDeliveryCount.textContent = deliveryCount;
                }

                // Pulse effect if pending orders require action
                if (elements.kpiCardPending) {
                    elements.kpiCardPending.classList.toggle('has-urgent', pendingCount > 0);
                }
                return { pendingCount, readyCount, pickupCount, deliveryCount };
            }
        } catch (error) {
            console.warn('OrdersSummaries RPC failed:', error);
        }
        return null;
    }
};

window.OrdersSummaries = OrdersSummaries;
