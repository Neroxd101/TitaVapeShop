// Logic for Item Details View Modal
const InventoryViewModal = {
    THUMBNAILS_PER_PAGE: 3,
    thumbnailPage: 0,
    currentImages: [],
    activeImageIndex: 0,

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
            if (this.currentImages[index]) this.setViewMainImage(this.currentImages[index], index);
        });
        document.getElementById('viewThumbnailPrevBtn')?.addEventListener('click', () => this.changeThumbnailPage(-1));
        document.getElementById('viewThumbnailNextBtn')?.addEventListener('click', () => this.changeThumbnailPage(1));

        document.getElementById('viewEditBtn')?.addEventListener('click', () => {
            const id = InventoryState.viewingItemId;
            this.closeViewModal();
            if (id && window.InventoryUpdate?.openEditModal) InventoryUpdate.openEditModal(id);
        });

        document.getElementById('viewGenerateQrBtn')?.addEventListener('click', () => {
            if (InventoryState.viewingItemId && window.InventoryGenerateQr?.forItem) {
                InventoryGenerateQr.forItem(InventoryState.viewingItemId);
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
        this.currentImages = images;
        this.thumbnailPage = 0;
        this.activeImageIndex = 0;

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

        this.renderThumbnails();

        document.getElementById('viewCategory').textContent = item.category;
        document.getElementById('viewCategory').className = `view-category ${item.category}`;
        document.getElementById('viewName').textContent = item.name;
        document.getElementById('viewDescription').textContent = item.description || '';

        const variationsSection = document.getElementById('viewVariations');
        const variationsList = document.getElementById('viewVariationList');
        const variations = Array.isArray(item.variations)
            ? item.variations.filter(variation => variation && variation.name)
            : [];
        InventoryDOM.viewModal.classList.toggle('has-variations', variations.length > 0);
        InventoryDOM.viewModal.classList.toggle('no-variations', variations.length === 0);
        if (variationsSection && variationsList) {
            variationsSection.hidden = variations.length === 0;
            variationsList.replaceChildren(...variations.map(variation => {
                const row = document.createElement('div');
                row.className = 'view-variation-row';
                const name = document.createElement('span');
                name.className = 'view-variation-name';
                name.textContent = variation.name;
                const quantity = document.createElement('span');
                quantity.className = 'view-variation-quantity';
                quantity.textContent = `( Qty : ${Number(variation.quantity) || 0} )`;
                row.append(name, quantity);
                return row;
            }));
        }
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
        this.activeImageIndex = activeIndex;
        const mainImageEl = document.getElementById('viewMainImage');
        const fallbacks = InventoryImage.getFallbackUrls(url, 800);
        mainImageEl.innerHTML = `<img src="${fallbacks[0]}">`;
        document.querySelectorAll('#viewThumbnails .view-thumbnail').forEach(thumbnail => {
            thumbnail.classList.toggle('active', Number(thumbnail.dataset.imageIndex) === activeIndex);
        });
    },

    renderThumbnails() {
        const thumbnailsEl = document.getElementById('viewThumbnails');
        const carousel = document.getElementById('viewThumbnailCarousel');
        if (!thumbnailsEl || !carousel) return;

        const pageCount = this.currentImages.length > 5 ? 2 : 1;
        this.thumbnailPage = Math.min(Math.max(0, this.thumbnailPage), pageCount - 1);

        const start = this.thumbnailPage === 0 ? 0 : 5;
        const pageSize = this.thumbnailPage === 0 ? 5 : 6;
        const slotCount = 6;
        const tiles = this.currentImages.slice(start, start + pageSize).map((url, offset) => {
            const index = start + offset;
            const fallbacks = InventoryImage.getFallbackUrls(url, 100);
            return `<div class="view-thumbnail ${index === this.activeImageIndex ? 'active' : ''}" data-image-index="${index}"><img src="${fallbacks[0]}" alt="Product thumbnail ${index + 1}" data-original-url="${url}" data-fallback-size="100" data-tried-index="0"></div>`;
        });
        thumbnailsEl.innerHTML = tiles.join('');
        carousel.style.setProperty('--view-thumbnail-columns', String(slotCount));
        carousel.hidden = this.currentImages.length <= 1;

        const previousButton = document.getElementById('viewThumbnailPrevBtn');
        const nextButton = document.getElementById('viewThumbnailNextBtn');
        if (previousButton) previousButton.disabled = this.thumbnailPage === 0;
        if (nextButton) nextButton.disabled = this.thumbnailPage >= pageCount - 1;
    },

    changeThumbnailPage(direction) {
        this.thumbnailPage += direction;
        this.renderThumbnails();
    },

    closeViewModal() {
        InventoryDOM.viewModal?.classList.remove('show');
        InventoryState.viewingItemId = null;
        this.currentImages = [];
        this.thumbnailPage = 0;
        this.activeImageIndex = 0;
    }
};

window.InventoryViewModal = InventoryViewModal;
