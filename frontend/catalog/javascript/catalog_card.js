// Logic for Catalog Product Card Rendering, Stock Updates, and Cart Interactions
const CatalogCard = {
    productGrid: null,
    emptyState: null,

    getAvailableStock(product) {
        const cart = window.CatalogCart?.cart || [];
        const cartQuantity = cart
            .filter(item => item.id === product.id)
            .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        return Math.max(0, product.quantity - cartQuantity);
    },

    getCategoryBadge(category) {
        const label = String(category || 'General').trim() || 'General';
        const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general';

        if (key === 'hardware' || key === 'juices') {
            return { className: key, style: '' };
        }

        let hash = 0;
        for (let index = 0; index < label.length; index += 1) {
            hash = ((hash << 5) - hash) + label.charCodeAt(index);
            hash |= 0;
        }

        return {
            className: 'category-generated',
            style: ` style="--category-hue: ${Math.abs(hash) % 360}"`
        };
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
                const category = String(product.category || 'General').trim() || 'General';
                const categoryBadge = this.getCategoryBadge(category);
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
                            <span class="card-category ${categoryBadge.className}"${categoryBadge.style}>${category}</span>
                        </div>
                        <h3 class="card-name">${product.name || 'Product'}</h3>
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
                                <span>Details</span>
                            </button>
                            ${availableStock > 0 
                                    ? `<button class="btn-card add-cart-btn" data-product-id="${product.id}">
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
            <span>Added!</span>
        `;
        btn.disabled = true;

        setTimeout(() => {
            btn.classList.remove('btn-added');
            btn.disabled = false;
            const remaining = this.getAvailableStock(product);
            if (remaining > 0) {
                btn.innerHTML = `
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
