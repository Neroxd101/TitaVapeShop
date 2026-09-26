const InventoryCategoryGet = {
  async load() {
    const response = await fetch('/inventory/categories');
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to load categories');
    }
    return result.categories || [];
  }
};

window.InventoryCategoryGet = InventoryCategoryGet;
