// Modal handling namespace
const InventoryModal = {
  /**
   * Load add/edit modal HTML component
   * @returns {Promise<void>}
   */
  async loadItemModal() {
    const container = document.getElementById('item-modal-container');
    if (!container) {
      console.error('Item modal container not found');
      return;
    }

    try {
      const response = await fetch('/inventory/inventory-add-edit-modal.html');
      if (!response.ok) {
        throw new Error(`Failed to load modal: ${response.statusText}`);
      }
      const html = await response.text();
      container.innerHTML = html;
      
      // Update modal references after loading
      InventoryDOM.itemModal = document.getElementById('itemModal');
      InventoryDOM.itemForm = document.getElementById('itemForm');
    } catch (error) {
      console.error('Error loading item modal:', error);
      container.innerHTML = '<div class="error">Failed to load modal</div>';
    }
  },

  /**
   * Load view modal HTML component
   * @returns {Promise<void>}
   */
  async loadViewModal() {
    const container = document.getElementById('view-modal-container');
    if (!container) {
      console.error('View modal container not found');
      return;
    }

    try {
      const response = await fetch('/inventory/inventory-view-modal.html');
      if (!response.ok) {
        throw new Error(`Failed to load view modal: ${response.statusText}`);
      }
      const html = await response.text();
      container.innerHTML = html;
      
      // Update modal reference after loading
      InventoryDOM.viewModal = document.getElementById('viewModal');
    } catch (error) {
      console.error('Error loading view modal:', error);
      container.innerHTML = '<div class="error">Failed to load view modal</div>';
    }
  },

  /**
   * Load delete confirmation modal HTML component
   * @returns {Promise<void>}
   */
  async loadDeleteModal() {
    const container = document.getElementById('delete-modal-container');
    if (!container) {
      console.error('Delete modal container not found');
      return;
    }

    try {
      const response = await fetch('/inventory/inventory-delete-modal.html');
      if (!response.ok) {
        throw new Error(`Failed to load delete modal: ${response.statusText}`);
      }
      const html = await response.text();
      container.innerHTML = html;
      
      // Update modal reference after loading
      InventoryDOM.deleteModal = document.getElementById('deleteModal');
    } catch (error) {
      console.error('Error loading delete modal:', error);
      container.innerHTML = '<div class="error">Failed to load delete modal</div>';
    }
  },

  // Generate unique product code
  generateProductCode(productName) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    const safeName = productName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
    return `TVS-${safeName}-${timestamp}${random}`.toUpperCase();
  },

  // Open modal for adding new item
  openAddModal() {
    InventoryState.editingItemId = null;
    InventoryState.currentImages = [];
    
    document.getElementById('modalTitle').textContent = 'Add New Item';
    document.getElementById('saveBtn').querySelector('.btn-text').textContent = 'Save Item';
    InventoryDOM.itemForm.reset();
    
    // Set form method and action for new items
    InventoryDOM.itemForm.method = 'POST';
    InventoryDOM.itemForm.action = InventoryDOM.itemForm.getAttribute('data-api-route-create') || '/inventory/create-item';
    
    InventoryImage.renderImagesGrid();
    
    // Hide QR code section for new items
    document.getElementById('qrGroup').style.display = 'none';
    
    InventoryDOM.itemModal.classList.add('show');
  },

  // Open modal for editing item
  editItem(id) {
    const item = InventoryState.inventoryItems.find(i => i.id === id);
    if (!item) return;
    
    InventoryState.editingItemId = id;
    
    // Load existing images
    const images = InventoryImage.parseImages(item);
    InventoryState.currentImages = images.map(url => ({ url, file: null, uploading: false }));
    
    document.getElementById('modalTitle').textContent = 'Edit Item';
    document.getElementById('saveBtn').querySelector('.btn-text').textContent = 'Update Item';
    
    // Set form method and action for editing
    InventoryDOM.itemForm.method = 'PUT';
    InventoryDOM.itemForm.action = InventoryDOM.itemForm.getAttribute('data-api-route-update') || '/inventory/update-item';
    
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemCategory').value = item.category;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemDescription').value = item.description || '';
    document.getElementById('itemQuantity').value = item.quantity;
    document.getElementById('itemCostPrice').value = item.cost_price;
    document.getElementById('itemSalePrice').value = item.sale_price;
    
    InventoryImage.renderImagesGrid();
    
    // Show QR code for existing items
    if (item.qr_image_url) {
      document.getElementById('qrGroup').style.display = 'block';
      InventoryImage.updateQrPreview(item.qr_image_url);
    } else {
      document.getElementById('qrGroup').style.display = 'none';
    }
    
    InventoryDOM.itemModal.classList.add('show');
  },

  // Close item modal
  closeItemModal() {
    InventoryDOM.itemModal.classList.remove('show');
    InventoryState.editingItemId = null;
    InventoryState.currentImages = [];
  },

  // Open view modal
  viewItem(id) {
    const item = InventoryState.inventoryItems.find(i => i.id === id);
    if (!item) return;
    
    InventoryState.viewingItemId = id;
    const images = InventoryImage.parseImages(item);
    if (item.qr_image_url && !images.includes(item.qr_image_url)) {
      images.push(item.qr_image_url); // include QR in gallery (unique)
    }
    const isLowStock = item.quantity <= 5;
    
    // Set main image
    const mainImageEl = document.getElementById('viewMainImage');
    if (images.length > 0) {
      const imgUrl = images[0];
      const fallbacks = InventoryImage.getFallbackUrls(imgUrl, 800);
      const escapedUrl = imgUrl.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      mainImageEl.innerHTML = `<img src="${fallbacks[0]}" data-tried-index="0" data-original-url="${escapedUrl}" alt="${item.name}" onerror="InventoryImage.handleImageError(this, '${escapedUrl}', 800)">`;
      mainImageEl.classList.remove('no-image');
    } else {
      mainImageEl.innerHTML = '';
      mainImageEl.classList.add('no-image');
    }
    
    // Set thumbnails
    const thumbnailsEl = document.getElementById('viewThumbnails');
    if (images.length > 1) {
      thumbnailsEl.innerHTML = images.map((url, index) => {
        const fallbacks = InventoryImage.getFallbackUrls(url, 100);
        const escapedUrl = url.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `
          <div class="view-thumbnail ${index === 0 ? 'active' : ''}" onclick="InventoryModal.setViewMainImage('${escapedUrl}', ${index})">
            <img src="${fallbacks[0]}" data-tried-index="0" data-original-url="${escapedUrl}" alt="Thumbnail ${index + 1}" onerror="InventoryImage.handleImageError(this, '${escapedUrl}', 100)">
          </div>
        `;
      }).join('');
    } else {
      thumbnailsEl.innerHTML = '';
    }
    
    // QR block removed from view modal; skip if not present
    
    // Set category
    const categoryEl = document.getElementById('viewCategory');
    categoryEl.textContent = item.category;
    categoryEl.className = `view-category ${item.category}`;
    
    // Set name and description
    document.getElementById('viewName').textContent = item.name;
    document.getElementById('viewDescription').textContent = item.description || '';
    
    // Set stats
    const quantityEl = document.getElementById('viewQuantity');
    quantityEl.textContent = item.quantity;
    quantityEl.className = `stat-value ${isLowStock ? 'low-stock' : ''}`;
    
    document.getElementById('viewCostPrice').textContent = InventoryUtils.formatCurrency(item.cost_price);
    document.getElementById('viewSalePrice').textContent = InventoryUtils.formatCurrency(item.sale_price);
    document.getElementById('viewProfit').textContent = InventoryUtils.formatCurrency(item.sale_price - item.cost_price);
    
    // Set dates
    document.getElementById('viewCreatedAt').textContent = InventoryUtils.formatDate(item.created_at);
    document.getElementById('viewUpdatedAt').textContent = InventoryUtils.formatDate(item.updated_at);

    // Show/hide Generate QR button depending on whether QR already exists
    const generateQrBtn = document.getElementById('viewGenerateQrBtn');
    if (generateQrBtn) {
      if (item.qr_image_url) {
        generateQrBtn.style.display = 'none';
      } else {
        generateQrBtn.style.display = '';
      }
    }

    InventoryDOM.viewModal.classList.add('show');
  },

  // Set main image in view modal
  setViewMainImage(url, activeIndex) {
    const mainImageEl = document.getElementById('viewMainImage');
    const item = InventoryState.inventoryItems.find(i => i.id === InventoryState.viewingItemId);
    
    const fallbacks = InventoryImage.getFallbackUrls(url, 800);
    const escapedUrl = url.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    mainImageEl.innerHTML = `<img src="${fallbacks[0]}" data-tried-index="0" data-original-url="${escapedUrl}" alt="${item?.name || 'Product'}" onerror="InventoryImage.handleImageError(this, '${escapedUrl}', 800)">`;
    
    // Update active thumbnail
    const thumbnails = document.querySelectorAll('.view-thumbnail');
    thumbnails.forEach((thumb, index) => {
      thumb.classList.toggle('active', index === activeIndex);
    });
  },

  // Close view modal
  closeViewModal(clearId = true) {
    InventoryDOM.viewModal.classList.remove('show');
    if (clearId) {
      InventoryState.viewingItemId = null;
    }
  },

  // Open delete confirmation
  deleteItem(id, name) {
    InventoryState.deletingItemId = id;
    document.getElementById('deleteItemName').textContent = name;
    InventoryDOM.deleteModal.classList.add('show');
  },

  // Close delete modal
  closeDeleteModal() {
    InventoryDOM.deleteModal.classList.remove('show');
    InventoryState.deletingItemId = null;
  }
};
