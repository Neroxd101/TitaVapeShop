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
      if (!category || !(await this.confirmDelete(category.name))) return;
      try {
        const response = await fetch(`/inventory/categories/${encodeURIComponent(slug)}`, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Unable to delete category');
        await this.load();
        this.populateItemSelect();
      } catch (error) {
        this.showDeleteError(error.message);
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
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="categoryDeleteModal" role="dialog" aria-modal="true" aria-labelledby="categoryDeleteTitle">
        <div class="modal modal-small category-delete-modal">
          <div class="modal-header"><h3 id="categoryDeleteTitle">Delete Category</h3></div>
          <p class="category-delete-message" id="categoryDeleteMessage"></p>
          <p class="category-delete-error" id="categoryDeleteError" role="alert"></p>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="categoryDeleteCancel">Cancel</button>
            <button type="button" class="btn btn-danger" id="categoryDeleteConfirm">Delete</button>
          </div>
        </div>
      </div>`);
  },

  confirmDelete(name) {
    const modal = document.getElementById('categoryDeleteModal');
    const message = document.getElementById('categoryDeleteMessage');
    const error = document.getElementById('categoryDeleteError');
    message.textContent = `Are you sure you want to delete “${name}”?`;
    error.textContent = '';
    document.getElementById('categoryDeleteConfirm').style.display = '';
    document.getElementById('categoryDeleteCancel').textContent = 'Cancel';
    modal.classList.add('show');
    return new Promise(resolve => {
      const close = value => {
        modal.classList.remove('show');
        document.getElementById('categoryDeleteCancel').onclick = null;
        document.getElementById('categoryDeleteConfirm').onclick = null;
        resolve(value);
      };
      document.getElementById('categoryDeleteCancel').onclick = () => close(false);
      document.getElementById('categoryDeleteConfirm').onclick = () => close(true);
    });
  },

  showDeleteError(message) {
    const modal = document.getElementById('categoryDeleteModal');
    const confirmationMessage = document.getElementById('categoryDeleteMessage');
    const error = document.getElementById('categoryDeleteError');
    confirmationMessage.textContent = '';
    error.textContent = message.includes('products')
      ? 'This category still has products. Move or delete those products before deleting the category.'
      : message;
    modal.classList.add('show');
    document.getElementById('categoryDeleteConfirm').style.display = 'none';
    document.getElementById('categoryDeleteCancel').textContent = 'Close';
    document.getElementById('categoryDeleteCancel').onclick = () => modal.classList.remove('show');
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
