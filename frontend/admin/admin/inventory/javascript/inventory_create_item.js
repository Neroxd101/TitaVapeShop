// Logic for Create Item (Write)
const InventoryCreate = {
    async init() {
        await this.loadItemModal();
    },

    async loadItemModal() {
        const container = document.getElementById('item-modal-container');
        if (!container) return;

        try {
            const response = await fetch('/admin/admin/inventory/inventory-add-edit-modal.html');
            if (response.ok) {
                container.innerHTML = await response.text();
                InventoryDOM.itemModal = document.getElementById('itemModal');
                InventoryDOM.itemForm = document.getElementById('itemForm');
                this.setupEventListeners();
            }
        } catch (error) {
            console.error('Error loading item modal:', error);
        }
    },

    setupEventListeners() {
        InventoryDOM.itemForm?.addEventListener('submit', (e) => {
            if (InventoryState.editingItemId) {
                if (window.InventoryUpdate?.handleUpdate) InventoryUpdate.handleUpdate(e);
            } else {
                this.handleCreate(e);
            }
        });

        document.getElementById('modalClose')?.addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn')?.addEventListener('click', () => this.closeModal());
        document.getElementById('addVariationBtn')?.addEventListener('click', () => this.addVariationField());

        // Multiple images upload & thumbnail editing
        document.getElementById('itemImages')?.addEventListener('change', (e) => {
            if (window.InventoryImage?.handleImagesSelect) InventoryImage.handleImagesSelect(e);
        });

        document.getElementById('editThumbnails')?.addEventListener('click', (e) => {
            const imageItem = e.target.closest('.image-item');
            if (!imageItem || !window.InventoryImage) return;
            const index = Number(imageItem.dataset.index);
            if (e.target.closest('.remove-image')) InventoryImage.removeImage(index);
            else InventoryImage.setEditMainImage(index);
        });

        InventoryDOM.itemModal?.addEventListener('click', (e) => {
            if (e.target === InventoryDOM.itemModal) this.closeModal();
        });
    },

    openAddModal() {
        InventoryState.editingItemId = null;
        InventoryState.currentImages = [];

        document.getElementById('modalTitle').textContent = 'Add New Item';
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) saveBtn.querySelector('.btn-text').textContent = 'Save Item';

        // Set explicit create-data attribute if needed, but we handle logic here
        InventoryDOM.itemForm.reset();
        this.renderVariationFields();
        InventoryImage.renderImagesGrid();
        InventoryDOM.itemModal.classList.add('show');
    },

    async handleCreate(e) {
        e.preventDefault();
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.classList.add('loading');
        saveBtn.disabled = true;

        try {
            const productName = document.getElementById('itemName').value.trim();
            if (!productName) throw new Error('Product name is required');

            await InventoryImage.uploadPendingImages(productName);
            const imageUrls = InventoryState.currentImages.filter(img => img.url).map(img => img.url);

            const itemData = {
                category: document.getElementById('itemCategory').value,
                name: productName,
                variations: this.getVariationValue(),
                description: document.getElementById('itemDescription').value.trim() || null,
                quantity: parseInt(document.getElementById('itemQuantity').value) || 0,
                cost_price: parseFloat(document.getElementById('itemCostPrice').value) || 0,
                sale_price: parseFloat(document.getElementById('itemSalePrice').value) || 0,
                images: imageUrls,
            };

            const response = await fetch('/inventory/inventory_create_item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemData)
            });
            const result = await response.json();

            if (result.success) {
                InventoryDOM.itemModal.classList.remove('show');
                if (window.TransactionLogger) TransactionLogger.logInventoryAdd(result.data || itemData);
                InventoryLoad.initialLoad();
            } else {
                throw new Error(result.error || 'Failed to create item');
            }
        } catch (error) {
            alert(error.message);
        } finally {
            saveBtn.classList.remove('loading');
            saveBtn.disabled = false;
        }
    },


    getVariationValue() {
        return [...document.querySelectorAll('.variation-row')].map(row => ({ name: row.querySelector('.variation-input')?.value.trim(), quantity: Number(row.querySelector('.variation-quantity')?.value) || 0 })).filter(item => item.name).slice(0, 10);
    },

    renderVariationFields(value = '') {
        const values = Array.isArray(value) ? value.slice(0, 10) : String(value || '').split('|').map(item => ({ name: item.trim(), quantity: 0 })).filter(item => item.name).slice(0, 10);
        const list = document.getElementById('variationsList');
        if (!list) return;
        list.innerHTML = '';
        (values.length ? values : ['']).forEach(item => this.addVariationField(item, true));
    },

    addVariationField(value = '', skipLimitCheck = false) {
        const list = document.getElementById('variationsList');
        if (!list || (!skipLimitCheck && list.children.length >= 10)) return;
        const row = document.createElement('div');
        row.className = 'variation-row';
        const input = document.createElement('input');
        input.type = 'text'; input.className = 'variation-input'; input.placeholder = 'e.g., Blue, 30 ml, 0.8 Ω'; input.maxLength = 100; input.value = typeof value === 'object' ? value.name : value;
        const resizeVariationInput = () => { input.style.width = `${Math.min(220, Math.max(30, (input.value.length + 1) * 7))}px`; };
        resizeVariationInput();
        input.addEventListener('input', resizeVariationInput);
        const remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'variation-remove'; remove.textContent = '×'; remove.title = 'Remove variation'; remove.setAttribute('aria-label', 'Remove variation');
        remove.addEventListener('click', () => { row.remove(); if (!list.children.length) this.addVariationField('', true); });
        const qty = document.createElement('input');
        qty.type = 'number'; qty.className = 'variation-quantity'; qty.min = '0'; qty.step = '1'; qty.placeholder = 'Qty'; qty.setAttribute('aria-label', 'Variation quantity'); qty.value = typeof value === 'object' ? (value.quantity || 0) : 0;
        const nameWrap = document.createElement('div'); nameWrap.className = 'variation-name-field';
        const qtyWrap = document.createElement('div'); qtyWrap.className = 'variation-qty-field';
        nameWrap.appendChild(input); qtyWrap.appendChild(qty);
        row.append(nameWrap, qtyWrap, remove); list.appendChild(row);
    },
    closeModal() {
        InventoryDOM.itemModal.classList.remove('show');
    }
};

window.InventoryCreate = InventoryCreate;
