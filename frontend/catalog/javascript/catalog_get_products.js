/**
 * Catalog Get Products Module
 * Frontend client module matching catalog_get_products RPC and backend route
 */

const CatalogGetProducts = {
  allProducts: [],

  /**
   * Fetch products from backend API
   * @param {string} [category]
   * @param {string} [search]
   * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
   */
  async fetchProducts(category = null, search = null) {
    try {
      const params = new URLSearchParams();
      if (category && category !== 'all') params.append('category', category);
      if (search) params.append('search', search);

      const qs = params.toString() ? `?${params.toString()}` : '';
      let res = await fetch(`/api/catalog/products${qs}`);
      
      if (!res.ok) {
        // Fallback to alias if needed
        res = await fetch(`/api/inventory/list${qs}`);
      }

      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        this.allProducts = result.data;
        return { success: true, data: this.allProducts };
      }

      return { success: false, error: result.error || 'Failed to fetch catalog items', data: [] };
    } catch (err) {
      console.error('[CatalogGetProducts] Fetch error:', err);
      return { success: false, error: err.message || 'Network error fetching products', data: [] };
    }
  },

  /**
   * Get product by ID
   * @param {string} productId
   * @returns {object|undefined}
   */
  getProductById(productId) {
    return this.allProducts.find(p => p.id === productId);
  },

  /**
   * Get available stock for a product, subtracting items currently in the cart
   * @param {object} product
   * @returns {number}
   */
  getAvailableStock(product) {
    if (!product) return 0;
    const cart = window.CatalogCart?.cart || [];
    const cartItem = cart.find(item => item.id === product.id);
    const cartQuantity = cartItem ? (Number(cartItem.quantity) || 0) : 0;
    return Math.max(0, (Number(product.quantity) || 0) - cartQuantity);
  },

  /**
   * Filter in-memory products array
   * @param {string} category
   * @param {string} search
   * @returns {Array}
   */
  filter(category = 'all', search = '') {
    const selectedCategory = String(category || '').trim().toLowerCase();
    const query = String(search || '').trim().toLowerCase();

    return this.allProducts.filter(product => {
      const productCategory = String(product.category || '').trim().toLowerCase();
      const matchesCategory = selectedCategory === 'all' || productCategory === selectedCategory;
      const matchesSearch = !query ||
        (product.name && product.name.toLowerCase().includes(query)) ||
        (product.description && product.description.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }
};

window.CatalogGetProducts = CatalogGetProducts;

// Provide window.CatalogProducts alias for backward-compatibility with catalog-cart.js
window.CatalogProducts = CatalogGetProducts;
