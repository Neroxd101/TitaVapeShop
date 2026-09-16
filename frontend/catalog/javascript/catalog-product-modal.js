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
            if (this.modal && this.modal.classList.contains('show') && this.currentProduct) {
                const updatedProduct = this.allProducts.find(p => p.id === this.currentProduct.id) || this.currentProduct;
                this.show(updatedProduct);
            }
        });
    },

    /**
     * Parse images from product (excludes QR code)
     */
    parseImages(product) {
        if (!product.images) {
            return [];
        }

        try {
            let parsed;
            if (typeof product.images === 'string') {
                if (product.images.trim().startsWith('[') || product.images.trim().startsWith('{')) {
                    parsed = JSON.parse(product.images);
                } else {
                    parsed = [product.images];
                }
            } else {
                parsed = product.images;
            }
            
            const imageArray = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
            const validImages = imageArray.filter(img => img && typeof img === 'string' && img.trim() !== '');
            const nonQrImages = validImages.filter(url => url && url !== product.qr_image_url);
            
            return nonQrImages.length > 0 ? nonQrImages : validImages;
        } catch (e) {
            console.error('Error parsing images for product:', product.id, product.name);
            return [];
        }
    },

    /**
     * Extract Google Drive file ID from URL
     */
    getGoogleDriveFileId(url) {
        if (!url) return null;

        const patterns = [
            /[?&]id=([a-zA-Z0-9_-]+)/,
            /\/d\/([a-zA-Z0-9_-]+)/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }

        return null;
    },

    /**
     * Get fallback URLs for Google Drive images
     */
    getFallbackUrls(url, size = 800) {
        if (!url || typeof url !== 'string') return ['/img/placeholder-product.png'];
        
        const fileId = this.getGoogleDriveFileId(url);
        if (!fileId) {
            return [url];
        }

        return [
            `/api/catalog/image/${fileId}`,
            `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`,
            url
        ];
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
                    fallbacks = this.getFallbackUrls(originalUrl, 800);
                }
            }
        } else {
            const originalUrl = imgElement.getAttribute('data-original-url');
            if (originalUrl) {
                fallbacks = this.getFallbackUrls(originalUrl, 800);
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
                    fallbacks = this.getFallbackUrls(unescapedUrl, 200);
                }
            }
        } else {
            const originalUrl = imgElement.getAttribute('data-original-url');
            if (originalUrl) {
                const unescapedUrl = originalUrl.replace(/&quot;/g, '"').replace(/\\'/g, "'");
                fallbacks = this.getFallbackUrls(unescapedUrl, 200);
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

        const fallbacks = this.getFallbackUrls(url, 800);
        
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

        const images = this.parseImages(product);
        const mainImageUrl = images.length > 0 ? images[0] : null;
        const mainImageFallbacks = mainImageUrl ? this.getFallbackUrls(mainImageUrl, 800) : ['/img/placeholder-product.png'];
        
        const hasMultipleImages = images.length >= 2;

        // Build thumbnails HTML if there are multiple images
        let thumbnailsHTML = '';
        if (hasMultipleImages) {
            thumbnailsHTML = `
                <div class="modal-thumbnails">
                    ${images.map((img, index) => {
                        const thumbFallbacks = this.getFallbackUrls(img, 200);
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
                                <span style="font-size: 12px; color: var(--text-muted);">(Max ${availableStock})</span>
                            </div>
                            <button type="button" id="modalAddToCartBtn" class="modal-add-cart-btn">
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

            const parseQty = () => {
                let val = parseInt(qtyInput.value, 10);
                if (isNaN(val) || val < 1) val = 1;
                if (val > availableStock) val = availableStock;
                return val;
            };

            qtyMinus?.addEventListener('click', () => {
                let val = parseQty();
                if (val > 1) {
                    qtyInput.value = val - 1;
                }
            });

            qtyPlus?.addEventListener('click', () => {
                let val = parseQty();
                if (val < availableStock) {
                    qtyInput.value = val + 1;
                }
            });

            qtyInput?.addEventListener('change', () => {
                qtyInput.value = parseQty();
            });

            addBtn?.addEventListener('click', () => {
                const qtyToAdd = parseQty();
                if (window.CatalogCart) {
                    window.CatalogCart.addToCart(product, qtyToAdd);
                    window.CatalogCart.updateCartBadge();
                    // Provide feedback button animation / text change
                    addBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                        <span>Added to Cart!</span>
                    `;
                    addBtn.style.background = '#22c55e';
                    addBtn.style.color = '#fff';
                    setTimeout(() => {
                        this.show(product);
                    }, 800);
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
