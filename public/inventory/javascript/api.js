// API calls namespace
const InventoryAPI = {
  // API Route: GET /inventory/load-items
  async loadInventory() {
    InventoryCard.showLoading(true);

    try {
      const response = await fetch('/inventory/load-items', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      const result = await response.json();

      if (result.success) {
        InventoryState.inventoryItems = result.data || [];
        InventoryCard.renderInventory();
      } else {
        console.error('Failed to load inventory:', result.error);
        InventoryState.inventoryItems = [];
        InventoryCard.renderInventory();
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      InventoryState.inventoryItems = [];
      InventoryCard.renderInventory();
    } finally {
      InventoryCard.showLoading(false);
    }
  },

  // API Route: POST /inventory/create-item | PUT /inventory/update-item
  async saveItem(e) {
    e.preventDefault();

    const saveBtn = document.getElementById('saveBtn');
    saveBtn.classList.add('loading');
    saveBtn.disabled = true;

    // Get API route from form attribute
    const form = e.target;
    const isEdit = !!InventoryState.editingItemId;
    const apiRoute = isEdit
      ? form.getAttribute('data-api-route-update') || '/inventory/update-item'
      : form.getAttribute('data-api-route-create') || '/inventory/create-item';
    const method = isEdit ? 'PUT' : 'POST';

    // Capture old item state for logging (if edit)
    let oldItem = null;
    if (isEdit) {
      oldItem = InventoryState.inventoryItems.find(i => i.id === InventoryState.editingItemId);
    }

    const productName = document.getElementById('itemName').value.trim();

    if (!productName) {
      alert('Product name is required');
      saveBtn.classList.remove('loading');
      saveBtn.disabled = false;
      return;
    }

    try {
      // Upload any pending images to product folder
      await InventoryImage.uploadPendingImages(productName);

      // Get all image URLs
      const imageUrls = InventoryState.currentImages
        .filter(img => img.url)
        .map(img => img.url);

      const descriptionValue = document.getElementById('itemDescription').value.trim();
      console.log('Description input value:', descriptionValue);

      const itemData = {
        category: document.getElementById('itemCategory').value,
        name: productName,
        description: descriptionValue || null,
        quantity: parseInt(document.getElementById('itemQuantity').value) || 0,
        cost_price: parseFloat(document.getElementById('itemCostPrice').value) || 0,
        sale_price: parseFloat(document.getElementById('itemSalePrice').value) || 0,
        images: imageUrls,
      };

      console.log('Sending itemData:', JSON.stringify(itemData, null, 2));

      if (isEdit) {
        itemData.id = InventoryState.editingItemId;
      }

      const response = await fetch(apiRoute, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify(itemData)
      });

      const result = await response.json();

      // Remove loading state
      saveBtn.classList.remove('loading');
      saveBtn.disabled = false;

      if (result.success) {
        InventoryModal.closeItemModal();

        // Log transaction
        if (window.TransactionLogger) {
          if (isEdit) {
            // Log Edit
            TransactionLogger.logInventoryEdit(itemData.id, oldItem, itemData);
          } else {
            // Log Add
            // Use result.item or result.data if available, otherwise fallback to itemData
            // Note: result.data usually contains the inserted row from supabase
            const newItem = result.data || result.item || itemData;
            TransactionLogger.logInventoryAdd(newItem);
          }
        }

        this.loadInventory();
      } else {
        alert(result.error || 'Failed to save item');
      }
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item: ' + error.message);
      saveBtn.classList.remove('loading');
      saveBtn.disabled = false;
    }
  },

  // API Route: DELETE /inventory/delete-item/:id
  async confirmDelete() {
    if (!InventoryState.deletingItemId) return;

    const deleteBtn = document.getElementById('confirmDeleteBtn');
    deleteBtn.classList.add('loading');
    deleteBtn.disabled = true;

    // Get item details for logging before deletion
    const deletingItem = InventoryState.inventoryItems.find(i => i.id === InventoryState.deletingItemId);

    // Get API route from modal actions container data attribute
    const modalActions = InventoryDOM.deleteModal?.querySelector('.modal-actions');
    const apiRoute = modalActions?.getAttribute('data-api-route') || '/inventory/delete-item';
    const deleteUrl = `${apiRoute}/${InventoryState.deletingItemId}`;

    try {
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      const result = await response.json();

      if (result.success) {
        InventoryModal.closeDeleteModal();

        // Log transaction
        if (window.TransactionLogger && deletingItem) {
          TransactionLogger.logInventoryDelete(deletingItem);
        }

        this.loadInventory();
      } else {
        alert(result.error || 'Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    } finally {
      deleteBtn.classList.remove('loading');
      deleteBtn.disabled = false;
    }
  },

  // Generate QR code on demand and update item
  async generateQrForItem(itemId) {
    const item = InventoryState.inventoryItems.find(i => i.id === itemId);
    if (!item) {
      alert('Item not found');
      return;
    }

    try {
      const btn = document.getElementById('viewGenerateQrBtn');
      if (btn) {
        btn.classList.add('loading');
        btn.disabled = true;
      }

      const googleToken = InventoryGoogle.getToken();
      if (!InventoryGoogle.isConnected() || !googleToken) {
        alert('Please connect your Google account first');
        return;
      }

      const productCode = InventoryModal.generateProductCode(item.name);
      const qrImageUrl = await InventoryImage.uploadQrCode(productCode, item.name);
      if (!qrImageUrl) {
        alert('Failed to generate QR code');
        return;
      }

      // Update item with qr_image_url (send full payload expected by backend)
      const images = InventoryImage.parseImages(item);
      const updatePayload = {
        id: itemId,
        category: item.category,
        name: item.name,
        description: item.description ?? null,
        quantity: Number(item.quantity) || 0,
        cost_price: Number(item.cost_price) || 0,
        sale_price: Number(item.sale_price) || 0,
        images,
        qr_image_url: qrImageUrl,
      };

      const response = await fetch('/inventory/update-item', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify(updatePayload)
      });

      const result = await response.json();
      if (result.success) {
        // Refresh inventory and view modal
        await this.loadInventory();
        if (InventoryState.viewingItemId === itemId) {
          InventoryModal.viewItem(itemId);
        }
      } else {
        alert(result.error || 'Failed to update item with QR code');
      }
    } catch (error) {
      console.error('Error generating QR:', error);
      alert('Failed to generate QR code: ' + error.message);
    } finally {
      const btn = document.getElementById('viewGenerateQrBtn');
      if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
      }
    }
  }
};
