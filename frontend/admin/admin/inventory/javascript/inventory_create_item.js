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
        document.getElementById('itemQuantity')?.addEventListener('input', () => this.updateVariationLimits());
        document.addEventListener('click', (event) => {
            if (!event.target.closest('#variationControls .variation-row')) {
                document.querySelectorAll('#variationControls .variation-row.is-delete-confirming')
                    .forEach(row => row.classList.remove('is-delete-confirming'));
            }
        });

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
        document.getElementById('thumbnailPrevBtn')?.addEventListener('click', () => InventoryImage.changeThumbnailPage(-1));
        document.getElementById('thumbnailNextBtn')?.addEventListener('click', () => InventoryImage.changeThumbnailPage(1));

        InventoryDOM.itemModal?.addEventListener('click', (e) => {
            if (e.target === InventoryDOM.itemModal) this.closeModal();
        });
    },

    openAddModal() {
        InventoryState.editingItemId = null;
        InventoryState.currentImages = [];
        InventoryImage.thumbnailPage = 0;

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
            this.validateVariationQuantities();

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

    updateVariationLimits(changedInput = null) {
        const totalStock = Math.max(0, Number(document.getElementById('itemQuantity')?.value) || 0);
        const inputs = [...document.querySelectorAll('#variationsList .variation-quantity')];

        if (changedInput) {
            const usedByOthers = inputs.reduce((sum, input) => input === changedInput ? sum : sum + (Number(input.value) || 0), 0);
            const remaining = Math.max(0, totalStock - usedByOthers);
            changedInput.value = String(Math.min(Math.max(0, Number(changedInput.value) || 0), remaining));
        }

        inputs.forEach(input => {
            const usedByOthers = inputs.reduce((sum, other) => other === input ? sum : sum + (Number(other.value) || 0), 0);
            input.max = String(Math.max(0, totalStock - usedByOthers));
            input.title = `Maximum available: ${input.max}`;
        });
    },

    validateVariationQuantities() {
        const totalStock = Math.max(0, Number(document.getElementById('itemQuantity')?.value) || 0);
        const allocated = this.getVariationValue().reduce((sum, variation) => sum + variation.quantity, 0);
        if (allocated > totalStock) {
            throw new Error(`Variant quantities cannot exceed the product quantity of ${totalStock}.`);
        }
    },

    lockVariationRow(row) {
        if (row.classList.contains('is-locked')) return;
        const nameInput = row.querySelector('.variation-input');
        const quantityInput = row.querySelector('.variation-quantity');
        const display = document.createElement('span');
        display.className = 'variation-display';
        display.textContent = `${nameInput.value} ( Qty : ${Number(quantityInput.value) || 0})`;

        row.classList.add('is-locked');
        row.querySelectorAll('.variation-input, .variation-quantity').forEach(input => {
            input.readOnly = true;
            input.tabIndex = -1;
        });
        row.querySelector('.variation-name-field').hidden = true;
        row.querySelector('.variation-qty-field').hidden = true;
        row.insertBefore(display, row.querySelector('.variation-remove'));
    },

    renderVariationFields(value = '') {
        const values = Array.isArray(value) ? value.slice(0, 10) : String(value || '').split('|').map(item => ({ name: item.trim(), quantity: 0 })).filter(item => item.name).slice(0, 10);
        const list = document.getElementById('variationsList');
        if (!list) return;
        list.innerHTML = '';
        values.forEach(item => this.addVariationField(item, true));
        this.updateAddVariationButton();
    },

    updateAddVariationButton() {
        const list = document.getElementById('variationsList');
        const button = document.getElementById('addVariationBtn');
        if (!list || !button) return;
        const reachedLimit = list.children.length >= 10;
        button.hidden = reachedLimit;
        button.disabled = reachedLimit;
    },

    addVariationField(value = '', skipLimitCheck = false) {
        const list = document.getElementById('variationsList');
        if (!list || (!skipLimitCheck && list.children.length >= 10)) return;
        const row = document.createElement('div');
        row.className = 'variation-row';
        row.addEventListener('click', (event) => {
            if (!event.target.closest('input') && !row.classList.contains('is-delete-confirming')) {
                row.classList.add('is-delete-confirming');
            }
        });
        const input = document.createElement('input');
        input.type = 'text'; input.className = 'variation-input'; input.placeholder = 'Name'; input.maxLength = 100; input.value = typeof value === 'object' ? value.name : value;
        const resizeVariationInput = () => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const styles = getComputedStyle(input);
            context.font = `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
            const text = input.value || input.placeholder;
            input.style.width = `${Math.max(24, Math.ceil(context.measureText(text).width) + 2)}px`;
        };
        resizeVariationInput();
        input.addEventListener('input', resizeVariationInput);
        const remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'variation-remove'; remove.textContent = 'Delete'; remove.title = 'Remove variation'; remove.setAttribute('aria-label', 'Remove variation');
        remove.addEventListener('click', (event) => {
            event.stopPropagation();
            row.remove();
            this.updateVariationLimits();
            this.updateAddVariationButton();
        });
        const qty = document.createElement('input');
        qty.type = 'number'; qty.className = 'variation-quantity'; qty.min = '0'; qty.step = '1'; qty.placeholder = 'Qty'; qty.setAttribute('aria-label', 'Variation quantity'); qty.value = typeof value === 'object' ? (value.quantity || 0) : 0; qty.style.width = '24px'; qty.style.minWidth = '24px'; qty.style.maxWidth = '24px'; qty.style.height = 'auto';
        qty.addEventListener('input', () => this.updateVariationLimits(qty));
        qty.addEventListener('change', () => {
            if (input.value.trim()) this.lockVariationRow(row);
        });
        const nameWrap = document.createElement('div'); nameWrap.className = 'variation-name-field';
        const qtyWrap = document.createElement('div'); qtyWrap.className = 'variation-qty-field';
        nameWrap.appendChild(input); qtyWrap.appendChild(qty);
        row.append(nameWrap, qtyWrap, remove); list.appendChild(row); resizeVariationInput(); this.updateVariationLimits(); this.updateAddVariationButton();
        if (typeof value === 'object' && value.name) this.lockVariationRow(row);
    },
    closeModal() {
        InventoryDOM.itemModal.classList.remove('show');
    }
};

window.InventoryCreate = InventoryCreate;
