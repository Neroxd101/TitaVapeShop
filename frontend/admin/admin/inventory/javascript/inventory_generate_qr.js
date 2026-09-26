// Generate and save a QR code for an inventory item.
const InventoryGenerateQr = {
    showGoogleConnectModal() {
        const modal = document.getElementById('googleQrConnectModal');
        if (!modal) return;

        const close = () => modal.classList.remove('show');
        document.getElementById('cancelGoogleQrConnect').onclick = close;
        document.getElementById('connectGoogleForQr').onclick = () => {
            window.location.href = '/settings';
        };
        modal.onclick = event => {
            if (event.target === modal) close();
        };
        modal.classList.add('show');
    },

    generateCode(name) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 6);
        const safeName = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
        return `TVS-${safeName}-${timestamp}${random}`.toUpperCase();
    },

    async forItem(itemId) {
        const item = InventoryState.inventoryItems.find(candidate => candidate.id === itemId);
        if (!item) return;

        if (!InventoryUtils.isGoogleConnected()) {
            this.showGoogleConnectModal();
            return;
        }

        const button = document.getElementById('viewGenerateQrBtn');
        try {
            if (button) {
                button.classList.add('loading');
                button.disabled = true;
            }

            const qrImageUrl = await InventoryImage.uploadQrCode(this.generateCode(item.name), item.name);
            if (!qrImageUrl) throw new Error('Failed to generate QR code. Please connect Google Drive first.');

            const response = await fetch('/inventory/inventory_update_item', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: itemId,
                    ...item,
                    images: InventoryImage.parseImages(item),
                    qr_image_url: qrImageUrl
                })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Failed to save QR code');

            await InventoryLoad.initialLoad();
            if (InventoryState.viewingItemId === itemId) InventoryLoad.viewItem(itemId);
        } catch (error) {
            console.error(error);
            alert(error.message || 'Failed to generate QR code');
        } finally {
            if (button) {
                button.classList.remove('loading');
                button.disabled = false;
            }
        }
    }
};

window.InventoryGenerateQr = InventoryGenerateQr;
