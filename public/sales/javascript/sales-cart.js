// Logic for Sales Cart Management
const SalesCart = {
    async loadCartModal() {
        try {
            const existing = document.getElementById('cartModal');
            if (existing) return;

            const response = await fetch('/sales/sales-cart-modal.html');
            if (!response.ok) throw new Error(`Failed to load cart modal: ${response.statusText}`);
            const html = await response.text();

            const temp = document.createElement('div');
            temp.innerHTML = html.trim();
            const modalEl = temp.firstElementChild;
            const container = document.getElementById('modal-container') || document.body;
            if (modalEl) container.appendChild(modalEl);
        } catch (err) {
            console.error('Error loading cart modal:', err);
        }
    },

    async loadConfirmModal() {
        try {
            const existing = document.getElementById('confirmModal');
            if (existing) return;

            const response = await fetch('/sales/sales-confirm-modal.html');
            if (!response.ok) throw new Error(`Failed to load confirm modal: ${response.statusText}`);
            const html = await response.text();

            const temp = document.createElement('div');
            temp.innerHTML = html.trim();
            const modalEl = temp.firstElementChild;
            const container = document.getElementById('modal-container') || document.body;
            if (modalEl) container.appendChild(modalEl);
        } catch (err) {
            console.error('Error loading confirm modal:', err);
        }
    },

    async loadSuccessModal() {
        try {
            const existing = document.getElementById('successModal');
            if (existing) return;

            const response = await fetch('/sales/sales-success-modal.html');
            if (!response.ok) throw new Error(`Failed to load success modal: ${response.statusText}`);
            const html = await response.text();

            const temp = document.createElement('div');
            temp.innerHTML = html.trim();
            const modalEl = temp.firstElementChild;
            const container = document.getElementById('modal-container') || document.body;
            if (modalEl) container.appendChild(modalEl);
        } catch (err) {
            console.error('Error loading success modal:', err);
        }
    },

    addToCart(state, item, quantity) {
        if (!state || !item || quantity <= 0) return;

        const existing = state.cart.find(c => c.id === item.id);
        const maxQty = item.quantity || 0;
        const currentQty = existing ? existing.qty : 0;
        const newQty = Math.min(maxQty, currentQty + quantity);

        if (newQty <= 0 && currentQty === 0) return;

        const unitPrice = item.sale_price || item.cost_price || 0;

        if (existing) {
            existing.qty = newQty;
        } else {
            state.cart.push({
                id: item.id,
                name: item.name,
                price: unitPrice,
                qty: Math.min(quantity, maxQty)
            });
        }

        this.updateCartUI(state);
        SalesLoad.renderProducts(state);
    },

    updateCartUI(state) {
        if (!state) return;
        const emptyState = document.getElementById('cartEmptyState');
        const cartContainer = document.getElementById('cartContainer');

        if (!state.cart.length) {
            if (emptyState) emptyState.style.display = '';
            if (cartContainer) cartContainer.style.display = 'none';
            this.updateTotals(state);
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (cartContainer) cartContainer.style.display = '';

        const listEl = document.getElementById('cartItems');
        if (!listEl) return;

        listEl.innerHTML = '';

        state.cart.forEach(item => {
            const row = this.createCartRow(item, state);
            listEl.appendChild(row);
        });

        this.updateTotals(state);
    },

    createCartRow(item, state) {
        const row = document.createElement('div');
        row.className = 'cart-row';

        const main = document.createElement('div');
        main.className = 'cart-main';
        const name = document.createElement('div');
        name.className = 'cart-name';
        name.textContent = item.name || 'Unnamed';
        const price = document.createElement('div');
        price.className = 'cart-price';
        price.textContent = this.formatCurrencySafe(item.price);

        main.appendChild(name);
        main.appendChild(price);

        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.min = '1';
        qtyInput.step = '1';
        qtyInput.value = String(item.qty);
        qtyInput.className = 'cart-qty-input';
        qtyInput.addEventListener('input', () => {
            const value = Math.max(1, parseInt(qtyInput.value, 10) || 1);
            const product = state.products.find(p => p.id === item.id);
            const max = product ? product.quantity : 9999;
            item.qty = Math.min(value, max);
            qtyInput.value = item.qty;

            this.updateTotals(state);
            this.renderCartSubtotals(state);
            SalesLoad.renderProducts(state);
        });

        const subtotalEl = document.createElement('div');
        subtotalEl.className = 'cart-subtotal';
        subtotalEl.textContent = this.formatCurrencySafe(item.qty * item.price);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'cart-remove-btn';
        removeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" />
        </svg>
      `;
        removeBtn.addEventListener('click', () => {
            state.cart = state.cart.filter(c => c.id !== item.id);
            this.updateCartUI(state);
            SalesLoad.renderProducts(state);
        });

        row.appendChild(main);
        row.appendChild(qtyInput);
        row.appendChild(subtotalEl);
        row.appendChild(removeBtn);

        return row;
    },

    renderCartSubtotals(state) {
        const rows = document.querySelectorAll('.cart-row');
        rows.forEach((row, index) => {
            const item = state.cart[index];
            if (!item) return;
            const subtotalEl = row.querySelector('.cart-subtotal');
            if (subtotalEl) {
                subtotalEl.textContent = this.formatCurrencySafe(item.qty * item.price);
            }
        });
    },

    updateTotals(state) {
        const itemsCountEl = document.getElementById('cartItemsCount');
        const subtotalEl = document.getElementById('cartSubtotal');
        const totalEl = document.getElementById('cartTotal');

        const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
        const subtotal = state.cart.reduce((sum, item) => sum + item.qty * item.price, 0);

        if (itemsCountEl) itemsCountEl.textContent = String(totalItems);
        if (subtotalEl) subtotalEl.textContent = this.formatCurrencySafe(subtotal);
        if (totalEl) totalEl.textContent = this.formatCurrencySafe(subtotal);

        const badge = document.getElementById('cartBadge');
        if (badge) {
            badge.textContent = String(totalItems);
            if (totalItems > 0) badge.classList.add('has-items');
            else badge.classList.remove('has-items');
        }

        this.updateChangeDisplay(state);
    },

    updateChangeDisplay(state) {
        const cashInput = document.getElementById('cashInput');
        const changeEl = document.getElementById('changeDisplay');
        const total = state.cart.reduce((sum, item) => sum + item.qty * item.price, 0);

        if (!cashInput || !changeEl) return;

        const cash = parseFloat(cashInput.value || '0') || 0;
        const change = Math.max(0, cash - total);

        changeEl.textContent = this.formatCurrencySafe(change);
    },

    formatCurrencySafe(amount) {
        if (typeof InventoryUtils !== 'undefined') {
            return InventoryUtils.formatCurrency(amount);
        }
        return '₱' + Number(amount || 0).toFixed(2);
    }
};
