const InventoryCategoryCreate = {
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
