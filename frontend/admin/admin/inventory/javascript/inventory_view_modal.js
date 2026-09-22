// Logic for Item Details View Modal
const InventoryViewModal = {
    async init() {
        await this.loadViewModal();
    },

    async loadViewModal() {
        const container = document.getElementById('view-modal-container');
        if (!container) return;

        try {
            const response = await fetch('/admin/admin/inventory/inventory-view-modal.html');
            if (response.ok) {
                container.innerHTML = await response.text();
                InventoryDOM.viewModal = document.getElementById('viewModal');
                this.setupEventListeners();
            }
        } catch (error) {
            console.error('Error loading view modal:', error);
        }
    },

    setupEventListeners() {
        document.getElementById('viewThumbnails')?.addEventListener('click', (e) => {
            const thumbnail = e.target.closest('.view-thumbnail');
            if (!thumbnail) return;
            const index = Number(thumbnail.dataset.imageIndex);
            const item = InventoryState.inventoryItems.find(i => i.id === InventoryState.viewingItemId);
            const images = item ? InventoryImage.parseImages(item) : [];
            if (item?.qr_image_url && !images.includes(item.qr_image_url)) images.push(item.qr_image_url);
            if (images[index]) this.setViewMainImage(images[index], index);
        });

        document.getElementById('viewEditBtn')?.addEventListener('click', () => {
            const id = InventoryState.viewingItemId;
            this.closeViewModal();
            if (id && window.InventoryUpdate?.openEditModal) InventoryUpdate.openEditModal(id);
        });

        document.getElementById('viewGenerateQrBtn')?.addEventListener('click', () => {
            if (InventoryState.viewingItemId && window.InventoryUpdate?.generateQrForItem) {
                InventoryUpdate.generateQrForItem(InventoryState.viewingItemId);
            }
        });

        document.getElementById('viewDeleteBtn')?.addEventListener('click', () => {
            const item = InventoryState.inventoryItems.find(i => i.id === InventoryState.viewingItemId);
            this.closeViewModal();
            if (item && window.InventoryDelete?.openDeleteModal) {
                InventoryDelete.openDeleteModal(item.id, item.name);
            }
        });

        document.getElementById('viewHistoryBtn')?.addEventListener('click', () => {
            if (InventoryState.viewingItemId && window.InventoryHistory?.openHistoryModal) {
                InventoryHistory.openHistoryModal(InventoryState.viewingItemId);
            }
        });

        InventoryDOM.viewModal?.addEventListener('click', (e) => {
            if (e.target === InventoryDOM.viewModal) this.closeViewModal();
        });
    },

    async viewItem(id) {
        const item = InventoryState.inventoryItems.find(i => i.id === id);
        if (!item || !InventoryDOM.viewModal) return;

        InventoryState.viewingItemId = id;
        const images = InventoryImage.parseImages(item);
        if (item.qr_image_url && !images.includes(item.qr_image_url)) images.push(item.qr_image_url);

        // Populate View Modal DOM
        const mainImageEl = document.getElementById('viewMainImage');
        if (images.length > 0) {
            const imgUrl = images[0];
            const fallbacks = InventoryImage.getFallbackUrls(imgUrl, 800);
            mainImageEl.innerHTML = `<img src="${fallbacks[0]}" alt="${item.name}">`;
            mainImageEl.classList.remove('no-image');
        } else {
            mainImageEl.innerHTML = '';
            mainImageEl.classList.add('no-image');
        }

        const thumbnailsEl = document.getElementById('viewThumbnails');
        if (images.length > 1) {
            thumbnailsEl.innerHTML = images.map((url, index) => {
                const fallbacks = InventoryImage.getFallbackUrls(url, 100);
                return `<div class="view-thumbnail ${index === 0 ? 'active' : ''}" data-image-index="${index}"><img src="${fallbacks[0]}" alt="Thumb" data-original-url="${url}" data-fallback-size="100" data-tried-index="0"></div>`;
            }).join('');
        } else {
            thumbnailsEl.innerHTML = '';
        }

        document.getElementById('viewCategory').textContent = item.category;
        document.getElementById('viewCategory').className = `view-category ${item.category}`;
        document.getElementById('viewName').textContent = item.name;
        document.getElementById('viewDescription').textContent = item.description || '';
        document.getElementById('viewQuantity').textContent = item.quantity;
        document.getElementById('viewCostPrice').textContent = InventoryUtils.formatCurrency(item.cost_price);
        document.getElementById('viewSalePrice').textContent = InventoryUtils.formatCurrency(item.sale_price);
        
        // Display total profit from database
        const profitEl = document.getElementById('viewProfit');
        const totalProfit = item.total_profit !== undefined ? item.total_profit : 0;
        profitEl.textContent = InventoryUtils.formatCurrency(totalProfit);
        
        // Apply styling based on profit
        profitEl.classList.remove('calculating');
        if (totalProfit < 0) {
            profitEl.classList.add('negative');
            profitEl.classList.remove('positive');
        } else {
            profitEl.classList.add('positive');
            profitEl.classList.remove('negative');
        }

        // Display dates
        const createdAtEl = document.getElementById('viewCreatedAt');
        const updatedAtEl = document.getElementById('viewUpdatedAt');
        if (createdAtEl && item.created_at) {
            createdAtEl.textContent = InventoryUtils.formatDate(item.created_at);
        }
        if (updatedAtEl && item.updated_at) {
            updatedAtEl.textContent = InventoryUtils.formatDate(item.updated_at);
        }

        const generateQrBtn = document.getElementById('viewGenerateQrBtn');
        const viewActions = document.querySelector('#viewModal .view-actions');
        if (generateQrBtn) {
            if (item.qr_image_url) {
                generateQrBtn.style.display = 'none';
                if (viewActions) viewActions.classList.add('qr-hidden');
            } else {
                generateQrBtn.style.display = '';
                if (viewActions) viewActions.classList.remove('qr-hidden');
            }
        }

        InventoryDOM.viewModal.classList.add('show');
    },

    setViewMainImage(url, activeIndex) {
        const mainImageEl = document.getElementById('viewMainImage');
        const fallbacks = InventoryImage.getFallbackUrls(url, 800);
        mainImageEl.innerHTML = `<img src="${fallbacks[0]}">`;
        document.querySelectorAll('.view-thumbnail').forEach((t, i) => t.classList.toggle('active', i === activeIndex));
    },

    closeViewModal() {
        InventoryDOM.viewModal?.classList.remove('show');
        InventoryState.viewingItemId = null;
    }
};

window.InventoryViewModal = InventoryViewModal;
