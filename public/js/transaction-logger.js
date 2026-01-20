// Transaction Logger Utility
// Use this to log transactions from the frontend

const TransactionLogger = {
    /**
     * Log an inventory add action
     */
    async logInventoryAdd(item) {
        return this.log({
            action_type: 'inventory_add',
            entity_id: item.id,
            entity_type: 'inventory',
            details: {
                name: item.name,
                category: item.category,
                quantity: item.quantity,
                cost_price: item.cost_price,
                sale_price: item.sale_price
            }
        });
    },

    /**
     * Log an inventory edit action
     */
    async logInventoryEdit(itemId, oldData, newData) {
        return this.log({
            action_type: 'inventory_edit',
            entity_id: itemId,
            entity_type: 'inventory',
            details: {
                old: oldData,
                new: newData,
                changes: this.getChanges(oldData, newData)
            }
        });
    },

    /**
     * Log an inventory delete action
     */
    async logInventoryDelete(item) {
        return this.log({
            action_type: 'inventory_delete',
            entity_id: item.id,
            entity_type: 'inventory',
            details: {
                name: item.name,
                category: item.category,
                quantity: item.quantity
            }
        });
    },

    /**
     * Log a sale completion
     */
    async logSaleComplete(saleData) {
        return this.log({
            action_type: 'sale_complete',
            entity_type: 'sale',
            sale_total: saleData.total,
            sale_items: saleData.items,
            customer_name: saleData.customerName,
            customer_email: saleData.customerEmail,
            details: {
                cash: saleData.cash,
                change: saleData.change,
                items_count: saleData.items.length
            }
        });
    },

    /**
     * Log a sale void action
     */
    async logSaleVoid(saleId, reason) {
        return this.log({
            action_type: 'sale_void',
            entity_id: saleId,
            entity_type: 'sale',
            details: {
                reason: reason
            }
        });
    },

    /**
     * Generic log function
     */
    async log(transactionData) {
        try {
            const response = await fetch('/api/transactions/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transactionData)
            });

            const result = await response.json();

            if (!response.ok) {
                console.error('Failed to log transaction:', result);
                return { success: false, error: result.error };
            }

            return { success: true, transaction: result.transaction };
        } catch (error) {
            console.error('Error logging transaction:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get list of transactions
     */
    async getTransactions(filters = {}) {
        try {
            const params = new URLSearchParams(filters);
            const response = await fetch(`/api/transactions/list?${params}`);
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

    /**
     * Get transaction statistics
     */
    async getStats(dateRange = {}) {
        try {
            const params = new URLSearchParams(dateRange);
            const response = await fetch(`/api/transactions/stats?${params}`);
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
    },

    /**
     * Get sales report
     */
    async getSalesReport(dateRange = {}) {
        try {
            const params = new URLSearchParams(dateRange);
            const response = await fetch(`/api/transactions/sales-report?${params}`);
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
    },

    /**
     * Helper: Get changes between old and new data
     */
    getChanges(oldData, newData) {
        const changes = {};
        for (const key in newData) {
            if (oldData[key] !== newData[key]) {
                changes[key] = {
                    from: oldData[key],
                    to: newData[key]
                };
            }
        }
        return changes;
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.TransactionLogger = TransactionLogger;
}
