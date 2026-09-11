/**
 * Fetch transaction statistics
 */
const TransactionsGetStats = {
    /**
     * Get transaction statistics
     * @param {Object} dateRange - Date range filters
     * @returns {Promise<Object>} The statistics data
     */
    async get(dateRange = {}) {
        try {
            const params = new URLSearchParams(dateRange);
            const response = await fetch(`/transactions/transactions_get_stats?${params}`, {
                method: 'GET'
            });
            const result = await response.json();

            if (!response.ok) {
                console.error('Failed to fetch stats:', result);
                return { success: false, error: result.error };
            }

            return { success: true, stats: result.stats };
        } catch (error) {
            console.error('Error fetching stats:', error);
            return { success: false, error: error.message };
        }
    }
};

window.TransactionsGetStats = TransactionsGetStats;
