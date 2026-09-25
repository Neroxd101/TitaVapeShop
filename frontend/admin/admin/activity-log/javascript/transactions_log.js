/**
 * Log various types of transactions (sales, inventory changes)
 */
const TransactionsLog = {
    /**
     * Generic log function
     * @param {Object} transactionData - The data to log
     * @returns {Promise<Object>} The result of the log operation
     */
    async log(transactionData) {
        try {
            const response = await fetch('/transactions/transactions_log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include', // Include cookies for authentication
                body: JSON.stringify(transactionData)
            });

            // Check if response is JSON before parsing
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response received:', text.substring(0, 200));
                return { success: false, error: 'Server returned non-JSON response. Check authentication.' };
            }

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
     * Helper: Get changes between old and new data
     */
    getChanges(oldData, newData) {
        const changes = {};
        for (const key in newData) {
            if (key === 'variations') {
                const variationChanges = this.getVariationChanges(oldData[key], newData[key]);
                if (variationChanges.length > 0) {
                    changes[key] = { items: variationChanges };
                }
                continue;
            }

            const oldValue = oldData[key];
            const newValue = newData[key];
            const valuesMatch = (oldValue && typeof oldValue === 'object') || (newValue && typeof newValue === 'object')
                ? JSON.stringify(oldValue ?? null) === JSON.stringify(newValue ?? null)
                : oldValue === newValue;
            if (!valuesMatch) {
                changes[key] = {
                    from: oldValue,
                    to: newValue
                };
            }
        }
        return changes;
    },

    getVariationChanges(oldValue, newValue) {
        const parse = (value) => {
            if (Array.isArray(value)) return value;
            if (typeof value !== 'string' || !value.trim()) return [];
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return value.split('|').map(name => ({ name: name.trim(), quantity: 0 })).filter(item => item.name);
            }
        };
        const normalize = (value) => parse(value)
            .filter(item => item && String(item.name || '').trim())
            .map(item => ({ name: String(item.name).trim(), quantity: Number(item.quantity) || 0 }));
        const oldVariations = normalize(oldValue);
        const newVariations = normalize(newValue);
        const oldByName = new Map(oldVariations.map(item => [item.name.toLowerCase(), item]));
        const newByName = new Map(newVariations.map(item => [item.name.toLowerCase(), item]));
        const changes = [];

        newVariations.forEach(item => {
            const previous = oldByName.get(item.name.toLowerCase());
            if (!previous) {
                changes.push({ type: 'added', name: item.name, quantity: item.quantity });
            } else if (previous.quantity !== item.quantity) {
                changes.push({ type: 'quantity', name: item.name, from: previous.quantity, to: item.quantity });
            }
        });
        oldVariations.forEach(item => {
            if (!newByName.has(item.name.toLowerCase())) {
                changes.push({ type: 'removed', name: item.name, quantity: item.quantity });
            }
        });
        return changes;
    }
};

// Export to window for global access if needed
window.TransactionsLog = TransactionsLog;
// Map to old global name for backward compatibility during migration
window.TransactionLogger = TransactionsLog;
