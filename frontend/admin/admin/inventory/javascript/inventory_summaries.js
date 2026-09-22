// Dedicated module for inventory summary and KPI counts (RPC client + DOM rendering)
const InventorySummaries = {
    async fetchSummaries() {
        try {
            const response = await fetch('/inventory/inventory_summaries', {
                method: 'GET',
                credentials: 'include'
            });
            const result = await response.json();
            if (!response.ok || !result?.success) {
                return { success: false, error: result?.error || 'Unable to load inventory summaries.' };
            }
            return result;
        } catch (error) {
            console.error('Error fetching inventory summaries:', error);
            return { success: false, error: error.message };
        }
    },

    async updateSummaryStats() {
        try {
            const result = await this.fetchSummaries();
            if (result?.success && result.data) {
                const {
                    total_products_inventory,
                    total_quantity_inventory,
                    total_low_stock_inventory,
                    total_out_of_stock_inventory
                } = result.data;
                if (InventoryDOM.statTotalProducts) InventoryDOM.statTotalProducts.textContent = Number(total_products_inventory ?? 0).toLocaleString();
                if (InventoryDOM.statTotalStock) InventoryDOM.statTotalStock.textContent = Number(total_quantity_inventory ?? 0).toLocaleString();
                if (InventoryDOM.statLowStock) InventoryDOM.statLowStock.textContent = Number(total_low_stock_inventory ?? 0).toLocaleString();
                if (InventoryDOM.statOutStock) InventoryDOM.statOutStock.textContent = Number(total_out_of_stock_inventory ?? 0).toLocaleString();
                return;
            }
        } catch (err) {
            console.warn('Could not fetch inventory summaries via RPC, falling back to local count:', err);
        }

        // Fallback to local computation if RPC fails or is unavailable
        const items = InventoryState.inventoryItems || [];
        const totalProducts = items.length;
        let totalStock = 0;
        let lowStockCount = 0;
        let outOfStockCount = 0;

        items.forEach(item => {
            const qty = Number(item.quantity) || 0;
            totalStock += qty;
            if (qty === 0) {
                outOfStockCount++;
            } else if (qty <= 5) {
                lowStockCount++;
            }
        });

        if (InventoryDOM.statTotalProducts) InventoryDOM.statTotalProducts.textContent = totalProducts.toLocaleString();
        if (InventoryDOM.statTotalStock) InventoryDOM.statTotalStock.textContent = totalStock.toLocaleString();
        if (InventoryDOM.statLowStock) InventoryDOM.statLowStock.textContent = lowStockCount.toLocaleString();
        if (InventoryDOM.statOutStock) InventoryDOM.statOutStock.textContent = outOfStockCount.toLocaleString();
    }
};

window.InventorySummaries = InventorySummaries;
