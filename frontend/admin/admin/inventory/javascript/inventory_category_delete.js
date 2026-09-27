const InventoryCategoryDelete = {
  init({ categories, onDeleted }) {
    this.ensureModal();
    this.bind({
      categories,
      onDeleted,
      showError: message => this.showError(message)
    });
  },

  ensureModal() {
    if (document.getElementById('categoryDeleteModal')) return;
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

  bind({ categories, onDeleted, showError }) {
    document.getElementById('deleteCategoryBtn')?.addEventListener('click', async () => {
      const select = document.getElementById('itemCategory');
      const slug = select?.value;
      const category = categories().find(item => item.slug === slug);
      if (!category || !(await this.confirm(category.name))) return;
      try {
        await this.remove(slug);
        await onDeleted();
      } catch (error) {
        showError(error.message);
      }
    });
  },

  confirm(name) {
    const modal = document.getElementById('categoryDeleteModal');
    const message = document.getElementById('categoryDeleteMessage');
    const error = document.getElementById('categoryDeleteError');
    message.textContent = `Are you sure you want to delete "${name}"?`;
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

  showError(message) {
    const modal = document.getElementById('categoryDeleteModal');
    document.getElementById('categoryDeleteMessage').textContent = '';
    document.getElementById('categoryDeleteError').textContent = message.includes('products')
      ? 'This category still has products. Move or delete those products before deleting the category.'
      : message;
    modal.classList.add('show');
    document.getElementById('categoryDeleteConfirm').style.display = 'none';
    const close = document.getElementById('categoryDeleteCancel');
    close.textContent = 'Close';
    close.onclick = () => modal.classList.remove('show');
  },

  async remove(slug) {
    const response = await fetch(`/inventory/categories/${encodeURIComponent(slug)}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to delete category');
    }
  }
};

window.InventoryCategoryDelete = InventoryCategoryDelete;
