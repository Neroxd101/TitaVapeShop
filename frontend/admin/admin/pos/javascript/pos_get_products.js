// Client for pos_get_products backend route and RPC
const PosGetProducts = {
    async fetchProducts() {
        try {
            const response = await fetch('/pos/pos_get_products', {
                method: 'GET',
                credentials: 'include'
            });
            const result = await response.json();
            if (!response.ok || !result?.success) {
                return { success: false, error: result?.error || 'Unable to load products for POS.' };
            }
            return result;
        } catch (error) {
            console.error('Error fetching POS products:', error);
            return { success: false, error: error.message };
        }
    }
};

window.PosGetProducts = PosGetProducts;
