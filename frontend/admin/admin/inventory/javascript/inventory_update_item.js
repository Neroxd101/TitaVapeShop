// Logic for Update Item (Write)
const InventoryUpdate = {
    // Uses the same modal as create, so we assume InventoryCreate logic has loaded the DOM

    openEditModal(id) {
        const item = InventoryState.inventoryItems.find(i => i.id === id);
        if (!item) return;

        InventoryState.editingItemId = id;
        const images = InventoryImage.parseImages(item);
        InventoryState.currentImages = images.map(url => ({ url, file: null, uploading: false }));
        InventoryImage.thumbnailPage = 0;

        document.getElementById('modalTitle').textContent = 'Edit Item';
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) saveBtn.querySelector('.btn-text').textContent = 'Update Item';

        document.getElementById('itemId').value = item.id;
        document.getElementById('itemCategory').value = item.category;
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemQuantity').value = item.quantity;
        InventoryCreate.renderVariationFields(item.variations || item.variation || '');
        document.getElementById('itemDescription').value = item.description || '';
        document.getElementById('itemCostPrice').value = item.cost_price;
        document.getElementById('itemSalePrice').value = item.sale_price;

        InventoryImage.renderImagesGrid();
        InventoryDOM.itemModal.classList.add('show');
    },

    async handleUpdate(e) {
        e.preventDefault();
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.classList.add('loading');
        saveBtn.disabled = true;

        try {
            const productName = document.getElementById('itemName').value.trim();
            InventoryCreate.validateVariationQuantities();
            const oldItem = InventoryState.inventoryItems.find(i => i.id === InventoryState.editingItemId);

            await InventoryImage.uploadPendingImages(productName);
            const imageUrls = InventoryState.currentImages.filter(img => img.url).map(img => img.url);

            const itemData = {
                id: InventoryState.editingItemId,
                category: document.getElementById('itemCategory').value,
                name: productName,
                variations: InventoryCreate.getVariationValue(),
                description: document.getElementById('itemDescription').value.trim() || null,
                quantity: parseInt(document.getElementById('itemQuantity').value) || 0,
                cost_price: parseFloat(document.getElementById('itemCostPrice').value) || 0,
                sale_price: parseFloat(document.getElementById('itemSalePrice').value) || 0,
                images: imageUrls,
            };

            const response = await fetch('/inventory/inventory_update_item', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemData)
            });
            const result = await response.json();

            if (result.success) {
                InventoryDOM.itemModal.classList.remove('show');
                if (window.TransactionLogger) TransactionLogger.logInventoryEdit(itemData.id, oldItem, itemData);
                await InventoryDisplay.initialLoad();
                // Refresh view modal if it's currently open for this item
                if (InventoryState.viewingItemId === itemData.id) {
                    InventoryViewModal.viewItem(itemData.id);
                }
            } else {
                throw new Error(result.error || 'Failed to update item');
            }
        } catch (error) {
            if (error.message === 'Please connect your Google account first') {
                this.showGoogleQrConnectModal();
                return;
            }
            alert(error.message);
        } finally {
            saveBtn.classList.remove('loading');
            saveBtn.disabled = false;
        }
    },

    showGoogleQrConnectModal() {
        const modal = document.getElementById('googleQrConnectModal');
        if (!modal) return;

        const close = () => modal.classList.remove('show');
        document.getElementById('cancelGoogleQrConnect').onclick = close;
        document.getElementById('connectGoogleForQr').onclick = () => {
            window.location.href = '/settings';
        };
        modal.onclick = (event) => {
            if (event.target === modal) close();
        };
        modal.classList.add('show');
    },

};

window.InventoryUpdate = InventoryUpdate;
