// Logic for Update Item (Write)
const InventoryUpdate = {
    // Uses the same modal as create, so we assume InventoryCreate logic has loaded the DOM

    openEditModal(id) {
        const item = InventoryState.inventoryItems.find(i => i.id === id);
        if (!item) return;

        InventoryState.editingItemId = id;
        const images = InventoryImage.parseImages(item);
        InventoryState.currentImages = images.map(url => ({ url, file: null, uploading: false }));

        document.getElementById('modalTitle').textContent = 'Edit Item';
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) saveBtn.querySelector('.btn-text').textContent = 'Update Item';

        document.getElementById('itemId').value = item.id;
        document.getElementById('itemCategory').value = item.category;
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemDescription').value = item.description || '';
        document.getElementById('itemQuantity').value = item.quantity;
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
            const oldItem = InventoryState.inventoryItems.find(i => i.id === InventoryState.editingItemId);

            await InventoryImage.uploadPendingImages(productName);
            const imageUrls = InventoryState.currentImages.filter(img => img.url).map(img => img.url);

            const itemData = {
                id: InventoryState.editingItemId,
                category: document.getElementById('itemCategory').value,
                name: productName,
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
                await InventoryLoad.initialLoad();
                // Refresh view modal if it's currently open for this item
                if (InventoryState.viewingItemId === itemData.id) {
                    InventoryLoad.viewItem(itemData.id);
                }
            } else {
                throw new Error(result.error || 'Failed to update item');
            }
        } catch (error) {
            alert(error.message);
        } finally {
            saveBtn.classList.remove('loading');
            saveBtn.disabled = false;
        }
    },

    async generateQrForItem(itemId) {
        const item = InventoryState.inventoryItems.find(i => i.id === itemId);
        if (!item) return;

        try {
            const btn = document.getElementById('viewGenerateQrBtn');
            if (btn) { btn.classList.add('loading'); btn.disabled = true; }

            // Note: InventoryModal is being deleted. I need to move generateProductCode to utils.js! 
            // For now, I'll assume it's moved to Utils or implement here.

            // Let's implement here for safety
            const generateCode = (name) => {
                const timestamp = Date.now().toString(36);
                const random = Math.random().toString(36).substring(2, 6);
                const safeName = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
                return `TVS-${safeName}-${timestamp}${random}`.toUpperCase();
            };

            const qrImageUrl = await InventoryImage.uploadQrCode(generateCode(item.name), item.name);
            if (!qrImageUrl) throw new Error('Failed to generate QR /n Please Connect with Google Drive first');

            const images = InventoryImage.parseImages(item);
            const updatePayload = {
                id: itemId,
                ...item,
                images,
                qr_image_url: qrImageUrl
            };

            const response = await fetch('/inventory/inventory_update_item', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
            });

            const result = await response.json();
            if (result.success) {
                await InventoryLoad.initialLoad();
                if (InventoryState.viewingItemId === itemId) {
                    InventoryLoad.viewItem(itemId);
                }
            }
        } catch (error) {
            console.error(error);
            alert('Failed to generate QR');
        } finally {
            const btn = document.getElementById('viewGenerateQrBtn');
            if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
        }
    }
};
