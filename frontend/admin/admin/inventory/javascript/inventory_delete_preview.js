const InventoryDeletePreview = {
    async get(id) {
        const response = await fetch(`/inventory/inventory_delete_item/${encodeURIComponent(id)}/preview`, {
            headers: { Accept: 'application/json' }
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Unable to check affected orders.');
        return result;
    }
};

window.InventoryDeletePreview = InventoryDeletePreview;
