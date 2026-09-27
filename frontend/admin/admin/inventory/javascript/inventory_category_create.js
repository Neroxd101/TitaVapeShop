const InventoryCategoryCreate = {
  init({ onCreated, showError }) {
    this.ensureModal();
    this.bind({
      openModal: () => this.openModal(),
      onCreated,
      showError
    });
  },

  ensureModal() {
    if (document.getElementById('categoryModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="categoryModal" role="dialog" aria-modal="true" aria-labelledby="categoryModalTitle">
        <form class="modal modal-small" id="categoryForm">
          <div class="modal-header"><h3 id="categoryModalTitle">Add New Category</h3></div>
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

  bind({ openModal, onCreated, showError }) {
    document.getElementById('itemCategory')?.addEventListener('change', async event => {
      if (event.target.value !== '__new__') return;
      const name = await openModal();
      if (!name) {
        event.target.value = '';
        return;
      }
      try {
        const category = await this.create(name);
        await onCreated(category);
      } catch (error) {
        showError(error.message);
        event.target.value = '';
      }
    });
  },

  async create(name) {
    const response = await fetch('/inventory/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to create category');
    }
    return result.category;
  }
};

window.InventoryCategoryCreate = InventoryCategoryCreate;
