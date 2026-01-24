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
                    <img src="${getImageUrl(product)}" alt="${product.name}" class="product-image" onerror="this.src='/img/placeholder-product.png'">
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

    /**
     * Parse images from product (can be JSON array, string, or already parsed)
     */
    function parseImages(product) {
        if (!product.images) return [];
        
        try {
            // If it's already an array, return it
            if (Array.isArray(product.images)) {
                return product.images.filter(img => img && img.trim() !== '');
            }
            
            // If it's a string, try to parse it
            if (typeof product.images === 'string') {
                const parsed = JSON.parse(product.images);
                return Array.isArray(parsed) ? parsed.filter(img => img && img.trim() !== '') : [];
            }
        } catch (e) {
            console.error('Error parsing images:', e, product.images);
        }
        
        return [];
    }

    /**
     * Get the correct image URL (handling drive proxy)
     */
    function getImageUrl(product) {
        const images = parseImages(product);
        
        if (images.length > 0) {
            // Filter out QR code images (they usually contain 'qr' in the URL or are the qr_image_url)
            const nonQrImages = images.filter(img => {
                const imgLower = img.toLowerCase();
                return img !== product.qr_image_url && 
                       !imgLower.includes('qr') && 
                       !imgLower.includes('qrcode');
            });
            
            // Use first non-QR image, or fallback to first image if all are QR
            const img = nonQrImages.length > 0 ? nonQrImages[0] : images[0];
            
            if (img) {
                // Handle Google Drive URLs
                if (img.includes('drive.google.com')) {
                    const fileId = img.match(/id=([^&]+)/)?.[1] || img.match(/\/d\/([^\/]+)/)?.[1];
                    if (fileId) {
                        return `/api/upload/drive-image/${fileId}`;
                    }
                }
                return img;
            }
        }
        
        return '/img/placeholder-product.png';
    }

    /**
     * View product details
     */
    document.addEventListener('viewProduct', (e) => {
        const id = e.detail;
        const product = allProducts.find(p => p.id === id);
        if (!product) return;

        modalContent.innerHTML = `
            <div class="modal-product-view">
                <div class="modal-image-container">
                    <img src="${getImageUrl(product)}" alt="${product.name}" onerror="this.src='/img/placeholder-product.png'">
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

        productModal.classList.add('show');
    });
});
