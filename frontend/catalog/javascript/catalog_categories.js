const CatalogCategories = {
  categories: [],
  async init() {
    const select = document.getElementById('categoryFilter');
    if (!select) return;
    try {
      const response = await fetch('/catalog/categories');
      const result = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.categories)) {
        console.warn('Unable to load catalog categories:', result.error || response.status);
        return;
      }
      this.categories = result.categories;
      this.render();
    } catch (error) {
      console.error('Unable to load catalog categories:', error);
    }
  },
  populateFromProducts(products) {
    const categories = new Map(this.categories.map(category => [String(category.slug).toLowerCase(), category]));
    products.forEach(product => {
      const value = String(product.category || '').trim();
      if (value && !categories.has(value.toLowerCase())) {
        categories.set(value.toLowerCase(), { slug: value, name: value });
      }
    });
    this.categories = [...categories.values()].sort((a, b) => a.name.localeCompare(b.name));
    this.render();
  },
  render() {
    const select = document.getElementById('categoryFilter');
    if (!select) return;
    const previous = select.value;
    select.innerHTML = '<option value="all">All Items</option>' + this.categories
      .map(category => `<option value="${this.escape(category.slug)}">${this.escape(category.name)}</option>`)
      .join('');
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  },
  escape(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
};
window.CatalogCategories = CatalogCategories;
