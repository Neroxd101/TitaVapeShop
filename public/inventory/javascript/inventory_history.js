// Logic for Sales History Modal
const InventoryHistory = {
    async init() {
        await this.loadHistoryModal();
    },

    async loadHistoryModal() {
        const container = document.getElementById('history-modal-container');
        if (!container) return;

        try {
            const response = await fetch('/inventory/inventory-history-modal.html');
            if (response.ok) {
                container.innerHTML = await response.text();
                InventoryDOM.historyModal = document.getElementById('historyModal');
            }
        } catch (error) {
            console.error('Error loading history modal:', error);
        }
    },

    async openHistoryModal(itemId) {
        if (!InventoryDOM.historyModal) {
            await this.loadHistoryModal();
        }

        const item = InventoryState.inventoryItems.find(i => i.id === itemId);
        if (!item) return;

        InventoryState.viewingHistoryItemId = itemId;
        
        // Set product name
        document.getElementById('historyProductName').textContent = item.name;
        
        // Show loading state
        document.getElementById('historyLoading').style.display = 'block';
        document.getElementById('historyTableBody').innerHTML = '';
        document.getElementById('historyEmpty').style.display = 'none';
        
        // Show modal
        InventoryDOM.historyModal.classList.add('show');
        
        // Load sales history
        await this.loadSalesHistory(itemId);
    },

    async loadSalesHistory(itemId) {
        try {
            const response = await fetch(`/inventory/inventory_get_sales_history/${itemId}`);
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to load sales history');
            }

            const sales = result.sales || [];
            const tbody = document.getElementById('historyTableBody');
            const emptyState = document.getElementById('historyEmpty');
            const loadingState = document.getElementById('historyLoading');

            loadingState.style.display = 'none';

            if (sales.length === 0) {
                emptyState.style.display = 'block';
                tbody.innerHTML = '';
            } else {
                emptyState.style.display = 'none';
                tbody.innerHTML = sales.map(sale => this.createSaleRow(sale)).join('');
            }

            // Update stats
            const totalSales = sales.length;
            const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.subtotal || 0), 0);
            
            document.getElementById('historyTotalSales').textContent = totalSales;
            document.getElementById('historyTotalRevenue').textContent = InventoryUtils.formatCurrency(totalRevenue);
        } catch (error) {
            console.error('Error loading sales history:', error);
            document.getElementById('historyLoading').style.display = 'none';
            document.getElementById('historyTableBody').innerHTML = 
                `<tr><td colspan="6" style="text-align: center; color: var(--error);">Error: ${error.message}</td></tr>`;
        }
    },

    createSaleRow(sale) {
        const saleDate = InventoryUtils.formatDate(sale.sale_date);
        const quantity = sale.quantity_sold || 0;
        const price = InventoryUtils.formatCurrency(sale.sale_price || 0);
        const subtotal = InventoryUtils.formatCurrency(sale.subtotal || 0);
        const customer = sale.customer_name || sale.customer_email || '-';
        const soldBy = sale.user_email || '-';

        return `
            <tr>
                <td>${saleDate}</td>
                <td>${quantity}</td>
                <td>${price}</td>
                <td><strong>${subtotal}</strong></td>
                <td>${customer}</td>
                <td>${soldBy}</td>
            </tr>
        `;
    },

    closeHistoryModal() {
        InventoryDOM.historyModal?.classList.remove('show');
        InventoryState.viewingHistoryItemId = null;
    }
};
