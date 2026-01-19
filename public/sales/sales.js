// Simple POS logic for the Sales page
(function () {
  const state = {
    products: [],
    filtered: [],
    cart: []
  };

  let qrScanner = null;
  let qrScanning = false;

  async function init() {
    // Ensure user is authenticated (reuses inventory utils)
    if (typeof InventoryUtils !== 'undefined') {
      InventoryUtils.checkAuth();
    }

    setupSidebar();
    await loadCartModal();
    wireEvents();
    loadProducts();
    updateCartUI();
  }

  async function loadCartModal() {
    try {
      const response = await fetch('/sales/sales-cart-modal.html');
      if (!response.ok) {
        throw new Error(`Failed to load cart modal: ${response.statusText}`);
      }
      const html = await response.text();

      // Inject at end of body
      const temp = document.createElement('div');
      temp.innerHTML = html.trim();
      const modalEl = temp.firstElementChild;
      if (modalEl) {
        document.body.appendChild(modalEl);
      }
    } catch (err) {
      console.error('Error loading cart modal:', err);
    }
  }

  function setupSidebar() {
    if (typeof initSidebar === 'function') {
      // Mark "Sales" as the active nav item
      initSidebar('sales');
    }
  }

  function wireEvents() {
    const searchInput = document.getElementById('productSearch');
    const categoryFilter = document.getElementById('productCategoryFilter');
    const cashInput = document.getElementById('cashInput');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const completeSaleBtn = document.getElementById('completeSaleBtn');
    const openCartModalBtn = document.getElementById('openCartModalBtn');
    const closeCartModalBtn = document.getElementById('closeCartModalBtn');
    const cartModal = document.getElementById('cartModal');
    const openQrModalBtn = document.getElementById('openQrModalBtn');
    const closeQrModalBtn = document.getElementById('closeQrModalBtn');
    const qrModal = document.getElementById('qrModal');

    if (searchInput) {
      searchInput.addEventListener('input', applyFilters);
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', applyFilters);
    }

    if (cashInput) {
      cashInput.addEventListener('input', updateChangeDisplay);
    }

    if (clearCartBtn) {
      clearCartBtn.addEventListener('click', () => {
        state.cart = [];
        updateCartUI();
      });
    }

    if (completeSaleBtn) {
      completeSaleBtn.addEventListener('click', handleCompleteSale);
    }

    if (openCartModalBtn && cartModal) {
      openCartModalBtn.addEventListener('click', () => {
        cartModal.classList.add('show');
        updateCartUI();
      });
    }

    if (closeCartModalBtn && cartModal) {
      closeCartModalBtn.addEventListener('click', () => {
        cartModal.classList.remove('show');
      });
    }

    if (cartModal) {
      cartModal.addEventListener('click', (e) => {
        if (e.target === cartModal) {
          cartModal.classList.remove('show');
        }
      });
    }

    if (openQrModalBtn && qrModal) {
      openQrModalBtn.addEventListener('click', () => {
        qrModal.classList.add('show');
        startQrScan();
      });
    }

    if (closeQrModalBtn && qrModal) {
      closeQrModalBtn.addEventListener('click', () => {
        qrModal.classList.remove('show');
        stopQrScan();
      });
    }

    if (qrModal) {
      qrModal.addEventListener('click', (e) => {
        if (e.target === qrModal) {
          qrModal.classList.remove('show');
          stopQrScan();
        }
      });
    }
  }

  async function startQrScan() {
    if (qrScanning) return;

    if (typeof Html5Qrcode === 'undefined') {
      alert('QR scanner library not loaded yet. Please try again in a moment.');
      return;
    }

    try {
      qrScanner = new Html5Qrcode('qrScanner');
      await qrScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          handleQrDecoded(decodedText);
        },
        () => {}
      );
      qrScanning = true;
    } catch (err) {
      console.error('Error starting QR scanner:', err);
      alert('Unable to access camera for QR scanning.');
      await stopQrScan();
    }
  }

  async function stopQrScan() {
    if (!qrScanner || !qrScanning) return;
    try {
      await qrScanner.stop();
      await qrScanner.clear();
    } catch (err) {
      console.error('Error stopping QR scanner:', err);
    } finally {
      qrScanner = null;
      qrScanning = false;
    }
  }

  function handleQrDecoded(decodedText) {
    if (!decodedText) return;

    // Stop scanning as soon as we read one code
    stopQrScan();

    const qrModal = document.getElementById('qrModal');
    if (qrModal) {
      qrModal.classList.remove('show');
    }

    const code = extractQrProductCode(decodedText);
    const product = findProductByQr(code);

    if (!product) {
      alert('No matching product found for this QR code.');
      return;
    }

    // Add one unit by default when scanning
    addToCart(product, 1);
    alert(`Added 1 "${product.name}" to the cart.`);
  }

  function normalizeQrText(value) {
    return String(value || '').trim();
  }

  function extractQrProductCode(decodedText) {
    const raw = normalizeQrText(decodedText);
    if (!raw) return '';

    // Normalize case for comparisons and regex.
    const upper = raw.toUpperCase();

    // If the QR contains our code directly, return it.
    if (upper.startsWith('TVS-')) return upper;

    // If the QR contains a URL (or looks URL-like), try extracting typical params.
    // Common cases: qrtag.net payload via ?url=..., our own app links, etc.
    try {
      const url = new URL(raw);
      const candidates = [
        url.searchParams.get('url'),
        url.searchParams.get('code'),
        url.searchParams.get('qr'),
        url.searchParams.get('product'),
        url.searchParams.get('productCode'),
      ].filter(Boolean);

      for (const c of candidates) {
        const v = String(c).trim().toUpperCase();
        if (v.startsWith('TVS-')) return v;
        const m = v.match(/TVS-[A-Z0-9]+-[A-Z0-9]+/);
        if (m) return m[0];
      }

      // Fall back to scanning the full URL string.
      const m = upper.match(/TVS-[A-Z0-9]+-[A-Z0-9]+/);
      if (m) return m[0];
    } catch (_) {
      // Not a valid URL; continue with plain string matching below.
    }

    // Final fallback: search for the code pattern inside the text.
    const match = upper.match(/TVS-[A-Z0-9]+-[A-Z0-9]+/);
    if (match) return match[0];

    return upper;
  }

  function findProductByQr(code) {
    const normalizedCode = normalizeQrText(code).toUpperCase();
    if (!normalizedCode) return null;

    // Try direct property matches first (if backend includes product_code or similar)
    let item = state.products.find(p =>
      String(p.product_code || '').toUpperCase() === normalizedCode ||
      String(p.code || '').toUpperCase() === normalizedCode ||
      String(p.qr_code || '').toUpperCase() === normalizedCode
    );
    if (item) return item;

    // Fallback: match our generated product code format TVS-SAFENAME-...
    const match = normalizedCode.match(/^TVS-([A-Z0-9]+)-/);
    if (match) {
      const safeName = match[1];
      item = state.products.find(p => {
        if (!p.name) return false;
        const normalized = p.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
        return normalized === safeName;
      });
    }

    return item || null;
  }

  async function loadProducts() {
    try {
      const response = await fetch('/inventory/load-items', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
        }
      });

      const result = await response.json();

      if (result.success) {
        state.products = (result.data || []).filter(p => !p.deleted);
      } else {
        console.error('Failed to load inventory for POS:', result.error);
        state.products = [];
      }
    } catch (err) {
      console.error('Error loading inventory for POS:', err);
      state.products = [];
    }

    applyFilters();
  }

  function applyFilters() {
    const q = (document.getElementById('productSearch')?.value || '').toLowerCase();
    const category = document.getElementById('productCategoryFilter')?.value || '';

    state.filtered = state.products.filter(item => {
      if (category && item.category !== category) return false;

      if (!q) return true;
      const haystack = `${item.name || ''} ${item.category || ''} ${item.description || ''}`.toLowerCase();
      return haystack.includes(q);
    });

    renderProducts();
  }

  function renderProducts() {
    const listEl = document.getElementById('productList');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (!state.filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'cart-empty';
      empty.textContent = 'No products found.';
      listEl.appendChild(empty);
      return;
    }

    state.filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'pos-card';

      // Image
      const imageWrap = document.createElement('div');
      imageWrap.className = 'pos-card-image';
      const img = document.createElement('img');

      // Use same image handling as inventory cards (with Drive fallbacks/proxy)
      let firstImage = '';
      if (typeof InventoryImage !== 'undefined') {
        const images = InventoryImage.parseImages(item);
        firstImage = images.length ? images[0] : '';
        if (firstImage) {
          const fallbacks = InventoryImage.getFallbackUrls(firstImage, 400);
          img.src = fallbacks[0];
          img.alt = item.name || 'Product image';
          img.dataset.triedIndex = '0';
          img.dataset.originalUrl = firstImage;
          img.onerror = function () {
            InventoryImage.handleImageError(this, this.dataset.originalUrl, 400);
          };
        } else {
          img.alt = 'No image';
        }
      } else {
        const rawFirst = Array.isArray(item.images) && item.images.length ? item.images[0] : '';
        if (rawFirst) {
          img.src = rawFirst;
          img.alt = item.name || 'Product image';
        } else {
          img.alt = 'No image';
        }
      }

      imageWrap.appendChild(img);

      const body = document.createElement('div');
      body.className = 'pos-card-body';

      // Header: category + stock
      const header = document.createElement('div');
      header.className = 'pos-card-header';

      const category = document.createElement('span');
      category.className = `pos-card-category ${item.category || ''}`.trim();
      category.textContent = item.category || 'Uncategorized';

      const stock = document.createElement('span');
      stock.className = 'pos-card-stock';
      const originalQty = item.quantity || 0;
      const cartItem = state.cart.find(c => c.id === item.id);
      const cartQty = cartItem ? cartItem.qty : 0;
      const availableQty = Math.max(0, originalQty - cartQty);
      stock.textContent = `Stock: ${availableQty}`;
      if (availableQty <= 0) {
        stock.classList.add('out');
      } else if (availableQty <= 3) {
        stock.classList.add('low');
      }

      header.appendChild(category);
      header.appendChild(stock);

      const nameEl = document.createElement('h3');
      nameEl.className = 'pos-card-name';
      nameEl.textContent = item.name || 'Unnamed';

      const priceRow = document.createElement('div');
      priceRow.className = 'pos-card-price-row';
      const priceLabel = document.createElement('span');
      priceLabel.className = 'pos-card-price-label';
      priceLabel.textContent = 'Price';
      const priceValue = document.createElement('span');
      priceValue.className = 'pos-card-price-value';
      const unitPrice = item.sale_price || item.cost_price || 0;
      priceValue.textContent = typeof InventoryUtils !== 'undefined'
        ? InventoryUtils.formatCurrency(unitPrice)
        : `₱${unitPrice.toFixed(2)}`;
      priceRow.appendChild(priceLabel);
      priceRow.appendChild(priceValue);

      const actions = document.createElement('div');
      actions.className = 'pos-card-actions';

      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.min = '1';
      qtyInput.step = '1';
      qtyInput.value = '1';
      qtyInput.className = 'product-qty-input';

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'product-add-btn';
      addBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
        </svg>
        <span>Add</span>
      `;

      if (availableQty <= 0) {
        addBtn.disabled = true;
      }

      addBtn.addEventListener('click', () => {
        const qtyToAdd = Math.max(1, parseInt(qtyInput.value, 10) || 1);
        addToCart(item, qtyToAdd);
      });

      actions.appendChild(qtyInput);
      actions.appendChild(addBtn);

      body.appendChild(header);
      body.appendChild(nameEl);
      body.appendChild(priceRow);
      body.appendChild(actions);

      card.appendChild(imageWrap);
      card.appendChild(body);

      listEl.appendChild(card);
    });
  }

  function addToCart(item, quantity) {
    if (quantity <= 0) return;

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

    updateCartUI();
  }

  function updateCartUI() {
    const emptyState = document.getElementById('cartEmptyState');
    const cartContainer = document.getElementById('cartContainer');

    if (!state.cart.length) {
      if (emptyState) emptyState.style.display = '';
      if (cartContainer) cartContainer.style.display = 'none';
      updateTotals();
      // Re-render product cards so stock resets to original quantities
      renderProducts();
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
        : `₱${item.price.toFixed(2)}`;
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
        updateTotals();
        renderCartSubtotals();
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
        updateCartUI();
      });

      row.appendChild(main);
      row.appendChild(qtyInput);
      row.appendChild(subtotalEl);
      row.appendChild(removeBtn);

      listEl.appendChild(row);
    });

    updateTotals();
    // Update product cards to reflect quantities reserved in cart
    renderProducts();
  }

  function renderCartSubtotals() {
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

  function updateTotals() {
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

    updateChangeDisplay();
  }

  function updateChangeDisplay() {
    const cashInput = document.getElementById('cashInput');
    const changeEl = document.getElementById('changeDisplay');
    const total = state.cart.reduce((sum, item) => sum + item.qty * item.price, 0);

    if (!cashInput || !changeEl) return;

    const cash = parseFloat(cashInput.value || '0') || 0;
    const change = Math.max(0, cash - total);

    changeEl.textContent = formatCurrencySafe(change);
  }

  function handleCompleteSale() {
    if (!state.cart.length) {
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
    // Later: wire this to a backend sales endpoint and inventory updates.
    alert(`Sale completed for ${customerName}.\nTotal: ${formatCurrencySafe(total)}`);

    state.cart = [];
    if (cashInput) cashInput.value = '';
    document.getElementById('customerName').value = '';
    updateCartUI();
  }

  function formatCurrencySafe(amount) {
    if (typeof InventoryUtils !== 'undefined') {
      return InventoryUtils.formatCurrency(amount);
    }
    return '₱' + Number(amount || 0).toFixed(2);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

