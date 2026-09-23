/**
 * Product Catalog Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const productGrid = document.getElementById('productGrid');

    let allProducts = [];

    // Initialize
    async function init() {
        try {
            // Initialize product modal (before fetching products)
            // Don't block if modal fails to load
            if (window.CatalogProductModal) {
                await CatalogProductModal.init([]);
            } else {
                console.warn('[Catalog] CatalogProductModal not available, continuing without modal');
            }

            // Initialize catalog filter
            if (window.CatalogFilter) {
                CatalogFilter.init({
                    onFilterChange: () => filterAndRender()
                });
            }
            
            // Fetch products (always try to fetch, even if modal failed)
            await fetchProducts();
            
            // Update modal with products after fetch
            if (window.CatalogProductModal) {
                CatalogProductModal.allProducts = allProducts;
            }
        } catch (error) {
            console.error('[Catalog] Initialization error:', error);
            // Try to fetch products anyway
            try {
                await fetchProducts();
            } catch (fetchError) {
                console.error('[Catalog] Failed to fetch products:', fetchError);
            }
        }
    }

    // Listen for cart updates to refresh stock display
    document.addEventListener('cartUpdated', (e) => {
        const productId = e.detail;
        updateProductStock(productId);
    });

    /**
     * Fetch products from CatalogGetProducts module
     */
    async function fetchProducts() {
        try {
            const result = await window.CatalogGetProducts.fetchProducts();

            if (result.success) {
                allProducts = result.data;
                if (window.CatalogProductModal) {
                    CatalogProductModal.allProducts = allProducts;
                }
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
        const filtered = window.CatalogFilter 
            ? CatalogFilter.filterAndSort(allProducts) 
            : allProducts;

        renderProducts(filtered);
    }

    function renderProducts(products) {
        if (window.CatalogCard) {
            CatalogCard.renderProducts(products);
        }
    }

    function updateProductStock(productId) {
        if (window.CatalogCard) {
            CatalogCard.updateProductStock(productId);
        }
    }

    /**
     * View product details - use separated modal
     */
    document.addEventListener('viewProduct', (e) => {
        const id = e.detail;
        const product = allProducts.find(p => p.id === id);
        if (!product) return;

        if (window.CatalogProductModal) {
            CatalogProductModal.show(product);
        } else {
            console.error('[Catalog] Product modal not initialized');
        }
    });

    // Start initialization
    init();
});
