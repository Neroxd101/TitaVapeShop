// Shared client for the inventory_get_all backend route and RPC.
const InventoryGetAll = {
    async fetchItems() {
        const response = await fetch('/inventory/inventory_get_all', {
            method: 'GET',
            credentials: 'include'
        });
        const result = await response.json();
        if (!response.ok || !result?.success) {
            return { success: false, error: result?.error || 'Unable to load inventory.' };
        }
        return result;
    }
};
window.InventoryGetAll = InventoryGetAll;
