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

  /**
   * Return a list of fallback URLs for a Drive (or other) image.
   * Strategy: authenticated proxy (most reliable) -> uc?export=view -> thumbnail -> preview -> original
   */
  getFallbackUrls(url, size = 800) {
    const fileId = this.getGoogleDriveFileId(url);
    if (!fileId) return [url];

    return [
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`, // Primary (High res thumbnail)
      `https://drive.google.com/uc?export=view&id=${fileId}`,         // Fallback 1
      url                                                             // Fallback 2
    ];
  },

  /**
   * Handle <img> onerror to try next fallback source or show a placeholder.
   * Usage: onerror="InventoryImage.handleImageError(this, 'originalUrl')"
   */
  handleImageError(imgEl, originalUrl, size = 800) {
    const fallbacks = this.getFallbackUrls(originalUrl, size);
    const triedIndex = Number(imgEl.dataset.triedIndex || 0);
    const nextIndex = triedIndex + 1;

    if (nextIndex < fallbacks.length) {
      imgEl.dataset.triedIndex = nextIndex;
      imgEl.src = fallbacks[nextIndex];
      return;
    }

    // No more fallbacks — show a simple placeholder
    console.error('[Image] All fallbacks exhausted for:', originalUrl);
    const parent = imgEl.parentElement;
    if (parent) {
      parent.innerHTML = `<div class="no-image-message"><i class="fas fa-image"></i><p>Image unavailable</p></div>`;
    }
  },

  /**
   * Set the main preview image in the add/edit modal
   */
  setEditMainImage(index = 0) {
    const mainImageEl = document.getElementById('editMainImage');
    if (!mainImageEl) return;

    const imgData = InventoryState.currentImages[index];
    if (!imgData) {
      mainImageEl.innerHTML = '';
      mainImageEl.classList.add('no-image');
      return;
    }

    let imgSrc, onErrorHandler = '';
    const originalUrl = imgData.url || imgData.preview;
    if (imgData.url) {
      const fallbacks = this.getFallbackUrls(imgData.url, 800);
      imgSrc = fallbacks[0];
      const escapedUrl = imgData.url.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      onErrorHandler = `onerror="InventoryImage.handleImageError(this, '${escapedUrl}', 800)" data-tried-index="0" data-original-url="${escapedUrl}"`;
    } else {
      imgSrc = imgData.preview;
    }

    mainImageEl.innerHTML = `<img src="${imgSrc}" alt="Product image" ${onErrorHandler}>`;
    mainImageEl.classList.remove('no-image');
  },

  // Render images grid in modal
  renderImagesGrid() {
    const thumbs = document.getElementById('editThumbnails');
    const mainImageEl = document.getElementById('editMainImage');
    if (!thumbs || !mainImageEl) return;

    // Build thumbnails
    const tiles = InventoryState.currentImages.map((img, index) => {
      // Use thumbnail for existing images, preview for new uploads
      let imgSrc, onErrorHandler = '';
      if (img.url) {
        const fallbacks = this.getFallbackUrls(img.url, 200);
        imgSrc = fallbacks[0];
        const escapedUrl = img.url.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        onErrorHandler = `onerror="InventoryImage.handleImageError(this, '${escapedUrl}', 200)" data-tried-index="0" data-original-url="${escapedUrl}"`;
      } else {
        imgSrc = img.preview;
      }
      return `
        <div class="image-item ${img.uploading ? 'uploading' : ''}" data-index="${index}" onclick="InventoryImage.setEditMainImage(${index})">
          <img src="${imgSrc}" alt="Product image" loading="lazy" ${onErrorHandler}>
          <button type="button" class="remove-image" onclick="InventoryImage.removeImage(${index})">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      `;
    });

    // Show add tile if under max images
    if (InventoryState.currentImages.length < InventoryState.MAX_IMAGES) {
      tiles.push(`
        <label class="image-add-tile" for="itemImages">
          <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </div>
        </label>
      `);
    }

    thumbs.innerHTML = tiles.join('');

    // Update main preview
    if (InventoryState.currentImages.length > 0) {
      this.setEditMainImage(0);
    } else {
      mainImageEl.innerHTML = '';
      mainImageEl.classList.add('no-image');
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
    if (!InventoryUtils.isGoogleConnected()) {
      throw new Error('Please connect your Google account first');
    }

    const googleToken = InventoryUtils.getGoogleToken();
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

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      let result;
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        // If not JSON, read as text for error message
        const text = await response.text();
        throw new Error(`Upload failed: ${response.status === 413 ? 'File too large (max 50MB)' : text || 'Unknown error'}`);
      }

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Upload failed');
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

  // Upload QR code to Google Drive (backend generates QR code directly)
  async uploadQrCode(productCode, productName) {
    if (!InventoryUtils.isGoogleConnected()) {
      return null;
    }

    const googleToken = InventoryUtils.getGoogleToken();
    if (!googleToken) {
      return null;
    }

    try {

      // Backend will generate QR code and upload to Google Drive
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
