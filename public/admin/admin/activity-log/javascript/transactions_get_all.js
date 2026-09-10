/**
 * Fetch a list of transactions (activity log)
 */
const TransactionsGetAll = {
    /**
     * Get list of transactions
     * @param {Object} filters - Pagination and search filters
     * @returns {Promise<Object>} The fetched transactions
     */
    async get(filters = {}) {
        try {
            const params = new URLSearchParams(filters);
            const response = await fetch(`/transactions/transactions_get_all?${params}`, {
                method: 'GET'
            });
            const result = await response.json();

            if (!response.ok) {
                console.error('Failed to fetch transactions:', result);
                return { success: false, error: result.error };
            }

            return { success: true, ...result };
        } catch (error) {
            console.error('Error fetching transactions:', error);
            return { success: false, error: error.message };
        }
    }
};

window.TransactionsGetAll = TransactionsGetAll;
