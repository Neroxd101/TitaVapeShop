// Logic for Catalog Product Card Rendering, Stock Updates, and Cart Interactions
const CatalogCard = {
    productGrid: null,
    emptyState: null,

    getAvailableStock(product) {
        const cart = window.CatalogCart?.cart || [];
        const cartItem = cart.find(item => item.id === product.id);
        const cartQuantity = cartItem ? cartItem.quantity : 0;
        return Math.max(0, product.quantity - cartQuantity);
    },

    formatVariations(product) {
        if (Array.isArray(product?.variations) && product.variations.length) {
            return product.variations.map(v => `${v.name} (${v.quantity})`).join(' • ');
        }
        return product?.variation || '';
    },

    renderProducts(products = []) {
        if (!this.productGrid || !this.emptyState) {
            this.productGrid = document.getElementById('productGrid');
            this.emptyState = document.getElementById('emptyState');
        }

        if (products.length === 0) {
            if (this.productGrid) this.productGrid.style.display = 'none';
            if (this.emptyState) this.emptyState.style.display = 'block';
            return;
        }

        if (this.emptyState) this.emptyState.style.display = 'none';
        if (this.productGrid) {
            this.productGrid.style.display = 'grid';
            this.productGrid.innerHTML = products.map(product => {
                const availableStock = this.getAvailableStock(product);
                return `
                <div class="product-card" data-id="${product.id}">
                    <div class="product-image-container">
                        <img src="${this.getImageUrl(product)}" alt="${product.name}" class="product-image" 
                             onerror="CatalogCard.handleImageError(this, '${product.id}')"
                             loading="lazy">
                        ${availableStock > 0
                    ? `<span class="product-badge badge-stock">In Stock</span>`
                    : `<span class="product-badge badge-out">Out of Stock</span>`}
                    </div>
                    <div class="product-info">
                        <div class="card-header">
                            <span class="card-category ${(product.category || '').toLowerCase()}">${product.category || 'General'}</span>
                        </div>
                        <h3 class="card-name">${product.name || 'Product'}</h3>
                        ${this.formatVariations(product) ? `<p class="card-variation">${this.formatVariations(product)}</p>` : ''}
                        <div class="card-details">
                            <div class="detail-item">
                                <span class="detail-label">Price</span>
                                <span class="detail-value price">₱${(Number(product.sale_price) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Stock</span>
                                <span class="detail-value ${availableStock <= 10 ? 'low-stock' : ''}">${availableStock}</span>
                            </div>
                        </div>
                        <div class="card-actions">
                            <button class="btn-card btn-edit view-btn" data-product-id="${product.id}">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                                </svg>
                                <span>Details</span>
                            </button>
                            ${availableStock > 0 
                                    ? `<button class="btn-card add-cart-btn" data-product-id="${product.id}">
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                            <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
                                        </svg>
                                        <span>Add to Cart</span>
                                    </button>`
                                    : `<button class="btn-card" disabled>Out of Stock</button>`}
                        </div>
                    </div>
                </div>
            `;
            }).join('');

            // Attach event listeners
            this.productGrid.querySelectorAll('.view-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const productId = btn.getAttribute('data-product-id');
                    document.dispatchEvent(new CustomEvent('viewProduct', { detail: productId }));
                });
            });

            this.productGrid.querySelectorAll('.add-cart-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const productId = btn.getAttribute('data-product-id');
                    this.handleAddToCart(btn, productId);
                });
            });
        }
    },

    updateProductStock(productId) {
        const product = window.CatalogGetProducts?.getProductById?.(productId);
        if (!product) return;

        const availableStock = this.getAvailableStock(product);
        const productCard = document.querySelector(`[data-id="${productId}"]`);
        if (!productCard) return;

        // Update stock value label
        const detailItems = productCard.querySelectorAll('.detail-item');
        detailItems.forEach(item => {
            const label = item.querySelector('.detail-label');
            if (label && label.textContent.trim().toLowerCase() === 'stock') {
                const stockValue = item.querySelector('.detail-value');
                if (stockValue) {
                    stockValue.textContent = availableStock;
                    stockValue.classList.toggle('low-stock', availableStock <= 10);
                }
            }
        });

        // Update badge
        const badge = productCard.querySelector('.product-badge');
        if (badge) {
            if (availableStock > 0) {
                badge.className = 'product-badge badge-stock';
                badge.textContent = 'In Stock';
            } else {
                badge.className = 'product-badge badge-out';
                badge.textContent = 'Out of Stock';
            }
        }

        // Update add to cart button
        const cardActions = productCard.querySelector('.card-actions');
        if (!cardActions) return;

        const addCartBtn = cardActions.querySelector('.add-cart-btn');
        const disabledBtn = cardActions.querySelector('.btn-card[disabled]');
        
        if (availableStock > 0) {
            if (disabledBtn) {
                disabledBtn.replaceWith(this.createAddToCartButton(productId));
            } else if (addCartBtn) {
                addCartBtn.disabled = false;
            }
        } else {
            if (addCartBtn) {
                addCartBtn.replaceWith(this.createDisabledButton());
            }
        }
    },

    handleAddToCart(btn, productId) {
        const product = window.CatalogGetProducts?.getProductById?.(productId);
        if (!product) return;
        if (Array.isArray(product.variations) && product.variations.length) { document.dispatchEvent(new CustomEvent('viewProduct', { detail: productId })); return; }

        const available = this.getAvailableStock(product);
        if (available <= 0) return;

        if (window.CatalogCart) {
            CatalogCart.addToCart(product, 1);
            CatalogCart.updateCartBadge(true);
            if (CatalogCart.showFloatingBadge) {
                CatalogCart.showFloatingBadge(btn, '+1');
            }
        }
        this.updateProductStock(productId);

        // Visual feedback on button
        btn.classList.add('btn-added');
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <span>Added!</span>
        `;
        btn.disabled = true;

        setTimeout(() => {
            btn.classList.remove('btn-added');
            btn.disabled = false;
            const remaining = this.getAvailableStock(product);
            if (remaining > 0) {
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
                    </svg>
                    <span>Add to Cart</span>
                `;
            } else {
                this.updateProductStock(productId);
            }
        }, 1000);
    },

    createAddToCartButton(productId) {
        const btn = document.createElement('button');
        btn.className = 'btn-card add-cart-btn';
        btn.setAttribute('data-product-id', productId);
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
            <span>Add to Cart</span>
        `;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleAddToCart(btn, productId);
        });
        return btn;
    },

    createDisabledButton() {
        const btn = document.createElement('button');
        btn.className = 'btn-card';
        btn.disabled = true;
        btn.textContent = 'Out of Stock';
        return btn;
    },

    getImageUrl(product) {
        const images = window.CatalogImages ? window.CatalogImages.parseImages(product) : (product.images || []);
        
        if (images && images.length > 0) {
            const img = images[0];
            if (img && typeof img === 'string' && img.trim() !== '') {
                const fallbacks = window.CatalogImages ? window.CatalogImages.getFallbackUrls(img, 800) : [img];
                return fallbacks[0];
            }
        }
        
        return '/img/placeholder-product.png';
    },

    handleImageError(imgElement, productId) {
        const currentSrc = imgElement.src;
        const product = window.CatalogGetProducts?.getProductById?.(productId);
        
        if (!product) {
            imgElement.src = '/img/placeholder-product.png';
            return;
        }

        const images = window.CatalogImages ? window.CatalogImages.parseImages(product) : [];
        if (images.length === 0) {
            imgElement.src = '/img/placeholder-product.png';
            return;
        }

        const img = images[0];
        const fallbacks = window.CatalogImages ? window.CatalogImages.getFallbackUrls(img, 800) : [img];
        const currentIndex = fallbacks.indexOf(currentSrc);
        
        if (currentIndex >= 0 && currentIndex < fallbacks.length - 1) {
            imgElement.src = fallbacks[currentIndex + 1];
        } else {
            imgElement.src = '/img/placeholder-product.png';
        }
    }
};

window.CatalogCard = CatalogCard;
