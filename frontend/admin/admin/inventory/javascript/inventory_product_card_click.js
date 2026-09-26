// Handle actions on inventory product cards in the grid.
const InventoryProductCard = {
    init() {
        InventoryDOM.inventoryGrid?.addEventListener('click', event => {
            const card = event.target.closest('.inventory-card');
            if (!card) return;

            const action = event.target.closest('[data-action]')?.dataset.action;
            if (action === 'edit') {
                InventoryUpdate.openEditModal(card.dataset.id);
            } else if (action === 'delete') {
                const item = InventoryState.inventoryItems.find(candidate => candidate.id === card.dataset.id);
                if (item) InventoryDelete.openDeleteModal(item.id, item.name);
            } else if (window.InventoryViewModal?.viewItem) {
                InventoryViewModal.viewItem(card.dataset.id);
            }
        });
    }
};

window.InventoryProductCard = InventoryProductCard;
