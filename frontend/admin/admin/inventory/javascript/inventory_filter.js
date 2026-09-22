// Logic for Inventory Filtering and Sorting
const InventoryFilter = {
    filterItems(items = InventoryState.inventoryItems || []) {
        const filtered = items.filter(item => {
            const matchesCategory = InventoryState.currentFilter === 'all' || item.category === InventoryState.currentFilter;
            const matchesSearch = (item.name || '').toLowerCase().includes((InventoryState.searchQuery || '').toLowerCase());

            // Use the same local calendar date shown in the item details.
            let matchesDate = true;
            if (InventoryState.addedDateFrom || InventoryState.addedDateTo) {
                const created = new Date(item.created_at);
                const localDate = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
                matchesDate = Boolean(item.created_at) && !Number.isNaN(created.getTime())
                    && (!InventoryState.addedDateFrom || localDate >= InventoryState.addedDateFrom)
                    && (!InventoryState.addedDateTo || localDate <= InventoryState.addedDateTo);
            }
            return matchesCategory && matchesSearch && matchesDate;
        });

        return this.sortItems(filtered);
    },

    sortItems(items) {
        const sortType = InventoryState.sortBy || 'date-desc';
        return [...items].sort((a, b) => {
            switch (sortType) {
                case 'name-asc':
                    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
                case 'name-desc':
                    return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });
                case 'price-asc':
                    return (Number(a.sale_price) || 0) - (Number(b.sale_price) || 0);
                case 'price-desc':
                    return (Number(b.sale_price) || 0) - (Number(a.sale_price) || 0);
                case 'stock-asc':
                    return (Number(a.quantity) || 0) - (Number(b.quantity) || 0);
                case 'stock-desc':
                    return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
                case 'date-asc': {
                    const timeA = new Date(a.created_at).getTime() || 0;
                    const timeB = new Date(b.created_at).getTime() || 0;
                    return timeA - timeB;
                }
                case 'date-desc':
                default: {
                    const timeA = new Date(a.created_at).getTime() || 0;
                    const timeB = new Date(b.created_at).getTime() || 0;
                    return timeB - timeA;
                }
            }
        });
    }
};

window.InventoryFilter = InventoryFilter;
