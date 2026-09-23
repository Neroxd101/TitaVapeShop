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
      const res = await fetch(`/api/catalog/products${qs}`);
      

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
  }
};

window.CatalogGetProducts = CatalogGetProducts;

// Shared product access used by cart and card modules.
window.CatalogProducts = CatalogGetProducts;
