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

        document.addEventListener('cartUpdated', (e) => {
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
                stockBadge.className = 'status-badge connected';
                stockBadge.textContent = `In Stock (${availableStock})`;
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
     * Handle modal image error
     */
    handleModalImageError(imgElement) {
        const fallbacksJson = imgElement.getAttribute('data-fallbacks');
        let fallbacks;
        
        if (fallbacksJson) {
            try {
                fallbacks = JSON.parse(fallbacksJson);
            } catch (e) {
                const originalUrl = imgElement.getAttribute('data-original-url');
                if (originalUrl) {
                    fallbacks = window.CatalogImages.getFallbackUrls(originalUrl, 800);
                }
            }
        } else {
            const originalUrl = imgElement.getAttribute('data-original-url');
            if (originalUrl) {
                fallbacks = window.CatalogImages.getFallbackUrls(originalUrl, 800);
            } else {
                imgElement.src = '/img/placeholder-product.png';
                return;
            }
        }
        
        const currentSrc = imgElement.src;
        const currentIndex = fallbacks.indexOf(currentSrc);
        
        if (currentIndex >= 0 && currentIndex < fallbacks.length - 1) {
            imgElement.src = fallbacks[currentIndex + 1];
            imgElement.setAttribute('data-fallbacks', JSON.stringify(fallbacks));
        } else {
            imgElement.src = '/img/placeholder-product.png';
        }
    },

    /**
     * Handle thumbnail image error
     */
    handleThumbnailError(imgElement) {
        const fallbacksJson = imgElement.getAttribute('data-fallbacks');
        let fallbacks;
        
        if (fallbacksJson) {
            try {
                const unescaped = fallbacksJson.replace(/&quot;/g, '"');
                fallbacks = JSON.parse(unescaped);
            } catch (e) {
                const originalUrl = imgElement.getAttribute('data-original-url');
                if (originalUrl) {
                    const unescapedUrl = originalUrl.replace(/&quot;/g, '"').replace(/\\'/g, "'");
                    fallbacks = window.CatalogImages.getFallbackUrls(unescapedUrl, 200);
                }
            }
        } else {
            const originalUrl = imgElement.getAttribute('data-original-url');
            if (originalUrl) {
                const unescapedUrl = originalUrl.replace(/&quot;/g, '"').replace(/\\'/g, "'");
                fallbacks = window.CatalogImages.getFallbackUrls(unescapedUrl, 200);
            } else {
                imgElement.src = '/img/placeholder-product.png';
                return;
            }
        }
        
        if (!fallbacks || fallbacks.length === 0) {
            imgElement.src = '/img/placeholder-product.png';
            return;
        }
        
        const triedIndex = parseInt(imgElement.getAttribute('data-tried-index') || '0');
        
        if (triedIndex < fallbacks.length - 1) {
            const nextIndex = triedIndex + 1;
            imgElement.src = fallbacks[nextIndex];
            imgElement.setAttribute('data-tried-index', nextIndex.toString());
        } else {
            imgElement.src = '/img/placeholder-product.png';
        }
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

        const fallbacks = window.CatalogImages.getFallbackUrls(url, 800);
        
        mainImageEl.setAttribute('data-original-url', url);
        mainImageEl.setAttribute('data-fallbacks', JSON.stringify(fallbacks));
        mainImageEl.src = fallbacks[0];
        mainImageEl.onerror = () => this.handleModalImageError(mainImageEl);

        // Update active thumbnail
        document.querySelectorAll('.modal-thumbnail').forEach((thumb, index) => {
            thumb.classList.toggle('active', index === activeIndex);
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
        const mainImageFallbacks = mainImageUrl ? window.CatalogImages.getFallbackUrls(mainImageUrl, 800) : ['/img/placeholder-product.png'];
        
        const hasMultipleImages = images.length >= 2;

        // Build thumbnails HTML if there are multiple images
        let thumbnailsHTML = '';
        if (hasMultipleImages) {
            thumbnailsHTML = `
                <div class="modal-thumbnails">
                    ${images.map((img, index) => {
                        const thumbFallbacks = window.CatalogImages.getFallbackUrls(img, 200);
                        const escapedUrl = img.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        const fallbacksJson = JSON.stringify(thumbFallbacks);
                        return `
                            <div class="modal-thumbnail ${index === 0 ? 'active' : ''}" 
                                 onclick="CatalogProductModal.setModalMainImage('${escapedUrl}', ${index})">
                                <img src="${thumbFallbacks[0]}" alt="Thumbnail ${index + 1}" 
                                     onerror="CatalogProductModal.handleThumbnailError(this)"
                                     data-original-url="${escapedUrl}"
                                     data-fallbacks="${fallbacksJson.replace(/"/g, '&quot;')}"
                                     data-thumb-index="${index}"
                                     loading="lazy">
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        const availableStock = window.CatalogProducts?.getAvailableStock(product) ?? product.quantity;
        const isOutOfStock = availableStock <= 0;
        const variations = Array.isArray(product.variations) ? product.variations.filter(v => v && v.name) : [];
        const hasVariations = variations.length > 0;
        const escapeHtml = (value) => String(value).replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);

        this.modalContent.innerHTML = `
            <div class="modal-product-view">
                <div class="modal-image-container ${hasMultipleImages ? 'with-thumbnails' : ''}">
                    <img id="modalMainImage" src="${mainImageFallbacks[0]}" alt="${product.name}" 
                         onerror="CatalogProductModal.handleModalImageError(this)"
                         data-original-url="${mainImageUrl || ''}"
                         data-fallbacks='${JSON.stringify(mainImageFallbacks)}'
                         loading="lazy">
                    ${thumbnailsHTML}
                </div>
                <div class="modal-details">
                    <span class="product-category">${product.category}</span>
                    <h2>${product.name}</h2>
                    ${hasVariations ? `
                        <div class="modal-variation-selector">
                            <label for="modalVariationSelect">Choose an option <span aria-hidden="true">*</span></label>
                            <select id="modalVariationSelect" required>
                                <option value="">Select a variation</option>
                                ${variations.map((v, index) => `<option value="${index}" ${Number(v.quantity) <= 0 ? 'disabled' : ''}>${escapeHtml(v.name)}${Number(v.quantity) > 0 ? ` (${v.quantity} available)` : ' (Out of stock)'}</option>`).join('')}
                            </select>
                            <p id="modalVariationHint" class="modal-variation-hint">Select a variation before adding this item to your cart.</p>
                        </div>
                    ` : ''}
                    <span class="product-price">₱${product.sale_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    
                    <p class="description">${product.description || 'No description available for this product.'}</p>
                    
                    <div class="stock-info">
                        <strong>Availability:</strong>
                        <span id="modalStockBadge" class="status-badge ${availableStock > 0 ? 'connected' : 'disconnected'}">
                            ${availableStock > 0 ? `In Stock (${availableStock})` : 'Out of Stock'}
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
                                <span>Add to Cart</span>
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

        // Wire up quantity controls and Add to Cart inside modal
        if (!isOutOfStock) {
            const qtyInput = document.getElementById('modalQtyInput');
            const qtyMinus = document.getElementById('modalQtyMinus');
            const qtyPlus = document.getElementById('modalQtyPlus');
            const addBtn = document.getElementById('modalAddToCartBtn');
            const variationSelect = document.getElementById('modalVariationSelect');
            const variationHint = document.getElementById('modalVariationHint');
            const getSelectedVariation = () => !hasVariations || !variationSelect || variationSelect.value === '' ? null : variations[Number(variationSelect.value)] || null;
            const getCurrentStock = () => { const selected = getSelectedVariation(); return selected ? Math.max(0, Number(selected.quantity) || 0) : availableStock; };
            const refreshVariationState = () => { const selected = getSelectedVariation(); const stock = getCurrentStock(); if (hasVariations && addBtn) { addBtn.disabled = !selected || stock <= 0; addBtn.setAttribute('aria-disabled', String(addBtn.disabled)); } if (qtyInput) { qtyInput.max = String(stock); qtyInput.value = String(Math.min(Math.max(1, Number(qtyInput.value) || 1), Math.max(1, stock))); } const maxText = document.getElementById('modalMaxQtyText'); if (maxText) maxText.textContent = `(Max ${stock})`; if (variationHint && selected) variationHint.textContent = stock > 0 ? `${selected.name} selected.` : `${selected.name} is out of stock.`; };
            variationSelect?.addEventListener('change', refreshVariationState);

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
                    variationHint.textContent = 'Please select a variation before adding this item to your cart.';
                    variationSelect?.focus();
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
                    const newAvailableStock = window.CatalogProducts?.getAvailableStock(product) ?? Math.max(0, availableStock - qtyToAdd);
                    const stockBadge = document.getElementById('modalStockBadge');
                    const maxQtyText = document.getElementById('modalMaxQtyText');

                    if (stockBadge) {
                        if (newAvailableStock > 0) {
                            stockBadge.className = 'status-badge connected';
                            stockBadge.textContent = `In Stock (${newAvailableStock})`;
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
                        if (newAvailableStock > 0) {
                            addBtn.disabled = false;
                            addBtn.innerHTML = `
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                    <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
                                </svg>
                                <span>Add to Cart</span>
                            `;
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
