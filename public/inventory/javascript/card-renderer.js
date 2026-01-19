// Card rendering namespace
const InventoryCard = {
  // Render inventory cards
  renderInventory() {
    const filtered = this.filterItems();
    
    if (filtered.length === 0) {
      InventoryDOM.inventoryGrid.innerHTML = '';
      InventoryDOM.emptyState.style.display = 'block';
      return;
    }
    
    InventoryDOM.emptyState.style.display = 'none';
    InventoryDOM.inventoryGrid.innerHTML = filtered.map(item => this.createCard(item)).join('');
  },

  // Filter items based on category and search
  filterItems() {
    return InventoryState.inventoryItems.filter(item => {
      const matchesCategory = InventoryState.currentFilter === 'all' || item.category === InventoryState.currentFilter;
      const matchesSearch = item.name.toLowerCase().includes(InventoryState.searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  },

  // Create inventory card HTML
  createCard(item) {
    const isLowStock = item.quantity <= 5;
    const images = InventoryImage.parseImages(item);
    // Prefer a normal product image on the card; only fall back to QR if nothing else exists.
    const nonQrImages = images.filter(url => url && url !== item.qr_image_url);
    const firstImage = nonQrImages.length > 0
      ? nonQrImages[0]
      : (images.length > 0 ? images[0] : null);
    
    // Show only the first image (no slider/buttons)
    const imagesHtml = firstImage
      ? (() => {
          const fallbacks = InventoryImage.getFallbackUrls(firstImage, 800);
          const firstSrc = fallbacks[0];
          const escapedUrl = firstImage.replace(/'/g, "\\'").replace(/"/g, '&quot;');
          return `
            <div class="card-images single">
              <img src="${firstSrc}" data-tried-index="0" data-original-url="${escapedUrl}" alt="${item.name}" loading="lazy" onerror="InventoryImage.handleImageError(this, '${escapedUrl}', 800)">
            </div>
          `;
        })()
      : `
        <div class="card-images">
          <div class="card-images-placeholder">
            <svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
          </div>
        </div>
      `;
    
    return `
      <div class="inventory-card" data-id="${item.id}" onclick="InventoryModal.viewItem('${item.id}')">
        ${imagesHtml}
        
        <div class="card-header">
          <span class="card-category ${item.category}">${item.category}</span>
        </div>
        
        <h3 class="card-name">${item.name}</h3>
        
        <div class="card-details">
          <div class="detail-item">
            <span class="detail-label">Quantity</span>
            <span class="detail-value ${isLowStock ? 'low-stock' : ''}">${item.quantity} ${isLowStock ? '(Low)' : ''}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Cost Price</span>
            <span class="detail-value">${InventoryUtils.formatCurrency(item.cost_price)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Sale Price</span>
            <span class="detail-value price">${InventoryUtils.formatCurrency(item.sale_price)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Profit</span>
            <span class="detail-value price">${InventoryUtils.formatCurrency(item.sale_price - item.cost_price)}</span>
          </div>
        </div>
        
        <div class="card-dates">
          <div class="date-item">
            <span class="date-label">Added</span>
            <span class="date-value">${InventoryUtils.formatDate(item.created_at)}</span>
          </div>
          <div class="date-item">
            <span class="date-label">Updated</span>
            <span class="date-value">${InventoryUtils.formatDate(item.updated_at)}</span>
          </div>
        </div>
        
        <div class="card-actions">
          <button class="btn-card btn-edit" onclick="event.stopPropagation(); InventoryModal.editItem('${item.id}')">
            <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            Edit
          </button>
          <button class="btn-card btn-delete" onclick="event.stopPropagation(); InventoryModal.deleteItem('${item.id}', '${item.name.replace(/'/g, "\\'")}')">
            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            Delete
          </button>
        </div>
      </div>
    `;
  },

  // Image carousel functions
  slideImage(event, itemId, direction) {
    event.stopPropagation();
    const card = document.querySelector(`.inventory-card[data-id="${itemId}"]`);
    const container = card.querySelector('.card-images');
    const track = container.querySelector('.card-images-track');
    const dots = container.querySelectorAll('.card-images-dot');
    const countEl = container.querySelector('.card-images-count');
    const totalImages = dots.length;
    
    let current = parseInt(container.dataset.current) || 0;
    current += direction;
    
    if (current < 0) current = totalImages - 1;
    if (current >= totalImages) current = 0;
    
    container.dataset.current = current;
    track.style.transform = `translateX(-${current * 100}%)`;
    
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
    if (countEl) countEl.textContent = `${current + 1}/${totalImages}`;
  },

  goToImage(event, itemId, index) {
    event.stopPropagation();
    const card = document.querySelector(`.inventory-card[data-id="${itemId}"]`);
    const container = card.querySelector('.card-images');
    const track = container.querySelector('.card-images-track');
    const dots = container.querySelectorAll('.card-images-dot');
    const countEl = container.querySelector('.card-images-count');
    const totalImages = dots.length;
    
    container.dataset.current = index;
    track.style.transform = `translateX(-${index * 100}%)`;
    
    dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    if (countEl) countEl.textContent = `${index + 1}/${totalImages}`;
  },

  // Show/hide loading state
  showLoading(show) {
    InventoryDOM.loadingState.style.display = show ? 'block' : 'none';
    InventoryDOM.inventoryGrid.style.display = show ? 'none' : 'grid';
  }
};
