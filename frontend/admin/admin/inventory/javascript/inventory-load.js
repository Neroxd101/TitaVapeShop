// Logic for Load Items (Read)
const InventoryLoad = {
    // Initialize
    async init() {
        await this.loadViewModal();
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

    async loadViewModal() {
        const container = document.getElementById('view-modal-container');
        if (!container) return;

        try {
            const response = await fetch('/admin/admin/inventory/inventory-view-modal.html');
            if (response.ok) {
                container.innerHTML = await response.text();
                InventoryDOM.viewModal = document.getElementById('viewModal');
            }
        } catch (error) {
            console.error('Error loading view modal:', error);
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
        const filtered = InventoryState.inventoryItems.filter(item => {
            const matchesCategory = InventoryState.currentFilter === 'all' || item.category === InventoryState.currentFilter;
            const matchesSearch = item.name.toLowerCase().includes(InventoryState.searchQuery.toLowerCase());

            // Use the same local calendar date shown in the item details.
            let matchesDate = true;
            if (InventoryState.addedDateFrom || InventoryState.addedDateTo) {
                const created = new Date(item.created_at);
                const localDate = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
                matchesDate = Boolean(item.created_at) && !Number.isNaN(created.getTime())
                    && (!InventoryState.addedDateFrom || localDate >= InventoryState.addedDateFrom)
                    && (!InventoryState.addedDateTo || localDate <= InventoryState.addedDateTo);
            }
            return matchesCategory && matchesSearch && matchesDate;
        });

        return this.sortItems(filtered);
    },

    sortItems(items) {
        const sortType = InventoryState.sortBy || 'date-desc';
        return [...items].sort((a, b) => {
            switch (sortType) {
                case 'name-asc':
                    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
                case 'name-desc':
                    return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });
                case 'price-asc':
                    return (Number(a.sale_price) || 0) - (Number(b.sale_price) || 0);
                case 'price-desc':
                    return (Number(b.sale_price) || 0) - (Number(a.sale_price) || 0);
                case 'stock-asc':
                    return (Number(a.quantity) || 0) - (Number(b.quantity) || 0);
                case 'stock-desc':
                    return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
                case 'date-asc': {
                    const timeA = new Date(a.created_at).getTime() || 0;
                    const timeB = new Date(b.created_at).getTime() || 0;
                    return timeA - timeB;
                }
                case 'date-desc':
                default: {
                    const timeA = new Date(a.created_at).getTime() || 0;
                    const timeB = new Date(b.created_at).getTime() || 0;
                    return timeB - timeA;
                }
            }
        });
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
    },

    showLoading(show) {
        if (InventoryDOM.loadingState) InventoryDOM.loadingState.style.display = show ? 'block' : 'none';
        if (InventoryDOM.inventoryGrid) InventoryDOM.inventoryGrid.style.display = show ? 'none' : 'grid';
    }
};
