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
            `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`,
            `/api/catalog/image/${fileId}`,
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
                    <span class="product-price" style="font-size: 28px;">₱${product.sale_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    
                    <p class="description">${product.description || 'No description available for this product.'}</p>
                    
                    <div class="stock-info">
                        <strong>Availability:</strong>
                        <span class="status-badge ${product.quantity > 0 ? 'connected' : 'disconnected'}">
                            ${product.quantity > 0 ? `In Stock (${product.quantity})` : 'Out of Stock'}
                        </span>
                    </div>
                </div>
            </div>
        `;

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
