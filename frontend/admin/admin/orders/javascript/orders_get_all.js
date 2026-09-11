/**
 * Orders Data Fetcher
 * Fetches orders from the backend API
 */
const OrdersGetAll = {
    /**
     * Get all orders
     * @param {Object} filters - Filter and pagination options
     * @returns {Promise<Object>} The fetched orders
     */
    async get(filters = {}) {
        try {
            const cleanFilters = {};
            for (const [key, value] of Object.entries(filters)) {
                if (value !== '' && value !== null && value !== undefined) {
                    cleanFilters[key] = value;
                }
            }
            const params = new URLSearchParams(cleanFilters);
            const response = await fetch(`/api/orders/get_all?${params}`, {
                method: 'GET'
            });
            const result = await response.json();

            if (!response.ok) {
                console.error('Failed to fetch orders:', result);
                return { success: false, error: result.error };
            }

            return { success: true, ...result };
        } catch (error) {
            console.error('Error fetching orders:', error);
            return { success: false, error: error.message };
        }
    }
};

window.OrdersGetAll = OrdersGetAll;
