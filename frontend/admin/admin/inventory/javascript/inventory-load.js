// Logic for Load Items (Read)
const InventoryLoad = {
    // Initialize
    async init() {
        if (window.InventoryViewModal?.init) {
            await window.InventoryViewModal.init();
        }
        this.initialLoad();
    },

    async initialLoad() {
        this.showLoading(true);
        try {
            const result = await window.InventoryGetAll.fetchItems();

            if (result.success) {
                InventoryState.inventoryItems = result.data || [];
            } else {
                console.error('Failed to load inventory:', result.error);
                InventoryState.inventoryItems = [];
            }
            this.renderInventory();
        } catch (error) {
            console.error('Error loading inventory:', error);
            InventoryState.inventoryItems = [];
            this.renderInventory();
        } finally {
            this.showLoading(false);
        }
    },

    renderInventory() {
        const filtered = this.filterItems();
        if (!InventoryDOM.inventoryGrid) return;

        if (filtered.length === 0) {
            InventoryDOM.inventoryGrid.innerHTML = '';
            InventoryDOM.emptyState.style.display = 'block';
            this.updatePaginationControls(0);
            this.updateSummaryStats();
            return;
        }

        InventoryDOM.emptyState.style.display = 'none';

        // Calculate pagination
        const pageSize = InventoryState.pageSize === 'all' ? filtered.length : Number(InventoryState.pageSize) || 12;
        InventoryState.totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        
        // Ensure currentPage is within valid bounds
        if (InventoryState.currentPage > InventoryState.totalPages) {
            InventoryState.currentPage = InventoryState.totalPages;
        }
        if (InventoryState.currentPage < 1) {
            InventoryState.currentPage = 1;
        }

        // Slice items for current page
        let pageItems = filtered;
        if (InventoryState.pageSize !== 'all') {
            const startIndex = (InventoryState.currentPage - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            pageItems = filtered.slice(startIndex, endIndex);
        }

        InventoryDOM.inventoryGrid.innerHTML = pageItems.map(item => this.createCard(item)).join('');
        this.updatePaginationControls(filtered.length);
        this.updateSummaryStats();
    },

    async updateSummaryStats() {
        if (window.InventorySummaries?.updateSummaryStats) {
            return await window.InventorySummaries.updateSummaryStats();
        }
    },

    updatePaginationControls(totalItems) {
        if (!InventoryDOM.paginationControls) return;

        if (totalItems <= 0) {
            InventoryDOM.paginationControls.style.display = 'none';
            return;
        }

        InventoryDOM.paginationControls.style.display = 'flex';

        const isAll = InventoryState.pageSize === 'all';
        const currentPage = InventoryState.currentPage;
        const totalPages = InventoryState.totalPages;

        if (InventoryDOM.pageInfo) {
            if (isAll) {
                InventoryDOM.pageInfo.textContent = `Showing all ${totalItems} items`;
            } else {
                InventoryDOM.pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${totalItems} items)`;
            }
        }

        if (InventoryDOM.prevPageBtn) {
            InventoryDOM.prevPageBtn.disabled = isAll || currentPage <= 1;
        }

        if (InventoryDOM.nextPageBtn) {
            InventoryDOM.nextPageBtn.disabled = isAll || currentPage >= totalPages;
        }
    },

    goToPage(page) {
        if (page < 1 || page > InventoryState.totalPages) return;
        InventoryState.currentPage = page;
        this.renderInventory();
        // Smooth scroll to top of grid
        InventoryDOM.inventoryGrid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    setPageSize(size) {
        InventoryState.pageSize = size === 'all' ? 'all' : Number(size);
        InventoryState.currentPage = 1;
        this.renderInventory();
    },

    filterItems() {
        if (window.InventoryFilter?.filterItems) {
            return window.InventoryFilter.filterItems(InventoryState.inventoryItems);
        }
        return InventoryState.inventoryItems || [];
    },

    sortItems(items) {
        if (window.InventoryFilter?.sortItems) {
            return window.InventoryFilter.sortItems(items);
        }
        return items;
    },

    createCard(item) {
        const isLowStock = item.quantity <= 5;
        const stockLabel = Number(item.quantity) === 0 ? '(No Stock)' : (isLowStock ? '(Low)' : '');
        const images = InventoryImage.parseImages(item);
        const nonQrImages = images.filter(url => url && url !== item.qr_image_url);
        const firstImage = nonQrImages.length > 0 ? nonQrImages[0] : (images.length > 0 ? images[0] : null);

        const imagesHtml = firstImage
            ? (() => {
                const fallbacks = InventoryImage.getFallbackUrls(firstImage, 800);
                return `<div class="card-images single"><img src="${fallbacks[0]}" alt="${item.name}" loading="lazy" data-original-url="${firstImage}" data-fallback-size="800" data-tried-index="0"></div>`;
            })()
            : `<div class="card-images"><div class="card-images-placeholder"><svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div></div>`;

        return `
      <div class="inventory-card" data-id="${item.id}">
        ${imagesHtml}
        <div class="card-header"><span class="card-category ${item.category}">${item.category}</span></div>
        <h3 class="card-name">${item.name}</h3>
        <div class="card-details">
          <div class="detail-item"><span class="detail-label">Quantity</span><span class="detail-value ${isLowStock ? 'low-stock' : ''}">${item.quantity} ${stockLabel}</span></div>
          <div class="detail-item"><span class="detail-label">Sale Price</span><span class="detail-value price">${InventoryUtils.formatCurrency(item.sale_price)}</span></div>
        </div>
        <div class="card-actions">
           <button class="btn-card btn-edit" data-action="edit">Edit</button>
           <button class="btn-card btn-delete" data-action="delete">Delete</button>
        </div>
      </div>
    `;
    },

    async viewItem(id) {
        if (window.InventoryViewModal?.viewItem) {
            return await window.InventoryViewModal.viewItem(id);
        }
    },

    setViewMainImage(url, activeIndex) {
        if (window.InventoryViewModal?.setViewMainImage) {
            window.InventoryViewModal.setViewMainImage(url, activeIndex);
        }
    },

    closeViewModal() {
        if (window.InventoryViewModal?.closeViewModal) {
            window.InventoryViewModal.closeViewModal();
        }
    },

    showLoading(show) {
        if (InventoryDOM.loadingState) InventoryDOM.loadingState.style.display = show ? 'block' : 'none';
        if (InventoryDOM.inventoryGrid) InventoryDOM.inventoryGrid.style.display = show ? 'none' : 'grid';
    }
};
