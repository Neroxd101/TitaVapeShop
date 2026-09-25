const CatalogCategories = {
  async init() {
    const select = document.getElementById('categoryFilter');
    if (!select) return;
    try {
      const response = await fetch('/catalog/categories');
      const result = await response.json();
      if (!response.ok || !result.success) return;
      select.innerHTML = '<option value="all">All Items</option>' + (result.categories || [])
        .map(category => `<option value="${this.escape(category.slug)}">${this.escape(category.name)}</option>`)
        .join('');
    } catch (error) {
      console.error('Unable to load catalog categories:', error);
    }
  },
  escape(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
};
window.CatalogCategories = CatalogCategories;
