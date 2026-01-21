// Logic for Create Item (Write)
const InventoryCreate = {
    async init() {
        await this.loadItemModal();
    },

    async loadItemModal() {
        const container = document.getElementById('item-modal-container');
        if (!container) return;

        try {
            const response = await fetch('/inventory/inventory-add-edit-modal.html');
            if (response.ok) {
                container.innerHTML = await response.text();
                InventoryDOM.itemModal = document.getElementById('itemModal');
                InventoryDOM.itemForm = document.getElementById('itemForm');
            }
        } catch (error) {
            console.error('Error loading item modal:', error);
        }
    },

    openAddModal() {
        InventoryState.editingItemId = null;
        InventoryState.currentImages = [];

        document.getElementById('modalTitle').textContent = 'Add New Item';
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) saveBtn.querySelector('.btn-text').textContent = 'Save Item';

        // Set explicit create-data attribute if needed, but we handle logic here
        InventoryDOM.itemForm.reset();
        InventoryImage.renderImagesGrid();
        InventoryDOM.itemModal.classList.add('show');
    },

    async handleCreate(e) {
        e.preventDefault();
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.classList.add('loading');
        saveBtn.disabled = true;

        try {
            const productName = document.getElementById('itemName').value.trim();
            if (!productName) throw new Error('Product name is required');

            await InventoryImage.uploadPendingImages(productName);
            const imageUrls = InventoryState.currentImages.filter(img => img.url).map(img => img.url);

            const itemData = {
                category: document.getElementById('itemCategory').value,
                name: productName,
                description: document.getElementById('itemDescription').value.trim() || null,
                quantity: parseInt(document.getElementById('itemQuantity').value) || 0,
                cost_price: parseFloat(document.getElementById('itemCostPrice').value) || 0,
                sale_price: parseFloat(document.getElementById('itemSalePrice').value) || 0,
                images: imageUrls,
            };

            const response = await fetch('/inventory/inventory_create_item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemData)
            });
            const result = await response.json();

            if (result.success) {
                InventoryDOM.itemModal.classList.remove('show');
                if (window.TransactionLogger) TransactionLogger.logInventoryAdd(result.data || itemData);
                InventoryLoad.initialLoad();
            } else {
                throw new Error(result.error || 'Failed to create item');
            }
        } catch (error) {
            alert(error.message);
        } finally {
            saveBtn.classList.remove('loading');
            saveBtn.disabled = false;
        }
    },

    closeModal() {
        InventoryDOM.itemModal.classList.remove('show');
    }
};
