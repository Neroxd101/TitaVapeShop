/**
 * Catalog Product Details Modal
 * Handles product details modal display and image management
 */

const CatalogProductModal = {
    modal: null,
    modalContent: null,
    closeButton: null,
    allProducts: [],

    /**
     * Initialize the modal
     */
    async init(products = []) {
        this.allProducts = products;
        
        // Load modal HTML
        const container = document.getElementById('product-modal-container');
        if (!container) {
            console.error('[Catalog Modal] Container not found');
            return false;
        }

        try {
            const response = await fetch('/catalog/catalog-product-modal.html');
            if (!response.ok) {
                console.error('[Catalog Modal] Failed to load modal HTML:', response.status);
                return false;
            }
            
            container.innerHTML = await response.text();
            
            // Get modal references
            this.modal = document.getElementById('productModal');
            this.modalContent = document.getElementById('productModalContent');
            this.closeButton = document.getElementById('closeProductModal');

            if (!this.modal || !this.modalContent) {
                console.error('[Catalog Modal] Modal elements not found after loading HTML');
                return false;
            }

            // Setup event listeners
            this.setupEventListeners();
            return true;
        } catch (error) {
            console.error('[Catalog Modal] Error loading modal:', error);
            return false;
        }
    },

    currentProduct: null,
    isAddingToCart: false,

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.close());
        }

        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.close();
                }
            });
        }

        document.addEventListener('cartUpdated', () => {
            // Do not destroy/reset modal while an addition is in progress
            if (this.isAddingToCart) return;
            if (this.modal && this.modal.classList.contains('show') && this.currentProduct) {
                this.updateModalStock();
            }
        });
    },

    /**
     * Update stock indicators inside open modal without destroying carousel view
     */
    updateModalStock() {
        if (!this.currentProduct) return;
        const availableStock = window.CatalogProducts?.getAvailableStock(this.currentProduct) ?? this.currentProduct.quantity;
        const stockBadge = document.getElementById('modalStockBadge');
        const maxQtyText = document.getElementById('modalMaxQtyText');
        const qtyInput = document.getElementById('modalQtyInput');
        const addBtn = document.getElementById('modalAddToCartBtn');

        if (stockBadge) {
            if (availableStock > 0) {
                stockBadge.className = 'status-badge ' + (availableStock <= 10 ? 'stock-low' : 'connected');
                stockBadge.textContent = `${availableStock <= 10 ? 'Low Stock' : 'In Stock'} (${availableStock})`;
            } else {
                stockBadge.className = 'status-badge disconnected';
                stockBadge.textContent = 'Out of Stock';
            }
        }

        if (maxQtyText) {
            maxQtyText.textContent = `(Max ${availableStock})`;
        }

        if (qtyInput) {
            qtyInput.max = String(availableStock);
            const currentVal = parseInt(qtyInput.value, 10) || 1;
            if (currentVal > availableStock) {
                qtyInput.value = String(Math.max(1, availableStock));
            }
        }

        if (availableStock <= 0 && addBtn) {
            const actionsContainer = addBtn.closest('.modal-product-actions');
            if (actionsContainer) {
                actionsContainer.innerHTML = `
                    <button type="button" class="btn-card" disabled style="width: 100%; padding: 12px 20px; font-size: 15px; opacity: 0.6; cursor: not-allowed; text-align: center;">
                        Out of Stock
                    </button>
                `;
            }
        }
    },

    /**
     * Advance through image fallbacks, stopping after the placeholder.
     */
    handleModalImageError(imgElement) {
        const fallbacks = JSON.parse(imgElement.getAttribute('data-fallbacks') || '[]');
        const nextIndex = Number(imgElement.getAttribute('data-tried-index') || '0') + 1;
        imgElement.setAttribute('data-tried-index', String(nextIndex));
        if (nextIndex < fallbacks.length) {
            imgElement.src = fallbacks[nextIndex];
        } else {
            imgElement.onerror = null;
            imgElement.src = '/img/placeholder-product.png';
        }
    },

    /**
     * Set image listeners and fallback state before starting the request.
     */
    loadImage(imgElement, url, size) {
        const fallbacks = window.CatalogImages.getFallbackUrls(url, size);
        imgElement.setAttribute('data-original-url', url || '');
        imgElement.setAttribute('data-fallbacks', JSON.stringify(fallbacks));
        imgElement.setAttribute('data-tried-index', '0');
        imgElement.onerror = () => this.handleModalImageError(imgElement);
        imgElement.src = fallbacks[0];
    },

    /**
     * Set main image in modal
     */
    setModalMainImage(url, activeIndex) {
        const mainImageEl = document.getElementById('modalMainImage');
        if (!mainImageEl) {
            console.error('[Catalog Modal] Main image element not found');
            return;
        }

        this.loadImage(mainImageEl, url, 800);

        // Update active thumbnail
        this.modalContent.querySelectorAll('.modal-thumbnail').forEach((thumb, index) => {
            thumb.classList.toggle('active', index === activeIndex);
            thumb.setAttribute('aria-pressed', String(index === activeIndex));
        });
    },

    /**
     * Show product details modal
     */
    show(product) {
        if (!this.modal || !this.modalContent) {
            console.error('[Catalog Modal] Modal not initialized');
            return;
        }

        this.currentProduct = product;

        const images = window.CatalogImages.parseImages(product);
        const mainImageUrl = images.length > 0 ? images[0] : null;
        
        const hasMultipleImages = images.length >= 2;

        // Build thumbnails HTML if there are multiple images
        let thumbnailsHTML = '';
        if (hasMultipleImages) {
            thumbnailsHTML = `
                <div class="modal-thumbnails">
                    ${images.map((img, index) => `
                        <button type="button" class="modal-thumbnail ${index === 0 ? 'active' : ''}"
                                aria-label="View image ${index + 1}" aria-pressed="${index === 0}">
                            <img alt="Thumbnail ${index + 1}" loading="lazy">
                        </button>
                    `).join('')}
                </div>
            `;
        }

        const variations = Array.isArray(product.variations) ? product.variations.filter(v => v && v.name) : [];
        const hasVariations = variations.length > 0;
        this.modal.classList.toggle('has-variations', hasVariations);
        const cart = window.CatalogCart?.cart || [];
        const getVariationStock = (variation) => Math.max(0, (Number(variation.quantity) || 0) - cart
            .filter(item => item.id === product.id && item.selected_variation === variation.name)
            .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0));
        const availableStock = hasVariations
            ? variations.reduce((sum, variation) => sum + getVariationStock(variation), 0)
            : (window.CatalogProducts?.getAvailableStock(product) ?? product.quantity);
        const isOutOfStock = availableStock <= 0;
        const escapeHtml = (value) => String(value).replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);

        this.modalContent.innerHTML = `
            <div class="modal-product-view">
                <div class="modal-image-container ${hasMultipleImages ? 'with-thumbnails' : ''}">
                    <img id="modalMainImage" alt="Product image">
                    ${thumbnailsHTML}
                </div>
                <div class="modal-details">
                    <span class="product-category">${product.category}</span>
                    <h2>${product.name}</h2>
                    ${hasVariations ? `
                        <div class="modal-variation-selector">
                            <strong id="modalVariationLabel">Variation</strong>
                            <div class="modal-variation-options" role="group" aria-labelledby="modalVariationLabel">
                                ${variations.map((v, index) => `<button type="button" class="modal-variation-option" data-variation-index="${index}" aria-pressed="false" ${getVariationStock(v) <= 0 ? 'disabled' : ''}><span>${escapeHtml(v.name)}</span><small>${getVariationStock(v) > 0 ? `Qty: ${getVariationStock(v)}` : 'Out of stock'}</small></button>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    <span class="product-price">₱${product.sale_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    
                    <p class="description">${product.description || 'No description available for this product.'}</p>
                    
                    <div class="stock-info">
                        <strong>Availability:</strong>
                        <span id="modalStockBadge" class="status-badge ${availableStock <= 0 ? 'disconnected' : availableStock <= 10 ? 'stock-low' : 'connected'}">
                            ${availableStock > 0 ? `${availableStock <= 10 ? 'Low Stock' : 'In Stock'} (${availableStock})` : 'Out of Stock'}
                        </span>
                    </div>

                    <div class="modal-product-actions">
                        ${!isOutOfStock ? `
                            <div class="modal-qty-selector">
                                <span style="font-weight: 500; font-size: 14px; color: var(--text-secondary);">Quantity:</span>
                                <div class="modal-qty-controls">
                                    <button type="button" id="modalQtyMinus" class="modal-qty-btn" title="Decrease quantity">-</button>
                                    <input type="number" id="modalQtyInput" class="modal-qty-input" value="1" min="1" max="${availableStock}">
                                    <button type="button" id="modalQtyPlus" class="modal-qty-btn" title="Increase quantity">+</button>
                                </div>
                                <span id="modalMaxQtyText" style="font-size: 12px; color: var(--text-muted);">(Max ${availableStock})</span>
                            </div>
                            <button type="button" id="modalAddToCartBtn" class="modal-add-cart-btn" ${hasVariations ? 'disabled aria-disabled="true"' : ''}>
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                    <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
                                </svg>
                                <span>${hasVariations ? 'Choose a variation' : 'Add to Cart'}</span>
                            </button>
                        ` : `
                            <button type="button" class="btn-card" disabled style="width: 100%; padding: 12px 20px; font-size: 15px; opacity: 0.6; cursor: not-allowed; text-align: center;">
                                Out of Stock
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;

        const mainImageEl = document.getElementById('modalMainImage');
        mainImageEl.alt = product.name;
        this.setModalMainImage(mainImageUrl, 0);
        this.modalContent.querySelectorAll('.modal-thumbnail').forEach((thumbnail, index) => {
            thumbnail.addEventListener('click', () => this.setModalMainImage(images[index], index));
            this.loadImage(thumbnail.querySelector('img'), images[index], 200);
        });

        // Wire up quantity controls and Add to Cart inside modal
        if (!isOutOfStock) {
            const qtyInput = document.getElementById('modalQtyInput');
            const qtyMinus = document.getElementById('modalQtyMinus');
            const qtyPlus = document.getElementById('modalQtyPlus');
            const addBtn = document.getElementById('modalAddToCartBtn');
            const variationOptions = [...document.querySelectorAll('.modal-variation-option')];
            let selectedVariationIndex = null;
            const getSelectedVariation = () => selectedVariationIndex === null ? null : variations[selectedVariationIndex] || null;
            const getCurrentStock = () => { const selected = getSelectedVariation(); return selected ? getVariationStock(selected) : availableStock; };
            const refreshVariationState = () => {
                const selected = getSelectedVariation();
                const stock = getCurrentStock();
                if (hasVariations && addBtn) {
                    addBtn.disabled = this.isAddingToCart || !selected || stock <= 0;
                    addBtn.setAttribute('aria-disabled', String(addBtn.disabled));
                    if (!this.isAddingToCart) addBtn.querySelector('span').textContent = selected ? (stock > 0 ? 'Add to Cart' : 'Out of Stock') : 'Choose a variation';
                }
                if (qtyInput) { qtyInput.max = String(stock); qtyInput.value = String(Math.min(Math.max(1, Number(qtyInput.value) || 1), Math.max(1, stock))); }
                const maxText = document.getElementById('modalMaxQtyText');
                if (maxText) maxText.textContent = `(Max ${stock})`;
                variationOptions.forEach(option => {
                    const remaining = getVariationStock(variations[Number(option.dataset.variationIndex)]);
                    option.disabled = remaining <= 0;
                    option.querySelector('small').textContent = remaining > 0 ? `Qty: ${remaining}` : 'Out of stock';
                    const isSelected = Number(option.dataset.variationIndex) === selectedVariationIndex;
                    option.classList.toggle('is-selected', isSelected);
                    option.setAttribute('aria-pressed', String(isSelected));
                });
            };
            variationOptions.forEach(option => option.addEventListener('click', () => {
                selectedVariationIndex = Number(option.dataset.variationIndex);
                refreshVariationState();
            }));

            const parseQty = () => {
                let currentStock = hasVariations ? getCurrentStock() : (window.CatalogProducts?.getAvailableStock(product) ?? availableStock);
                let val = parseInt(qtyInput.value, 10);
                if (isNaN(val) || val < 1) val = 1;
                if (val > currentStock) val = currentStock;
                return val;
            };

            qtyMinus?.addEventListener('click', () => {
                let val = parseQty();
                if (val > 1) {
                    qtyInput.value = val - 1;
                }
            });

            qtyPlus?.addEventListener('click', () => {
                let currentStock = hasVariations ? getCurrentStock() : (window.CatalogProducts?.getAvailableStock(product) ?? availableStock);
                let val = parseQty();
                if (val < currentStock) {
                    qtyInput.value = val + 1;
                }
            });

            qtyInput?.addEventListener('change', () => {
                qtyInput.value = parseQty();
            });

            addBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.isAddingToCart) return;

                const selectedVariation = getSelectedVariation();
                if (hasVariations && !selectedVariation) {
                    variationOptions[0]?.focus();
                    return;
                }

                const qtyToAdd = parseQty();
                if (window.CatalogCart && qtyToAdd > 0) {
                    this.isAddingToCart = true;

                    // Trigger button animation
                    addBtn.classList.add('btn-added');
                    addBtn.disabled = true;
                    addBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                        <span>Added to Cart!</span>
                    `;

                    // Add to cart
                    window.CatalogCart.addToCart({ ...product, selected_variation: selectedVariation?.name }, qtyToAdd);
                    window.CatalogCart.updateCartBadge(true);
                    window.CatalogCart.showFloatingBadge(addBtn, `+${qtyToAdd}`);

                    // Calculate remaining stock
                    const newAvailableStock = hasVariations
                        ? getCurrentStock()
                        : (window.CatalogProducts?.getAvailableStock(product) ?? Math.max(0, availableStock - qtyToAdd));
                    const stockBadge = document.getElementById('modalStockBadge');
                    const maxQtyText = document.getElementById('modalMaxQtyText');

                    if (stockBadge) {
                        if (newAvailableStock > 0 && (!hasVariations || getSelectedVariation())) {
                            stockBadge.className = 'status-badge ' + (newAvailableStock <= 10 ? 'stock-low' : 'connected');
                            stockBadge.textContent = `${newAvailableStock <= 10 ? 'Low Stock' : 'In Stock'} (${newAvailableStock})`;
                        } else {
                            stockBadge.className = 'status-badge disconnected';
                            stockBadge.textContent = 'Out of Stock';
                        }
                    }

                    if (maxQtyText) {
                        maxQtyText.textContent = `(Max ${newAvailableStock})`;
                    }

                    if (qtyInput) {
                        qtyInput.value = '1';
                        qtyInput.max = String(newAvailableStock);
                    }

                    // Sync catalog background grid card
                    document.dispatchEvent(new CustomEvent('cartUpdated', { detail: product.id }));

                    setTimeout(() => {
                        this.isAddingToCart = false;
                        addBtn.classList.remove('btn-added');
                        if (newAvailableStock > 0 || hasVariations) {
                            addBtn.disabled = false;
                            addBtn.innerHTML = `
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                    <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
                                </svg>
                                <span>Add to Cart</span>
                            `;
                            if (hasVariations) refreshVariationState();
                        } else {
                            const actionsContainer = addBtn.closest('.modal-product-actions');
                            if (actionsContainer) {
                                actionsContainer.innerHTML = `
                                    <button type="button" class="btn-card" disabled style="width: 100%; padding: 12px 20px; font-size: 15px; opacity: 0.6; cursor: not-allowed; text-align: center;">
                                        Out of Stock
                                    </button>
                                `;
                            }
                        }
                    }, 1000);
                }
            });
        }

        this.modal.classList.add('show');
    },

    /**
     * Close the modal
     */
    close() {
        if (this.modal) {
            this.modal.classList.remove('show');
        }
    }
};

// Expose globally
window.CatalogProductModal = CatalogProductModal;
