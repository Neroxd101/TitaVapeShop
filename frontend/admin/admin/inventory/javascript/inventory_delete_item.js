// Logic for Delete Item (Write)
const InventoryDelete = {
    async init() {
        await this.loadDeleteModal();
    },

    async loadDeleteModal() {
        const container = document.getElementById('delete-modal-container');
        if (!container) return;

        try {
            const response = await fetch('/admin/admin/inventory/inventory-delete-modal.html');
            if (response.ok) {
                container.innerHTML = await response.text();
                InventoryDOM.deleteModal = document.getElementById('deleteModal');
                this.setupEventListeners();
            }
        } catch (error) {
            console.error('Error loading delete modal:', error);
        }
    },

    setupEventListeners() {
        document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => this.handleDeleteConfirmed());
        document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => this.closeModal());
        InventoryDOM.deleteModal?.addEventListener('click', (e) => {
            if (e.target === InventoryDOM.deleteModal) this.closeModal();
        });
    },

    async openDeleteModal(id, name) {
        InventoryState.deletingItemId = id;
        const nameEl = document.getElementById('deleteItemName');
        if (nameEl) nameEl.textContent = name;
        InventoryDOM.deleteModal.classList.add('show');
        const impact = document.getElementById('deleteOrderImpact');
        const errorEl = document.getElementById('deleteItemError');
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        errorEl.hidden = true;
        impact.textContent = 'Checking affected orders...';
        confirmBtn.disabled = true;
        try {
            const response = await fetch(`/inventory/inventory_delete_item/${encodeURIComponent(id)}/preview`, {
                headers: { Accept: 'application/json' }
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || 'Unable to check affected orders.');
            if (InventoryState.deletingItemId !== id) return;
            impact.textContent = `This will update ${result.affected_orders} active order(s) and cancel ${result.cancelled_orders}.` +
                (result.payment_review_orders ? ` ${result.payment_review_orders} order(s) will need payment or refund review.` : '');
            confirmBtn.disabled = false;
        } catch (error) {
            if (InventoryState.deletingItemId !== id) return;
            impact.textContent = '';
            errorEl.textContent = error.message;
            errorEl.hidden = false;
        }
    },

    async handleDeleteConfirmed() {
        if (!InventoryState.deletingItemId) return;

        const deleteBtn = document.getElementById('confirmDeleteBtn');
        deleteBtn.classList.add('loading');
        deleteBtn.disabled = true;

        try {
            const response = await fetch(`/inventory/inventory_delete_item/${InventoryState.deletingItemId}`, {
                method: 'DELETE'
            });
            const result = await response.json();

            if (result.success) {
                InventoryDOM.deleteModal.classList.remove('show');
                // Deletion and its audit entry are committed together by the database.
                InventoryState.deletingItemId = null;
                if (result.payment_review_orders) alert(`${result.payment_review_orders} affected order(s) need payment or refund review. Check the order details.`);
                await InventoryDisplay.initialLoad();
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

window.InventoryDelete = InventoryDelete;
