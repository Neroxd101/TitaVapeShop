/**
 * TransactionsData
 * Handles data fetching and state management for the transactions page
 */
class TransactionsData {
    constructor() {
        this.state = {
            filters: {
                limit: 20,
                offset: 0
            },
            loading: false,
            transactions: [],
            total: 0
        };
    }

    /**
     * Update filters with new values
     * @param {Object} newFilters 
     */
    updateFilters(newFilters) {
        this.state.filters = {
            ...this.state.filters,
            ...newFilters,
            // reset offset when filters change (except pagination)
            offset: newFilters.offset !== undefined ? newFilters.offset : 0
        };
    }

    /**
     * Reset filters to default
     */
    resetFilters() {
        this.state.filters = {
            limit: 20,
            offset: 0
        };
    }

    /**
     * Go to next page
     */
    nextPage() {
        this.state.filters.offset += this.state.filters.limit;
    }

    /**
     * Go to previous page
     */
    prevPage() {
        if (this.state.filters.offset >= this.state.filters.limit) {
            this.state.filters.offset -= this.state.filters.limit;
        }
    }

    /**
     * Fetch transactions from API
     * @returns {Promise<Object>} Result with success/transactions/error
     */
    async fetchTransactions() {
        if (this.state.loading) return;
        this.state.loading = true;

        try {
            // Use the global TransactionLogger
            const result = await TransactionLogger.getTransactions(this.state.filters);

            if (result.success) {
                this.state.transactions = result.transactions;
                this.state.total = result.total;
            }

            return result;
        } finally {
            this.state.loading = false;
        }
    }

    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
}

// Export to window
window.TransactionsData = TransactionsData;
