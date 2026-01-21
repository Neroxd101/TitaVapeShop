// Logic for Delete Item (Write)
const InventoryDelete = {
    async init() {
        await this.loadDeleteModal();
    },

    async loadDeleteModal() {
        const container = document.getElementById('delete-modal-container');
        if (!container) return;

        try {
            const response = await fetch('/inventory/inventory-delete-modal.html');
            if (response.ok) {
                container.innerHTML = await response.text();
                InventoryDOM.deleteModal = document.getElementById('deleteModal');
            }
        } catch (error) {
            console.error('Error loading delete modal:', error);
        }
    },

    openDeleteModal(id, name) {
        InventoryState.deletingItemId = id;
        const nameEl = document.getElementById('deleteItemName');
        if (nameEl) nameEl.textContent = name;
        InventoryDOM.deleteModal.classList.add('show');
    },

    async handleDeleteConfirmed() {
        if (!InventoryState.deletingItemId) return;

        const deleteBtn = document.getElementById('confirmDeleteBtn');
        deleteBtn.classList.add('loading');
        deleteBtn.disabled = true;

        try {
            const deletingItem = InventoryState.inventoryItems.find(i => i.id === InventoryState.deletingItemId);

            const response = await fetch(`/inventory/inventory_delete_item/${InventoryState.deletingItemId}`, {
                method: 'DELETE'
            });
            const result = await response.json();

            if (result.success) {
                InventoryDOM.deleteModal.classList.remove('show');
                if (window.TransactionLogger && deletingItem) TransactionLogger.logInventoryDelete(deletingItem);
                InventoryLoad.initialLoad();
            } else {
                throw new Error(result.error || 'Failed to delete item');
            }
        } catch (error) {
            alert(error.message);
        } finally {
            deleteBtn.classList.remove('loading');
            deleteBtn.disabled = false;
        }
    },

    closeModal() {
        InventoryDOM.deleteModal.classList.remove('show');
        InventoryState.deletingItemId = null;
    }
};
