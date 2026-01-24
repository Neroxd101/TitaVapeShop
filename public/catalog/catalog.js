/**
 * Product Catalog Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const productGrid = document.getElementById('productGrid');
    const searchInput = document.getElementById('searchInput');
    const categoryFilters = document.getElementById('categoryFilters');
    const emptyState = document.getElementById('emptyState');
    const productModal = document.getElementById('productModal');
    const closeModal = document.getElementById('closeModal');
    const modalContent = document.getElementById('modalContent');

    let allProducts = [];
    let currentCategory = 'all';
    let searchQuery = '';

    // Initialize
    fetchProducts();

    // Listen for cart updates to refresh stock display
    document.addEventListener('cartUpdated', (e) => {
        const productId = e.detail;
        updateProductStock(productId);
    });

    // Event Listeners
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        filterAndRender();
    });

    categoryFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-tab')) {
            // Update active state
            document.querySelectorAll('.filter-tab').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            currentCategory = e.target.getAttribute('data-category');
            filterAndRender();
        }
    });

    closeModal.addEventListener('click', () => {
        productModal.classList.remove('show');
    });

    window.addEventListener('click', (e) => {
        if (e.target === productModal) {
            productModal.classList.remove('show');
        }
    });

    /**
     * Fetch products from the RPC function
     */
    async function fetchProducts() {
        try {
            const response = await fetch('/api/inventory/list');
            const result = await response.json();

            if (result.success) {
                allProducts = result.data;
                filterAndRender();
            } else {
                productGrid.innerHTML = `<p class="error">Failed to load products: ${result.error}</p>`;
            }
        } catch (error) {
            console.error('Fetch error:', error);
            productGrid.innerHTML = `<p class="error">Error connecting to server.</p>`;
        }
    }

    /**
     * Filter and render products
     */
    function filterAndRender() {
        const filtered = allProducts.filter(product => {
            const matchesCategory = currentCategory === 'all' || product.category === currentCategory;
            const matchesSearch = product.name.toLowerCase().includes(searchQuery) ||
                product.description?.toLowerCase().includes(searchQuery);
            return matchesCategory && matchesSearch;
        });

        renderProducts(filtered);
    }

    /**
     * Get available stock for a product (original quantity minus cart quantity)
     */
    function getAvailableStock(product) {
        const cartItem = CatalogCart.cart.find(item => item.id === product.id);
        const cartQuantity = cartItem ? cartItem.quantity : 0;
        return Math.max(0, product.quantity - cartQuantity);
    }

    /**
     * Get product by ID (exposed for cart validation)
     */
    function getProductById(productId) {
        return allProducts.find(p => p.id === productId);
    }

    // Expose functions for cart module
    window.CatalogProducts = {
        getProductById,
        getAvailableStock
    };

    /**
     * Update stock display for a specific product card
     */
    function updateProductStock(productId) {
        const product = allProducts.find(p => p.id === productId);
        if (!product) return;

        const availableStock = getAvailableStock(product);
        const productCard = productGrid.querySelector(`[data-id="${productId}"]`);
        if (!productCard) return;

        // Update stock value - find the detail-item that contains "Stock" label
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
                disabledBtn.replaceWith(createAddToCartButton(productId));
            } else if (addCartBtn) {
                // Button already exists, just enable it
                addCartBtn.disabled = false;
            }
        } else {
            if (addCartBtn) {
                addCartBtn.replaceWith(createDisabledButton());
            }
        }
    }

    /**
     * Create add to cart button element
     */
    function createAddToCartButton(productId) {
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
            const product = allProducts.find(p => p.id === productId);
            if (product) {
                CatalogCart.addToCart(product, 1);
                CatalogCart.updateCartBadge();
                updateProductStock(productId);
            }
        });
        return btn;
    }

    /**
     * Create disabled button element
     */
    function createDisabledButton() {
        const btn = document.createElement('button');
        btn.className = 'btn-card';
        btn.disabled = true;
        btn.textContent = 'Out of Stock';
        return btn;
    }

    /**
     * Render the product grid
     */
    function renderProducts(products) {
        if (products.length === 0) {
            productGrid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        productGrid.style.display = 'grid';

        productGrid.innerHTML = products.map(product => {
            const availableStock = getAvailableStock(product);
            return `
            <div class="product-card" data-id="${product.id}">
                <div class="product-image-container">
                    <img src="${getImageUrl(product)}" alt="${product.name}" class="product-image" 
                         onerror="handleImageError(this, '${product.id}')"
                         loading="lazy"
                         crossorigin="anonymous">
                    ${availableStock > 0
                ? `<span class="product-badge badge-stock">In Stock</span>`
                : `<span class="product-badge badge-out">Out of Stock</span>`}
                </div>
                <div class="product-info">
                    <div class="card-header">
                        <span class="card-category ${product.category.toLowerCase()}">${product.category}</span>
                    </div>
                    <h3 class="card-name">${product.name}</h3>
                    <div class="card-details">
                        <div class="detail-item">
                            <span class="detail-label">Price</span>
                            <span class="detail-value price">₱${product.sale_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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

        // Add event listeners for buttons
        productGrid.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const productId = btn.getAttribute('data-product-id');
                document.dispatchEvent(new CustomEvent('viewProduct', { detail: productId }));
            });
        });

        productGrid.querySelectorAll('.add-cart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const productId = btn.getAttribute('data-product-id');
                const product = allProducts.find(p => p.id === productId);
                if (product) {
                    CatalogCart.addToCart(product, 1);
                    CatalogCart.updateCartBadge();
                    updateProductStock(productId);
                }
            });
        });
    }

    function parseImages(product) {
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
    }

    function getGoogleDriveFileId(url) {
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
    }

    function getFallbackUrls(url, size = 800) {
        if (!url || typeof url !== 'string') return ['/img/placeholder-product.png'];
        
        const fileId = getGoogleDriveFileId(url);
        if (!fileId) {
            // Not a Google Drive URL, return as-is
            return [url];
        }

        const directUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=view`;
        
        // For thumbnails, use smaller size in thumbnail endpoint
        if (size <= 200) {
            return [
                directUrl, // Primary: Direct view URL (works for public files)
                `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`, // Thumbnail endpoint
                `/api/catalog/image/${fileId}`, // Proxy endpoint
                url // Original URL
            ];
        }
        
        // For larger images
        return [
            directUrl,
            `/api/catalog/image/${fileId}`,
            `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`,
            url
        ];
    }

    function getImageUrl(product) {
        const images = parseImages(product);
        
        if (images && images.length > 0) {
            const img = images[0];
            if (img && typeof img === 'string' && img.trim() !== '') {
                const fallbacks = getFallbackUrls(img, 800);
                return fallbacks[0];
            }
        }
        
        return '/img/placeholder-product.png';
    }

    function handleImageError(imgElement, productId) {
        const currentSrc = imgElement.src;
        const product = allProducts.find(p => p.id === productId);
        
        if (!product) {
            imgElement.src = '/img/placeholder-product.png';
            return;
        }

        const images = parseImages(product);
        if (images.length === 0) {
            imgElement.src = '/img/placeholder-product.png';
            return;
        }

        const img = images[0];
        const fallbacks = getFallbackUrls(img, 800);
        const currentIndex = fallbacks.indexOf(currentSrc);
        
        if (currentIndex >= 0 && currentIndex < fallbacks.length - 1) {
            imgElement.src = fallbacks[currentIndex + 1];
        } else {
            imgElement.src = '/img/placeholder-product.png';
        }
    }

    window.handleImageError = handleImageError;

    function handleModalImageError(imgElement) {
        const originalUrl = imgElement.getAttribute('data-original-url');
        if (!originalUrl) {
            imgElement.src = '/img/placeholder-product.png';
            return;
        }

        const fallbacks = getFallbackUrls(originalUrl, 800);
        const currentSrc = imgElement.src;
        const currentIndex = fallbacks.indexOf(currentSrc);
        
        console.log('[Catalog Modal] Image error, trying fallback. Current:', currentSrc, 'Fallbacks:', fallbacks);
        
        if (currentIndex >= 0 && currentIndex < fallbacks.length - 1) {
            imgElement.src = fallbacks[currentIndex + 1];
        } else {
            imgElement.src = '/img/placeholder-product.png';
        }
    }

    window.handleModalImageError = handleModalImageError;

    function handleThumbnailError(imgElement) {
        const fallbacksJson = imgElement.getAttribute('data-fallbacks');
        let fallbacks;
        
        if (fallbacksJson) {
            try {
                // Unescape HTML entities
                const unescaped = fallbacksJson.replace(/&quot;/g, '"');
                fallbacks = JSON.parse(unescaped);
            } catch (e) {
                console.error('[Catalog Modal] Error parsing thumbnail fallbacks:', e, 'Raw:', fallbacksJson);
                const originalUrl = imgElement.getAttribute('data-original-url');
                if (originalUrl) {
                    // Unescape the URL
                    const unescapedUrl = originalUrl.replace(/&quot;/g, '"').replace(/\\'/g, "'");
                    fallbacks = getFallbackUrls(unescapedUrl, 200);
                }
            }
        } else {
            const originalUrl = imgElement.getAttribute('data-original-url');
            if (originalUrl) {
                const unescapedUrl = originalUrl.replace(/&quot;/g, '"').replace(/\\'/g, "'");
                fallbacks = getFallbackUrls(unescapedUrl, 200);
            } else {
                console.warn('[Catalog Modal] No original URL or fallbacks for thumbnail');
                imgElement.src = '/img/placeholder-product.png';
                return;
            }
        }
        
        if (!fallbacks || fallbacks.length === 0) {
            console.warn('[Catalog Modal] No fallbacks available for thumbnail');
            imgElement.src = '/img/placeholder-product.png';
            return;
        }
        
        const currentSrc = imgElement.src;
        const triedIndex = parseInt(imgElement.getAttribute('data-tried-index') || '0');
        
        console.log('[Catalog Modal] Thumbnail error, trying fallback. Current:', currentSrc, 'Tried:', triedIndex, 'Total fallbacks:', fallbacks.length);
        
        if (triedIndex < fallbacks.length - 1) {
            const nextIndex = triedIndex + 1;
            console.log(`[Catalog Modal] Trying fallback ${nextIndex + 1}/${fallbacks.length}:`, fallbacks[nextIndex]);
            imgElement.src = fallbacks[nextIndex];
            imgElement.setAttribute('data-tried-index', nextIndex.toString());
        } else {
            // All fallbacks exhausted, use placeholder
            console.warn('[Catalog Modal] All thumbnail fallbacks exhausted, using placeholder');
            imgElement.src = '/img/placeholder-product.png';
        }
    }

    window.handleThumbnailError = handleThumbnailError;

    /**
     * Set main image in product modal
     */
    function setModalMainImage(url, activeIndex) {
        const mainImageEl = document.getElementById('modalMainImage');
        if (!mainImageEl) {
            console.error('[Catalog Modal] Main image element not found');
            return;
        }

        console.log('[Catalog Modal] Setting main image:', url, 'at index:', activeIndex);
        const fallbacks = getFallbackUrls(url, 800);
        console.log('[Catalog Modal] Fallback URLs:', fallbacks);
        
        // Update data attributes for error handling
        mainImageEl.setAttribute('data-original-url', url);
        mainImageEl.setAttribute('data-fallbacks', JSON.stringify(fallbacks));
        
        mainImageEl.src = fallbacks[0];
        mainImageEl.onerror = function() {
            window.handleModalImageError(this);
        };

        // Update active thumbnail
        document.querySelectorAll('.modal-thumbnail').forEach((thumb, index) => {
            thumb.classList.toggle('active', index === activeIndex);
        });
    }

    /**
     * View product details
     */
    document.addEventListener('viewProduct', (e) => {
        const id = e.detail;
        const product = allProducts.find(p => p.id === id);
        if (!product) return;

        const images = parseImages(product);
        const mainImageUrl = images.length > 0 ? images[0] : null;
        const mainImageFallbacks = mainImageUrl ? getFallbackUrls(mainImageUrl, 800) : ['/img/placeholder-product.png'];
        
        // Debug: log image count and URLs
        console.log(`[Catalog Modal] Product "${product.name}" has ${images.length} images:`, images);
        console.log(`[Catalog Modal] Main image URL:`, mainImageUrl);
        console.log(`[Catalog Modal] Main image fallbacks:`, mainImageFallbacks);
        
        // Show thumbnails if product has multiple images (2 or more)
        const hasMultipleImages = images.length >= 2;

        // Build thumbnails HTML if there are multiple images
        let thumbnailsHTML = '';
        if (hasMultipleImages) {
            console.log(`[Catalog Modal] Showing thumbnails for ${images.length} images`);
            console.log(`[Catalog Modal] Image URLs for thumbnails:`, images);
            thumbnailsHTML = `
                <div class="modal-thumbnails">
                    ${images.map((img, index) => {
                        console.log(`[Catalog Modal] Processing thumbnail ${index + 1}:`, img);
                        const thumbFallbacks = getFallbackUrls(img, 200);
                        console.log(`[Catalog Modal] Thumbnail ${index + 1} fallbacks:`, thumbFallbacks);
                        const escapedUrl = img.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        // Store fallbacks as JSON string, properly escaped for HTML attribute
                        const fallbacksJson = JSON.stringify(thumbFallbacks);
                        return `
                            <div class="modal-thumbnail ${index === 0 ? 'active' : ''}" 
                                 onclick="window.setModalMainImage('${escapedUrl}', ${index})">
                                <img src="${thumbFallbacks[0]}" alt="Thumbnail ${index + 1}" 
                                     onerror="window.handleThumbnailError(this)"
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

        modalContent.innerHTML = `
            <div class="modal-product-view">
                <div class="modal-image-container ${hasMultipleImages ? 'with-thumbnails' : ''}">
                    <img id="modalMainImage" src="${mainImageFallbacks[0]}" alt="${product.name}" 
                         onerror="window.handleModalImageError(this)"
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

        // Expose setModalMainImage globally for onclick handlers
        window.setModalMainImage = (url, activeIndex) => setModalMainImage(url, activeIndex);

        productModal.classList.add('show');
    });
});
