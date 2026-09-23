// Logic for Loading and Rendering Sales Products
const SalesLoad = {
    async init(state) {
        this.renderSkeletons();
        await this.loadProducts(state);
    },

    async loadProducts(state) {
        try {
            const fetcher = window.PosGetProducts?.fetchProducts || window.InventoryGetAll?.fetchItems;
            const result = fetcher ? await fetcher() : { success: false, error: 'Module not available' };

            if (result.success) {
                state.products = (result.data || []).filter(p => !p.deleted);
                state.filtered = state.products; // Initial filter is all
            } else {
                console.error('Failed to load products for POS:', result.error);
                state.products = [];
                state.filtered = [];
            }
        } catch (err) {
            console.error('Error loading products for POS:', err);
            state.products = [];
            state.filtered = [];
        }

        this.filterProducts(state);
    },

    filterProducts(state) {
        if (window.SalesFilter?.filterProducts) {
            window.SalesFilter.filterProducts(state);
        }
        this.renderProducts(state);
    },

    sortProducts(items) {
        if (window.SalesFilter?.sortProducts) {
            return window.SalesFilter.sortProducts(items);
        }
        return items;
    },

    renderProducts(state) {
        if (!state) return;
        const listEl = document.getElementById('productList');
        if (!listEl) return;

        listEl.innerHTML = '';
        
        // Get references to state elements
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');

        // Hide loading state
        if (loadingState) {
            loadingState.style.display = 'none';
        }

        if (!state.filtered || !state.filtered.length) {
            // Show empty state instead of inline message
            if (emptyState) {
                emptyState.style.display = 'block';
            }
            return;
        }

        // Hide empty state if products found
        if (emptyState) {
            emptyState.style.display = 'none';
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
        const unitPrice = item.sale_price || 0;

        priceValue.textContent = typeof InventoryUtils !== 'undefined'
            ? InventoryUtils.formatCurrency(unitPrice)
            : `₱${Number(unitPrice).toFixed(2)}`;

        priceRow.appendChild(priceLabel);
        priceRow.appendChild(priceValue);

        const actions = document.createElement('div');
        actions.className = 'pos-card-actions';

        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.step = '1';
        qtyInput.className = 'product-qty-input';
        qtyInput.setAttribute('aria-label', `Quantity for ${item.name || 'product'}`);

        if (availableQty <= 0) {
            qtyInput.min = '0';
            qtyInput.max = '0';
            qtyInput.value = '0';
            qtyInput.disabled = true;
        } else {
            qtyInput.min = '1';
            qtyInput.max = String(availableQty);
            qtyInput.value = '1';
            qtyInput.disabled = false;
        }

        qtyInput.addEventListener('input', () => {
            if (availableQty <= 0) {
                qtyInput.value = '0';
                return;
            }
            const val = parseInt(qtyInput.value, 10);
            if (!isNaN(val) && val > availableQty) {
                qtyInput.value = String(availableQty);
            }
        });

        qtyInput.addEventListener('change', () => {
            if (availableQty <= 0) {
                qtyInput.value = '0';
                return;
            }
            const val = parseInt(qtyInput.value, 10);
            if (isNaN(val) || val < 1) {
                qtyInput.value = '1';
            } else if (val > availableQty) {
                qtyInput.value = String(availableQty);
            }
        });

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

        card.setAttribute('data-product-id', item.id);
        const cardAddBtn = addBtn;

        addBtn.addEventListener('click', () => {
            if (cardAddBtn.disabled) return;
            const currentCartItem = state.cart.find(c => c.id === item.id);
            const currentCartQty = currentCartItem ? currentCartItem.qty : 0;
            const currentAvail = Math.max(0, (item.quantity || 0) - currentCartQty);
            if (currentAvail <= 0) return;

            const parsed = parseInt(qtyInput.value, 10);
            const qtyToAdd = Math.min(currentAvail, Math.max(1, isNaN(parsed) ? 1 : parsed));

            // Visual feedback on button (matches catalog animation)
            cardAddBtn.classList.add('btn-added');
            cardAddBtn.disabled = true;
            cardAddBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <span>Added!</span>
            `;

            // Floating +qty badge
            if (SalesCart && SalesCart.showFloatingBadge) {
                SalesCart.showFloatingBadge(cardAddBtn, `+${qtyToAdd}`);
            }

            // Perform cart addition & state update
            SalesCart.addToCart(state, item, qtyToAdd);

            // Revert button after 1000ms, identical to catalog.js
            setTimeout(() => {
                cardAddBtn.classList.remove('btn-added');
                const postCartItem = state.cart.find(c => c.id === item.id);
                const postCartQty = postCartItem ? postCartItem.qty : 0;
                const postAvail = Math.max(0, (item.quantity || 0) - postCartQty);

                if (postAvail > 0) {
                    cardAddBtn.disabled = false;
                    cardAddBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
                        </svg>
                        <span>Add</span>
                    `;
                } else {
                    cardAddBtn.disabled = true;
                    cardAddBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
                        </svg>
                        <span>Add</span>
                    `;
                }
            }, 1000);
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
    },

    updateProductCardStock(state, productId) {
        const card = document.querySelector(`.pos-card[data-product-id="${productId}"]`);
        if (!card) return;

        const product = state.products.find(p => p.id === productId);
        if (!product) return;

        const totalQty = product.quantity || 0;
        const cartItem = state.cart.find(c => c.id === productId);
        const cartQty = cartItem ? cartItem.qty : 0;
        const availableQty = Math.max(0, totalQty - cartQty);

        // Update stock pill text and classes
        const stockEl = card.querySelector('.pos-card-stock');
        if (stockEl) {
            stockEl.textContent = `Stock: ${availableQty}`;
            stockEl.classList.remove('out', 'low');
            if (availableQty <= 0) stockEl.classList.add('out');
            else if (availableQty <= 3) stockEl.classList.add('low');
        }

        // Update quantity input
        const qtyInput = card.querySelector('.product-qty-input');
        if (qtyInput) {
            if (availableQty <= 0) {
                qtyInput.min = '0';
                qtyInput.max = '0';
                qtyInput.value = '0';
                qtyInput.disabled = true;
            } else {
                qtyInput.min = '1';
                qtyInput.max = String(availableQty);
                qtyInput.value = '1';
                qtyInput.disabled = false;
            }
        }

        // Update button disabled state if not in middle of .btn-added animation
        const addBtn = card.querySelector('.product-add-btn');
        if (addBtn && !addBtn.classList.contains('btn-added')) {
            addBtn.disabled = availableQty <= 0;
        }
    },

    renderSkeletons() {
        const listEl = document.getElementById('productList');
        if (!listEl) return;

        listEl.innerHTML = '';
        
        // Show loading state
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.style.display = 'block';
        }
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        // Render 8 skeletons
        for (let i = 0; i < 8; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-card';
            skeleton.innerHTML = `
                <div class="skeleton skeleton-image"></div>
                <div class="skeleton-text skeleton"></div>
                <div class="skeleton-text-sm skeleton"></div>
                <div class="skeleton-button skeleton"></div>
            `;
            listEl.appendChild(skeleton);
        }
    }
};
