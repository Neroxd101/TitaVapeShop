// Load and populate the category filter used by the POS product list.
const PosCategories = {
  async init(onChange) {
    const response = await fetch('/inventory/categories');
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to load POS categories');
    }

    const select = document.getElementById('categoryFilter');
    if (!select) return;

    const categories = result.categories || [];
    select.innerHTML = '<option value="all">All Categories</option>' + categories
      .map(category => `<option value="${this.escape(category.slug)}">${this.escape(category.name)}</option>`)
      .join('');
    select.addEventListener('change', () => onChange?.());
  },

  escape(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }
};

window.PosCategories = PosCategories;
