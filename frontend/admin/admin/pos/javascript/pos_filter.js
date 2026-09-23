// Logic for Filtering and Sorting POS / Sales Products
const SalesFilter = {
    filterProducts(state) {
        const q = (document.getElementById('productSearch')?.value || '').trim().toLowerCase();
        const categorySelect = document.getElementById('categoryFilter');
        const category = categorySelect ? categorySelect.value : 'all';

        let filtered = (state.products || []).filter(item => {
            if (category && category !== 'all' && item.category !== category) return false;
            if (!q) return true;
            return (item.name || '').toLowerCase().includes(q);
        });

        state.filtered = this.sortProducts(filtered);
        return state.filtered;
    },

    sortProducts(items) {
        const sortSelect = document.getElementById('sortBy');
        const sortType = sortSelect ? sortSelect.value : 'name-asc';

        return [...items].sort((a, b) => {
            switch (sortType) {
                case 'name-asc':
                    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
                case 'name-desc':
                    return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });
                case 'price-asc': {
                    const priceA = Number(a.sale_price || 0);
                    const priceB = Number(b.sale_price || 0);
                    return priceA - priceB;
                }
                case 'price-desc': {
                    const priceA = Number(a.sale_price || 0);
                    const priceB = Number(b.sale_price || 0);
                    return priceB - priceA;
                }
                case 'stock-asc': {
                    const stockA = Number(a.quantity || 0);
                    const stockB = Number(b.quantity || 0);
                    return stockA - stockB;
                }
                case 'stock-desc': {
                    const stockA = Number(a.quantity || 0);
                    const stockB = Number(b.quantity || 0);
                    return stockB - stockA;
                }
                default:
                    return 0;
            }
        });
    }
};

window.SalesFilter = SalesFilter;
