const InventoryCategoryDelete = {
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
