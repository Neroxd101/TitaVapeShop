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

    // Event Listeners
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        filterAndRender();
    });

    categoryFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            // Update active state
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
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

        productGrid.innerHTML = products.map(product => `
            <div class="product-card" data-id="${product.id}">
                <div class="product-image-container">
                    <img src="${getImageUrl(product)}" alt="${product.name}" class="product-image" onerror="this.src='/img/placeholder-product.png'">
                    ${product.quantity > 0
                ? `<span class="product-badge badge-stock">In Stock</span>`
                : `<span class="product-badge badge-out">Out of Stock</span>`}
                </div>
                <div class="product-info">
                    <span class="product-category">${product.category}</span>
                    <h3 class="product-name">${product.name}</h3>
                    <div class="product-footer">
                        <span class="product-price">₱${product.sale_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <button class="btn btn-secondary btn-sm view-btn" onclick="document.dispatchEvent(new CustomEvent('viewProduct', {detail: '${product.id}'}))">Details</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Get the correct image URL (handling drive proxy)
     */
    function getImageUrl(product) {
        if (product.images && product.images.length > 0) {
            const img = product.images[0];
            if (img.includes('drive.google.com')) {
                const fileId = img.match(/id=([^&]+)/)?.[1];
                return fileId ? `/api/upload/drive-image/${fileId}` : img;
            }
            return img;
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
