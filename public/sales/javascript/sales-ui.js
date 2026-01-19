// UI helpers for Sales (POS) product list/cards
// Exposed globally as SalesUI (no module bundler required).

(function () {
  function renderProducts(state) {
    if (!state) return;
    const listEl = document.getElementById('productList');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (!state.filtered || !state.filtered.length) {
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
      // Prefer a normal product image; only fall back to QR if nothing else exists.
      let firstImage = '';
      if (typeof InventoryImage !== 'undefined') {
        const images = InventoryImage.parseImages(item);
        const nonQrImages = images.filter(url => url && url !== item.qr_image_url);
        firstImage = nonQrImages.length ? nonQrImages[0] : (images.length ? images[0] : '');
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
        if (window.SalesCart && SalesCart.addToCart) {
          // Pass a render callback that re-renders using this helper
          SalesCart.addToCart(state, item, qtyToAdd, () => renderProducts(state));
        }
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

  window.SalesUI = { renderProducts };
})();

