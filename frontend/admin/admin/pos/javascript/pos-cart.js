// Logic for Sales Cart Management
const SalesCart = {
    async loadCartModal() {
        try {
            const existing = document.getElementById('cartModal');
            if (existing) return;

            const response = await fetch('/admin/admin/pos/pos-cart-modal.html');
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

            const response = await fetch('/admin/admin/pos/pos-confirm-modal.html');
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

            const response = await fetch('/admin/admin/pos/pos-success-modal.html');
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
        SalesLoad.updateProductCardStock(state, item.id);
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

        const product = state.products.find(p => p.id === item.id);
        const max = product ? (product.quantity || 1) : 9999;

        const qtyWrapper = document.createElement('div');
        qtyWrapper.className = 'cart-qty-stepper';

        const decBtn = document.createElement('button');
        decBtn.type = 'button';
        decBtn.className = 'cart-qty-step-btn dec-btn';
        decBtn.setAttribute('aria-label', 'Decrease quantity');
        decBtn.innerHTML = '−';
        decBtn.disabled = item.qty <= 1;

        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.min = '1';
        qtyInput.max = String(max);
        qtyInput.step = '1';
        qtyInput.value = String(item.qty);
        qtyInput.className = 'cart-qty-input';
        qtyInput.setAttribute('aria-label', `Quantity for ${item.name || 'product'}`);

        const incBtn = document.createElement('button');
        incBtn.type = 'button';
        incBtn.className = 'cart-qty-step-btn inc-btn';
        incBtn.setAttribute('aria-label', 'Increase quantity');
        incBtn.innerHTML = '+';
        incBtn.disabled = item.qty >= max;

        const updateItemQty = (newVal) => {
            item.qty = Math.min(Math.max(1, newVal), max);
            qtyInput.value = item.qty;
            decBtn.disabled = item.qty <= 1;
            incBtn.disabled = item.qty >= max;

            this.updateTotals(state);
            this.renderCartSubtotals(state);
            SalesLoad.updateProductCardStock(state, item.id);
        };

        decBtn.addEventListener('click', () => {
            if (item.qty > 1) {
                updateItemQty(item.qty - 1);
            }
        });

        incBtn.addEventListener('click', () => {
            if (item.qty < max) {
                updateItemQty(item.qty + 1);
            }
        });

        qtyInput.addEventListener('input', () => {
            const parsed = parseInt(qtyInput.value, 10);
            if (!isNaN(parsed)) {
                updateItemQty(parsed);
            }
        });

        qtyInput.addEventListener('change', () => {
            const parsed = parseInt(qtyInput.value, 10);
            updateItemQty(isNaN(parsed) ? 1 : parsed);
        });

        qtyWrapper.appendChild(decBtn);
        qtyWrapper.appendChild(qtyInput);
        qtyWrapper.appendChild(incBtn);

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
            const removedId = item.id;
            state.cart = state.cart.filter(c => c.id !== item.id);
            this.updateCartUI(state);
            SalesLoad.updateProductCardStock(state, removedId);
        });

        row.appendChild(main);
        row.appendChild(qtyWrapper);
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
            if (totalItems > 0) {
                badge.classList.add('has-items');
                badge.classList.remove('badge-pop');
                void badge.offsetWidth;
                badge.classList.add('badge-pop');
            } else {
                badge.classList.remove('has-items');
            }
        }

        this.updateChangeDisplay(state);
    },

    showFloatingBadge(targetEl, text = '+1') {
        if (!targetEl) return;
        const rect = targetEl.getBoundingClientRect();
        const badge = document.createElement('span');
        badge.className = 'cart-floating-plus';
        badge.textContent = text;
        badge.style.left = `${rect.left + rect.width / 2}px`;
        badge.style.top = `${rect.top}px`;
        document.body.appendChild(badge);
        setTimeout(() => {
            badge.remove();
        }, 900);
    },

    handleQuickCash(btn, state) {
        const cashInput = document.getElementById('cashInput');
        if (!cashInput || !state) return;

        const action = btn.dataset.action;
        const amount = btn.dataset.amount;
        const total = state.cart.reduce((sum, item) => sum + item.qty * item.price, 0);

        if (action === 'exact') {
            cashInput.value = total > 0 ? total.toFixed(2) : '0';
        } else if (amount) {
            const val = parseFloat(amount);
            cashInput.value = isNaN(val) ? '0' : val.toFixed(2);
        }

        // Add pop animation effect to chip
        btn.classList.add('chip-active');
        setTimeout(() => btn.classList.remove('chip-active'), 200);

        this.updateChangeDisplay(state);
        cashInput.focus();
    },

    updateChangeDisplay(state) {
        const cashInput = document.getElementById('cashInput');
        const changeEl = document.getElementById('changeDisplay');
        const hintEl = document.getElementById('cashShortfallHint');
        const completeBtn = document.getElementById('completeSaleBtn');
        const total = state.cart.reduce((sum, item) => sum + item.qty * item.price, 0);

        if (!cashInput || !changeEl) return;

        const rawVal = cashInput.value.trim();
        if (rawVal === '') {
            changeEl.textContent = '₱0.00';
            changeEl.classList.remove('change-positive', 'change-negative');
            if (hintEl) hintEl.textContent = '';
            return;
        }

        const cash = parseFloat(rawVal) || 0;
        const diff = cash - total;

        if (total === 0) {
            changeEl.textContent = '₱0.00';
            changeEl.classList.remove('change-positive', 'change-negative');
            if (hintEl) hintEl.textContent = '';
        } else if (diff >= 0) {
            changeEl.textContent = this.formatCurrencySafe(diff);
            changeEl.classList.add('change-positive');
            changeEl.classList.remove('change-negative');
            if (hintEl) {
                hintEl.textContent = '✓ Sufficient';
                hintEl.className = 'cash-hint hint-sufficient';
            }
        } else {
            const shortfall = Math.abs(diff);
            changeEl.textContent = '₱0.00';
            changeEl.classList.add('change-negative');
            changeEl.classList.remove('change-positive');
            if (hintEl) {
                hintEl.textContent = `Short by ${this.formatCurrencySafe(shortfall)}`;
                hintEl.className = 'cash-hint hint-shortfall';
            }
        }
    },

    formatCurrencySafe(amount) {
        if (typeof InventoryUtils !== 'undefined') {
            return InventoryUtils.formatCurrency(amount);
        }
        return '₱' + Number(amount || 0).toFixed(2);
    }
};
