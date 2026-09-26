// Logic for Load Items (Read)
const InventoryDisplay = {
    // Initialize
    async init() {
        if (window.InventoryViewModal?.init) {
            await window.InventoryViewModal.init();
        }
        this.initialLoad();
    },

    async initialLoad() {
        this.showLoading(true);
        try {
            const result = await window.InventoryGetAll.fetchItems();

            if (result.success) {
                InventoryState.inventoryItems = result.data || [];
            } else {
                console.error('Failed to load inventory:', result.error);
                InventoryState.inventoryItems = [];
            }
            this.renderInventory();
        } catch (error) {
            console.error('Error loading inventory:', error);
            InventoryState.inventoryItems = [];
            this.renderInventory();
        } finally {
            this.showLoading(false);
        }
    },

    renderInventory() {
        const filtered = InventoryFilter.filterItems(InventoryState.inventoryItems);
        if (!InventoryDOM.inventoryGrid) return;

        if (filtered.length === 0) {
            InventoryDOM.inventoryGrid.innerHTML = '';
            InventoryDOM.emptyState.style.display = 'block';
            InventoryPagination.updateControls(0);
            InventorySummaries.updateSummaryStats();
            return;
        }

        InventoryDOM.emptyState.style.display = 'none';

        // Calculate pagination
        const pageSize = InventoryState.pageSize === 'all' ? filtered.length : Number(InventoryState.pageSize) || 12;
        InventoryState.totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        
        // Ensure currentPage is within valid bounds
        if (InventoryState.currentPage > InventoryState.totalPages) {
            InventoryState.currentPage = InventoryState.totalPages;
        }
        if (InventoryState.currentPage < 1) {
            InventoryState.currentPage = 1;
        }

        // Slice items for current page
        let pageItems = filtered;
        if (InventoryState.pageSize !== 'all') {
            const startIndex = (InventoryState.currentPage - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            pageItems = filtered.slice(startIndex, endIndex);
        }

        InventoryDOM.inventoryGrid.innerHTML = pageItems.map(item => InventoryProductCardRenderer.create(item)).join('');
        InventoryPagination.updateControls(filtered.length);
        InventorySummaries.updateSummaryStats();
    },

    showLoading(show) {
        if (InventoryDOM.loadingState) InventoryDOM.loadingState.style.display = show ? 'block' : 'none';
        if (InventoryDOM.inventoryGrid) InventoryDOM.inventoryGrid.style.display = show ? 'none' : 'grid';
    }
};
