// Logic for Loading and Rendering Sales Products
const SalesLoad = {
    async init(state) {
        await this.loadProducts(state);
    },

    async loadProducts(state) {
        try {
            // Re-use inventory load route or potentially a specific sales load route
            // For now, it seems it uses the inventory load
            const response = await fetch('/inventory/load-items');
            const result = await response.json();

            if (result.success) {
                state.products = (result.data || []).filter(p => !p.deleted);
                state.filtered = state.products; // Initial filter is all
            } else {
                console.error('Failed to load inventory for POS:', result.error);
                state.products = [];
                state.filtered = [];
            }
        } catch (err) {
            console.error('Error loading inventory for POS:', err);
            state.products = [];
            state.filtered = [];
        }

        this.renderProducts(state);
    },

    filterProducts(state) {
        const q = (document.getElementById('productSearch')?.value || '').toLowerCase();
        const category = document.getElementById('productCategoryFilter')?.value || '';

        state.filtered = state.products.filter(item => {
            if (category && item.category !== category) return false;
            if (!q) return true;
            const haystack = `${item.name || ''} ${item.category || ''} ${item.description || ''}`.toLowerCase();
            return haystack.includes(q);
        });

        this.renderProducts(state);
    },

    renderProducts(state) {
        if (!state) return;
        const listEl = document.getElementById('productList');
        if (!listEl) return;

        listEl.innerHTML = '';

        if (!state.filtered || !state.filtered.length) {
            const empty = document.createElement('div');
            empty.className = 'cart-empty';
            empty.textContent = 'No products found.';
            listEl.appendChild(empty);
            return;
        }

        state.filtered.forEach(item => {
            const card = this.createProductCard(item, state);
            listEl.appendChild(card);
        });
    },

    createProductCard(item, state) {
        const card = document.createElement('div');
        card.className = 'pos-card';

        // Image
        const imageWrap = document.createElement('div');
        imageWrap.className = 'pos-card-image';

        // Optimized Image Loading logic (from Inventory handling)
        let imageUrl = '';
        if (typeof InventoryImage !== 'undefined') {
            const images = InventoryImage.parseImages(item);
            const nonQrImages = images.filter(url => url && url !== item.qr_image_url);
            const firstImage = nonQrImages.length ? nonQrImages[0] : (images.length ? images[0] : '');

            if (firstImage) {
                const fallbacks = InventoryImage.getFallbackUrls(firstImage, 400);
                imageUrl = fallbacks[0]; // Use thumbnail priority
            }
        }

        const img = document.createElement('img');
        if (imageUrl) {
            img.src = imageUrl;
            img.alt = item.name || 'Product';
            img.loading = 'lazy';
            img.onerror = function () {
                // Simple fallback to placeholder if thumbnail fails
                this.onerror = null;
                this.parentElement.innerHTML = '<div class="no-image-message"><i class="fas fa-image"></i></div>';
            };
        } else {
            img.alt = 'No image';
            // Placeholder check handled by parent style usually, or we can explicit inject placeholder
            imageWrap.innerHTML = '<div class="no-image-message"><i class="fas fa-image"></i></div>';
        }

        if (img.src) imageWrap.appendChild(img);

        const body = document.createElement('div');
        body.className = 'pos-card-body';

        // Header
        const header = document.createElement('div');
        header.className = 'pos-card-header';

        const category = document.createElement('span');
        category.className = `pos-card-category ${item.category || ''}`.trim();
        category.textContent = item.category || 'Uncategorized';

        const stock = document.createElement('span');
        stock.className = 'pos-card-stock';
        const originalQty = item.quantity || 0;
        const cartItem = state.cart.find(c => c.id === item.id);
        const cartQty = cartItem ? cartItem.qty : 0;
        const availableQty = Math.max(0, originalQty - cartQty);
        stock.textContent = `Stock: ${availableQty}`;

        if (availableQty <= 0) stock.classList.add('out');
        else if (availableQty <= 3) stock.classList.add('low');

        header.appendChild(category);
        header.appendChild(stock);

        const nameEl = document.createElement('h3');
        nameEl.className = 'pos-card-name';
        nameEl.textContent = item.name || 'Unnamed';

        const priceRow = document.createElement('div');
        priceRow.className = 'pos-card-price-row';
        const priceLabel = document.createElement('span');
        priceLabel.className = 'pos-card-price-label';
        priceLabel.textContent = 'Price';
        const priceValue = document.createElement('span');
        priceValue.className = 'pos-card-price-value';
        const unitPrice = item.sale_price || item.cost_price || 0;

        priceValue.textContent = typeof InventoryUtils !== 'undefined'
            ? InventoryUtils.formatCurrency(unitPrice)
            : `₱${Number(unitPrice).toFixed(2)}`;

        priceRow.appendChild(priceLabel);
        priceRow.appendChild(priceValue);

        const actions = document.createElement('div');
        actions.className = 'pos-card-actions';

        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.min = '1';
        qtyInput.step = '1';
        qtyInput.value = '1';
        qtyInput.className = 'product-qty-input';

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'product-add-btn';
        addBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
      </svg>
      <span>Add</span>
    `;

        if (availableQty <= 0) {
            addBtn.disabled = true;
        }

        addBtn.addEventListener('click', () => {
            const qtyToAdd = Math.max(1, parseInt(qtyInput.value, 10) || 1);
            SalesCart.addToCart(state, item, qtyToAdd);
        });

        actions.appendChild(qtyInput);
        actions.appendChild(addBtn);

        body.appendChild(header);
        body.appendChild(nameEl);
        body.appendChild(priceRow);
        body.appendChild(actions);

        card.appendChild(imageWrap);
        card.appendChild(body);

        return card;
    }
};
