// Logic for Catalog Filtering, Searching, and Sorting
const CatalogFilter = {
    currentCategory: 'all',
    searchQuery: '',
    currentSort: 'default',
    onFilterChange: null,

    init({ onFilterChange } = {}) {
        this.onFilterChange = onFilterChange;
        this.setupEventListeners();
    },

    normalizeCategory(value) {
        return String(value || '').trim().toLowerCase();
    },

    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const categoryFilter = document.getElementById('categoryFilter');
        const sortSelect = document.getElementById('sortSelect');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.notify();
            });
        }

        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.currentCategory = e.target.value || 'all';
                this.notify();
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                sortSelect.closest('.sort-box')?.classList.toggle('is-active', this.currentSort !== 'default');
                this.notify();
            });
        }
    },

    notify() {
        if (typeof this.onFilterChange === 'function') {
            this.onFilterChange();
        }
    },

    filterAndSort(products = []) {
        const selectedCategory = this.normalizeCategory(this.currentCategory);
        let filtered = products.filter(product => {
            const productCategory = this.normalizeCategory(product.category);
            const matchesCategory = selectedCategory === 'all' || productCategory === selectedCategory;
            const matchesSearch = !this.searchQuery || (product.name || '').toLowerCase().includes(this.searchQuery);
            return matchesCategory && matchesSearch;
        });

        // Apply sorting
        if (this.currentSort === 'price-asc') {
            filtered.sort((a, b) => (parseFloat(a.sale_price) || 0) - (parseFloat(b.sale_price) || 0));
        } else if (this.currentSort === 'price-desc') {
            filtered.sort((a, b) => (parseFloat(b.sale_price) || 0) - (parseFloat(a.sale_price) || 0));
        } else if (this.currentSort === 'name-asc') {
            filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
        } else if (this.currentSort === 'name-desc') {
            filtered.sort((a, b) => (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' }));
        }

        return filtered;
    }
};

window.CatalogFilter = CatalogFilter;
