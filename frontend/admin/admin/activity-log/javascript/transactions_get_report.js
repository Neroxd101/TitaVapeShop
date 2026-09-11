/**
 * Fetch sales report data
 */
const TransactionsGetReport = {
    /**
     * Get sales report
     * @param {Object} dateRange - Date range filters
     * @returns {Promise<Object>} The report data
     */
    async get(dateRange = {}) {
        try {
            const params = new URLSearchParams(dateRange);
            const response = await fetch(`/transactions/transactions_get_report?${params}`, {
                method: 'GET'
            });
            const result = await response.json();

            if (!response.ok) {
                console.error('Failed to fetch sales report:', result);
                return { success: false, error: result.error };
            }

            return { success: true, report: result.report };
        } catch (error) {
            console.error('Error fetching sales report:', error);
            return { success: false, error: error.message };
        }
    }
};

window.TransactionsGetReport = TransactionsGetReport;
