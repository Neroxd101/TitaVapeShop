const InventoryCategoryGet = {
  categories: [],

  async init() {
    await this.refresh();
  },

  async refresh(selected = '') {
    this.categories = await this.load();
    this.populateFilter(this.categories);
    this.populateItemSelect(this.categories, selected);
    return this.categories;
  },

  add(category) {
    if (!category || !category.slug) return;
    this.categories = this.categories.filter(item => item.slug !== category.slug);
    this.categories.push(category);
    this.populateFilter(this.categories);
    this.populateItemSelect(this.categories, category.slug);
  },

  populateFilter(categories) {
    const select = document.getElementById('categoryFilter');
    if (!select) return;
    const previous = InventoryState.currentFilter;
    const selected = categories.some(category => category.slug === previous) ? previous : 'all';
    select.innerHTML = '<option value="all">All Categories</option>' + categories
      .map(category => `<option value="${this.escape(category.slug)}">${this.escape(category.name)}</option>`).join('');
    select.value = selected;
    InventoryState.currentFilter = selected;
    if (previous !== selected) {
      InventoryState.currentPage = 1;
      InventoryDisplay.renderInventory();
    }
  },

  populateItemSelect(categories, selected = '') {
    const select = document.getElementById('itemCategory');
    if (!select) return;
    select.innerHTML = '<option value="">Select category</option>' + categories
      .map(category => `<option value="${this.escape(category.slug)}">${this.escape(category.name)}</option>`).join('')
      + '<option value="__new__">+ Add New Category</option>';
    if (selected) select.value = selected;
  },

  async load() {
    const response = await fetch('/inventory/categories');
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to load categories');
    }
    return result.categories || [];
  },

  escape(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
};

window.InventoryCategoryGet = InventoryCategoryGet;
