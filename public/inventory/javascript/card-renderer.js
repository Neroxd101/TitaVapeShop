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
    if (item.qr_image_url && !images.includes(item.qr_image_url)) {
      images.push(item.qr_image_url); // include QR as part of the image set (unique)
    }
    const hasMultipleImages = images.length > 1;
    
    // Use thumbnails for card display (faster loading)
    const imagesHtml = images.length > 0 
      ? `
        <div class="card-images" data-current="0">
          <div class="card-images-track" style="width: ${images.length * 100}%">
          ${images.map(url => {
            const fallbacks = InventoryImage.getFallbackUrls(url, 800);
            const firstSrc = fallbacks[0];
            // Escape URL properly for onerror handler
            const escapedUrl = url.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            return `<img src="${firstSrc}" data-tried-index="0" data-original-url="${escapedUrl}" alt="${item.name}" loading="lazy" onerror="InventoryImage.handleImageError(this, '${escapedUrl}', 800)">`;
          }).join('')}
          </div>
          ${hasMultipleImages ? `
            <button class="card-images-arrow prev" onclick="InventoryCard.slideImage(event, '${item.id}', -1)">
              <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <button class="card-images-arrow next" onclick="InventoryCard.slideImage(event, '${item.id}', 1)">
              <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>
            <div class="card-images-nav">
              ${images.map((_, i) => `<span class="card-images-dot ${i === 0 ? 'active' : ''}" onclick="InventoryCard.goToImage(event, '${item.id}', ${i})"></span>`).join('')}
            </div>
            <span class="card-images-count">1/${images.length}</span>
          ` : ''}
        </div>
      `
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
          <div class="card-qr">
            ${item.qr_image_url 
              ? (() => {
                  const qrFallbacks = InventoryImage.getFallbackUrls(item.qr_image_url, 200);
                  const qrEscaped = item.qr_image_url.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                  return `<img src="${qrFallbacks[0]}" data-tried-index="0" data-original-url="${qrEscaped}" alt="QR" loading="lazy" onerror="InventoryImage.handleImageError(this, '${qrEscaped}', 200)">`;
                })()
              : `<svg viewBox="0 0 24 24"><path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13 2h-2v2h2v2h-4v-4h2v-2h-2v-2h4v4zm2-4v2h2v4h-2v2h-2v-4h2v-2h-2v-2h2z"/></svg>`
            }
          </div>
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
