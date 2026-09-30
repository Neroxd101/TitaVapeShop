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
    },

    /** Fetch every matching page while respecting the RPC's 500-row limit. */
    async getAll(filters = {}) {
        const limit = 500;
        const transactions = [];
        let offset = 0;

        while (true) {
            const result = await this.get({ ...filters, limit, offset });
            if (!result?.success) {
                return { success: false, error: result?.error || 'Failed to fetch transactions.' };
            }
            if (!Array.isArray(result.transactions)) {
                return { success: false, error: 'Invalid transactions response.' };
            }

            transactions.push(...result.transactions);
            offset += result.transactions.length;
            const total = result.total == null ? NaN : Number(result.total);
            if (result.transactions.length < limit ||
                (Number.isSafeInteger(total) && total >= 0 && offset >= total)) {
                return { success: true, transactions, total: transactions.length };
            }
        }
    }
};

window.TransactionsGetAll = TransactionsGetAll;
