// Cart helper utilities for Sales (POS)
// Exposed globally as SalesCart (no module bundler required).

(function () {
  function addToCart(state, item, quantity, renderProducts) {
    if (!state || !item || quantity <= 0) return;

    const existing = state.cart.find(c => c.id === item.id);
    const maxQty = item.quantity || 0;
    const currentQty = existing ? existing.qty : 0;
    const newQty = Math.min(maxQty, currentQty + quantity);

    if (newQty <= 0) return;

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

    updateCartUI(state, renderProducts);
  }

  function updateCartUI(state, renderProducts) {
    if (!state) return;
    const emptyState = document.getElementById('cartEmptyState');
    const cartContainer = document.getElementById('cartContainer');

    if (!state.cart.length) {
      if (emptyState) emptyState.style.display = '';
      if (cartContainer) cartContainer.style.display = 'none';
      updateTotals(state);
      if (typeof renderProducts === 'function') {
        renderProducts();
      }
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (cartContainer) cartContainer.style.display = '';

    const listEl = document.getElementById('cartItems');
    if (!listEl) return;

    listEl.innerHTML = '';

    state.cart.forEach(item => {
      const row = document.createElement('div');
      row.className = 'cart-row';

      const main = document.createElement('div');
      main.className = 'cart-main';
      const name = document.createElement('div');
      name.className = 'cart-name';
      name.textContent = item.name || 'Unnamed';
      const price = document.createElement('div');
      price.className = 'cart-price';
      price.textContent = typeof InventoryUtils !== 'undefined'
        ? InventoryUtils.formatCurrency(item.price)
        : formatCurrencySafe(item.price);
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
        item.qty = value;
        updateTotals(state);
        renderCartSubtotals(state);
      });

      const subtotalEl = document.createElement('div');
      subtotalEl.className = 'cart-subtotal';
      subtotalEl.textContent = formatCurrencySafe(item.qty * item.price);

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
        updateCartUI(state, renderProducts);
      });

      row.appendChild(main);
      row.appendChild(qtyInput);
      row.appendChild(subtotalEl);
      row.appendChild(removeBtn);

      listEl.appendChild(row);
    });

    updateTotals(state);
    if (typeof renderProducts === 'function') {
      renderProducts();
    }
  }

  function renderCartSubtotals(state) {
    const rows = document.querySelectorAll('.cart-row');
    rows.forEach((row, index) => {
      const item = state.cart[index];
      if (!item) return;
      const subtotalEl = row.querySelector('.cart-subtotal');
      if (subtotalEl) {
        subtotalEl.textContent = formatCurrencySafe(item.qty * item.price);
      }
    });
  }

  function updateTotals(state) {
    const itemsCountEl = document.getElementById('cartItemsCount');
    const subtotalEl = document.getElementById('cartSubtotal');
    const totalEl = document.getElementById('cartTotal');

    const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = state.cart.reduce((sum, item) => sum + item.qty * item.price, 0);

    if (itemsCountEl) itemsCountEl.textContent = String(totalItems);
    if (subtotalEl) subtotalEl.textContent = formatCurrencySafe(subtotal);
    if (totalEl) totalEl.textContent = formatCurrencySafe(subtotal);

    // Update header checkout button badge
    const badge = document.getElementById('cartBadge');
    if (badge) {
      badge.textContent = String(totalItems);
      if (totalItems > 0) {
        badge.classList.add('has-items');
      } else {
        badge.classList.remove('has-items');
      }
    }

    updateChangeDisplay(state);
  }

  function updateChangeDisplay(state) {
    const cashInput = document.getElementById('cashInput');
    const changeEl = document.getElementById('changeDisplay');
    const total = state.cart.reduce((sum, item) => sum + item.qty * item.price, 0);

    if (!cashInput || !changeEl) return;

    const cash = parseFloat(cashInput.value || '0') || 0;
    const change = Math.max(0, cash - total);

    changeEl.textContent = formatCurrencySafe(change);
  }

  function handleCompleteSale(state, renderProducts) {
    if (!state || !state.cart.length) {
      alert('Add items to the cart first.');
      return;
    }

    const total = state.cart.reduce((sum, item) => sum + item.qty * item.price, 0);
    const cashInput = document.getElementById('cashInput');
    const cash = parseFloat(cashInput?.value || '0') || 0;

    if (cash < total) {
      alert('Cash is not enough to complete the sale.');
      return;
    }

    const customerName = document.getElementById('customerName')?.value || 'Walk-in';

    // For now, just show a confirmation and reset.
    alert(`Sale completed for ${customerName}.\nTotal: ${formatCurrencySafe(total)}`);

    state.cart = [];
    if (cashInput) cashInput.value = '';
    const nameInput = document.getElementById('customerName');
    if (nameInput) nameInput.value = '';
    updateCartUI(state, renderProducts);
  }

  function formatCurrencySafe(amount) {
    if (typeof InventoryUtils !== 'undefined') {
      return InventoryUtils.formatCurrency(amount);
    }
    return '₱' + Number(amount || 0).toFixed(2);
  }

  // Global export
  window.SalesCart = {
    addToCart,
    updateCartUI,
    renderCartSubtotals,
    updateTotals,
    updateChangeDisplay,
    handleCompleteSale,
    formatCurrencySafe,
  };
})();

