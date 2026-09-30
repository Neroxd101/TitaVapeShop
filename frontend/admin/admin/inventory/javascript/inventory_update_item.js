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
        if (this.isUpdating) return;
        this.isUpdating = true;
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.disabled = true;

        try {
            const productName = document.getElementById('itemName').value.trim();
            if (!InventoryDOM.itemForm.reportValidity()) return;
            if (!productName) throw new Error('Product name is required');
            InventoryCreate.validateVariationQuantities();
            const oldItem = InventoryState.inventoryItems.find(i => i.id === InventoryState.editingItemId);
            if (!oldItem) throw new Error('Item not found. Please reload the inventory.');
            if (!await this.confirmUpdate(productName)) return;
            saveBtn.classList.add('loading');

            await InventoryImage.uploadPendingImages(productName);
            const imageUrls = InventoryState.currentImages.filter(img => img.url).map(img => img.url);

            const itemData = {
                id: InventoryState.editingItemId,
                category: document.getElementById('itemCategory').value,
                name: productName,
                description: document.getElementById('itemDescription').value.trim() || null,
                cost_price: parseFloat(document.getElementById('itemCostPrice').value) || 0,
                sale_price: parseFloat(document.getElementById('itemSalePrice').value) || 0,
                images: imageUrls,
            };

            const quantity = parseInt(document.getElementById('itemQuantity').value, 10) || 0;
            if (quantity !== oldItem.quantity) {
                itemData.quantity = quantity;
                itemData.expected_quantity = oldItem.quantity;
            }
            const variations = InventoryCreate.getVariationValue();
            const originalVariations = oldItem.variations || [];
            if (JSON.stringify(variations) !== JSON.stringify(originalVariations)) {
                itemData.variations = variations;
                itemData.expected_variations = originalVariations;
            }

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
            this.isUpdating = false;
            saveBtn.classList.remove('loading');
            saveBtn.disabled = false;
        }
    },

    confirmUpdate(productName) {
        const dialog = document.getElementById('confirmItemUpdateModal');
        document.getElementById('confirmItemUpdateName').textContent = productName;
        dialog.returnValue = 'cancel';
        return new Promise(resolve => {
            dialog.addEventListener('close', () => {
                resolve(dialog.returnValue === 'confirm');
                // The submit button was disabled while awaiting confirmation.
                queueMicrotask(() => document.getElementById('saveBtn')?.focus());
            }, { once: true });
            dialog.showModal();
        });
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
