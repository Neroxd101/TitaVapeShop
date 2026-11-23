// Handle inventory pagination controls.
const InventoryPagination = {
    init() {
        const largeScreen = window.matchMedia('(min-width: 1900px) and (min-height: 900px)');
        const defaultOption = InventoryDOM.pageSizeSelect?.querySelector('option[value="12"]');
        const updateDefault = () => {
            const pageSize = largeScreen.matches ? 10 : 12;
            if (defaultOption) {
                defaultOption.value = pageSize;
                defaultOption.textContent = pageSize;
            }
            return pageSize;
        };

        InventoryState.pageSize = updateDefault();
        largeScreen.addEventListener('change', () => {
            const usesDefault = InventoryState.pageSize === 10 || InventoryState.pageSize === 12;
            const pageSize = updateDefault();
            if (usesDefault) this.setPageSize(pageSize);
        });

        InventoryDOM.prevPageBtn?.addEventListener('click', () => {
            this.goToPage(InventoryState.currentPage - 1);
        });

        InventoryDOM.nextPageBtn?.addEventListener('click', () => {
            this.goToPage(InventoryState.currentPage + 1);
        });

        InventoryDOM.pageSizeSelect?.addEventListener('change', event => {
            this.setPageSize(event.target.value);
        });
    },

    updateControls(totalItems) {
        if (!InventoryDOM.paginationControls) return;

        if (totalItems <= 0) {
            InventoryDOM.paginationControls.style.display = 'none';
            return;
        }

        InventoryDOM.paginationControls.style.display = 'flex';

        const isAll = InventoryState.pageSize === 'all';
        const currentPage = InventoryState.currentPage;
        const totalPages = InventoryState.totalPages;
        if (InventoryDOM.pageInfo) {
            InventoryDOM.pageInfo.textContent = isAll
                ? `Showing all ${totalItems} items`
                : `Page ${currentPage} of ${totalPages} (${totalItems} items)`;
        }
        if (InventoryDOM.prevPageBtn) InventoryDOM.prevPageBtn.disabled = isAll || currentPage <= 1;
        if (InventoryDOM.nextPageBtn) InventoryDOM.nextPageBtn.disabled = isAll || currentPage >= totalPages;
    },

    goToPage(page) {
        if (page < 1 || page > InventoryState.totalPages) return;
        InventoryState.currentPage = page;
        InventoryDisplay.renderInventory();
        InventoryDOM.inventoryGrid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    setPageSize(size) {
        InventoryState.pageSize = size === 'all' ? 'all' : Number(size);
        InventoryState.currentPage = 1;
        InventoryDisplay.renderInventory();
    }
};

window.InventoryPagination = InventoryPagination;
