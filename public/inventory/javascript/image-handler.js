// Image handling namespace
const InventoryImage = {
  // Parse images from item (can be JSON array or single URL)
  parseImages(item) {
    if (!item.images && !item.image_url) return [];
    
    if (item.images) {
      try {
        const parsed = typeof item.images === 'string' ? JSON.parse(item.images) : item.images;
        // Ensure it's an array
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('Error parsing images:', e, item.images);
        return [];
      }
    }
    
    // Fallback to single image_url
    return item.image_url ? [item.image_url] : [];
  },

  // Extract Google Drive file ID from URL
  getGoogleDriveFileId(url) {
    if (!url) return null;
    
    // Match patterns: 
    // https://drive.google.com/uc?id=FILE_ID
    // https://drive.google.com/file/d/FILE_ID/view
    // https://drive.google.com/thumbnail?id=FILE_ID
    const patterns = [
      /[?&]id=([a-zA-Z0-9_-]+)/,
      /\/d\/([a-zA-Z0-9_-]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  },

  // Get thumbnail URL for Google Drive image
  getThumbnailUrl(url, size = 400) {
    const fileId = this.getGoogleDriveFileId(url);
    if (fileId) {
      // Use Google Drive thumbnail API - most reliable for thumbnails
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
    }
    // Return original URL if not a Google Drive link
    return url;
  },

  // Get direct viewable URL for Google Drive image  
  getViewableUrl(url) {
    const fileId = this.getGoogleDriveFileId(url);
    if (fileId) {
      // Try thumbnail first as it's more reliable for display
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
    }
    return url;
  },

  // Get full size URL for Google Drive image
  getFullImageUrl(url) {
    const fileId = this.getGoogleDriveFileId(url);
    if (fileId) {
      return `https://drive.google.com/uc?id=${fileId}`;
    }
    return url;
  },

  // Render images grid in modal
  renderImagesGrid() {
    const grid = document.getElementById('imagesGrid');
    if (!grid) return;
    
    grid.innerHTML = InventoryState.currentImages.map((img, index) => {
      // Use thumbnail for existing images, preview for new uploads
      const imgSrc = img.url ? this.getThumbnailUrl(img.url, 200) : img.preview;
      return `
        <div class="image-item ${img.uploading ? 'uploading' : ''}" data-index="${index}">
          <img src="${imgSrc}" alt="Product image" loading="lazy">
          <button type="button" class="remove-image" onclick="InventoryImage.removeImage(${index})">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      `;
    }).join('');
  },

  // Update QR preview image in modal
  updateQrPreview(imageUrl) {
    const qrPreview = document.getElementById('qrPreview');
    if (!qrPreview) return;
    
    if (imageUrl) {
      qrPreview.innerHTML = `<img src="${this.getViewableUrl(imageUrl)}" alt="QR Code" loading="lazy">`;
    } else {
      qrPreview.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13 2h-2v2h2v2h-4v-4h2v-2h-2v-2h4v4zm2-4v2h2v4h-2v2h-2v-4h2v-2h-2v-2h2z"/></svg>`;
    }
  },

  // Handle image files selection
  async handleImagesSelect(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    // Check max images limit
    const remainingSlots = InventoryState.MAX_IMAGES - InventoryState.currentImages.length;
    if (remainingSlots <= 0) {
      alert(`Maximum ${InventoryState.MAX_IMAGES} images allowed`);
      return;
    }
    
    const filesToAdd = files.slice(0, remainingSlots);
    
    for (const file of filesToAdd) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select image files only');
        continue;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} is too large (max 5MB)`);
        continue;
      }
      
      // Create preview
      const preview = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
      
      InventoryState.currentImages.push({
        file,
        preview,
        url: null,
        uploading: false
      });
    }
    
    this.renderImagesGrid();
    e.target.value = ''; // Reset input
  },

  // Remove image from list
  removeImage(index) {
    InventoryState.currentImages.splice(index, 1);
    this.renderImagesGrid();
  },

  // Upload single image to Google Drive
  async uploadSingleImage(imageData, index, productName) {
    if (!InventoryGoogle.isConnected()) {
      throw new Error('Please connect your Google account first');
    }
    
    const googleToken = InventoryGoogle.getToken();
    if (!googleToken) {
      throw new Error('Google token not found');
    }
    
    // Mark as uploading
    InventoryState.currentImages[index].uploading = true;
    this.renderImagesGrid();
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Google-Token': googleToken,
        },
        body: JSON.stringify({
          image: imageData.preview,
          filename: `img-${index + 1}-${Date.now()}.${imageData.file.name.split('.').pop()}`,
          mimeType: imageData.file.type,
          productName: productName, // Upload to product folder
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }
      
      InventoryState.currentImages[index].url = result.imageUrl;
      InventoryState.currentImages[index].uploading = false;
      this.renderImagesGrid();
      
      return result.imageUrl;
    } catch (error) {
      InventoryState.currentImages[index].uploading = false;
      this.renderImagesGrid();
      throw error;
    }
  },

  // Upload all pending images to product folder
  async uploadPendingImages(productName) {
    const pendingImages = InventoryState.currentImages.filter((img) => img.file && !img.url);
    
    if (pendingImages.length === 0) return;
    
    const uploadingEl = document.getElementById('imageUploading');
    const hintEl = document.getElementById('imageHint');
    
    if (uploadingEl) uploadingEl.style.display = 'flex';
    if (hintEl) hintEl.style.display = 'none';
    
    try {
      for (let i = 0; i < InventoryState.currentImages.length; i++) {
        if (InventoryState.currentImages[i].file && !InventoryState.currentImages[i].url) {
          await this.uploadSingleImage(InventoryState.currentImages[i], i, productName);
        }
      }
    } finally {
      if (uploadingEl) uploadingEl.style.display = 'none';
      if (hintEl) hintEl.style.display = 'block';
    }
  },

  // Upload QR code to Google Drive (backend fetches from QRtag.net API)
  async uploadQrCode(productCode, productName) {
    if (!InventoryGoogle.isConnected()) {
      console.log('Google not connected, skipping QR upload');
      return null;
    }
    
    const googleToken = InventoryGoogle.getToken();
    if (!googleToken) {
      console.log('No Google token, skipping QR upload');
      return null;
    }
    
    try {
      console.log('Uploading QR for product code:', productCode);
      
      // Backend will fetch QR from QRtag.net and upload to Google Drive
      const response = await fetch('/api/upload/qrcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Google-Token': googleToken,
        },
        body: JSON.stringify({
          qrCode: productCode,
          productName: productName,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('QR upload failed:', result.error);
        return null;
      }
      
      return result.imageUrl;
    } catch (error) {
      console.error('QR upload error:', error);
      return null;
    }
  }
};
