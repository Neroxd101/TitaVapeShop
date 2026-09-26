// Handle inventory product search input.
const InventorySearch = {
    init() {
        InventoryDOM.searchInput?.addEventListener('input', event => {
            InventoryState.searchQuery = event.target.value;
            InventoryState.currentPage = 1;
            InventoryDisplay.renderInventory();
        });
    }
};

window.InventorySearch = InventorySearch;
