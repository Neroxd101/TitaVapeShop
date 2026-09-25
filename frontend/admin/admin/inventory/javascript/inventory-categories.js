const InventoryCategories = {
  categories: [],

  async init() {
    await this.load();
    this.ensureModal();
    this.bindCreateCategory();
    this.bindDeleteCategory();
  },

  async load() {
    const response = await fetch('/inventory/categories');
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load categories');
    this.categories = result.categories || [];
    this.populateFilter();
    this.populateItemSelect();
  },

  populateFilter() {
    const select = document.getElementById('categoryFilter');
    if (!select) return;
    select.innerHTML = '<option value="all">All Categories</option>' + this.categories
      .map(category => `<option value="${this.escape(category.slug)}">${this.escape(category.name)}</option>`).join('');
  },

  populateItemSelect(selected = '') {
    const select = document.getElementById('itemCategory');
    if (!select) return;
    select.innerHTML = '<option value="">Select category</option>' + this.categories
      .map(category => `<option value="${this.escape(category.slug)}">${this.escape(category.name)}</option>`).join('')
      + '<option value="__new__">+ Add New Category</option>';
    if (selected) select.value = selected;
  },

  bindCreateCategory() {
    document.getElementById('itemCategory')?.addEventListener('change', async (event) => {
      if (event.target.value !== '__new__') return;
      const name = await this.openModal();
      if (!name) { event.target.value = ''; return; }
      try {
        const response = await fetch('/inventory/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim() })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Unable to create category');
        await this.load();
        this.populateItemSelect(result.category.slug);
      } catch (error) {
        alert(error.message);
        event.target.value = '';
      }
    });
  },

  bindDeleteCategory() {
    document.getElementById('deleteCategoryBtn')?.addEventListener('click', async () => {
      const select = document.getElementById('itemCategory');
      const slug = select?.value;
      const category = this.categories.find(item => item.slug === slug);
      if (!category || !window.confirm(`Delete the category “${category.name}”?`)) return;
      try {
        const response = await fetch(`/inventory/categories/${encodeURIComponent(slug)}`, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Unable to delete category');
        await this.load();
        this.populateItemSelect();
      } catch (error) {
        alert(error.message);
      }
    });
  },

  ensureModal() {
    if (document.getElementById('categoryModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="categoryModal" role="dialog" aria-modal="true" aria-labelledby="categoryModalTitle">
        <form class="modal modal-small" id="categoryForm">
          <div class="modal-header">
            <h3 id="categoryModalTitle">Add New Category</h3>
          </div>
          <div class="form-group">
            <input type="text" id="newCategoryName" maxlength="20" placeholder="Enter category name" required>
            <small class="category-modal-error" id="categoryModalError" role="alert"></small>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="categoryModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Category</button>
          </div>
        </form>
      </div>`);
  },

  openModal() {
    const modal = document.getElementById('categoryModal');
    const form = document.getElementById('categoryForm');
    const input = document.getElementById('newCategoryName');
    const error = document.getElementById('categoryModalError');
    modal.classList.add('show');
    input.value = '';
    error.textContent = '';
    setTimeout(() => input.focus(), 0);
    return new Promise(resolve => {
      const close = value => {
        modal.classList.remove('show');
        form.onsubmit = null;
        document.getElementById('categoryModalCancel').onclick = null;
        resolve(value);
      };
      form.onsubmit = event => {
        event.preventDefault();
        const value = input.value.trim();
        if (!value || value.length > 20) {
          error.textContent = 'Enter a category name from 1 to 20 characters.';
          return;
        }
        close(value);
      };
      document.getElementById('categoryModalCancel').onclick = () => close(null);
    });
  },

  escape(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
};
window.InventoryCategories = InventoryCategories;
