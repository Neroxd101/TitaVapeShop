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
      // Use export=view so <img> can render reliably
      // (thumbnail endpoint often fails for private/not-fully-public files)
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
    // Return original URL if not a Google Drive link
    return url;
  },

  // Get direct viewable URL for Google Drive image  
  getViewableUrl(url) {
    const fileId = this.getGoogleDriveFileId(url);
    if (fileId) {
      // Use export=view so <img> can render reliably
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
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

  /**
   * Get proxy URL for Google Drive image (uses backend with auth token)
   * This works even for private files because backend uses user's token
   */
  getProxyUrl(fileId) {
    if (!fileId) return null;
    const googleToken = InventoryGoogle.getToken();
    if (!googleToken) return null;
    // Pass token as query param (backend will also check X-Google-Token header)
    return `/api/upload/drive-image/${fileId}?token=${encodeURIComponent(googleToken)}`;
  },

  /**
   * Return a list of fallback URLs for a Drive (or other) image.
   * Order: proxy (with auth) -> thumbnail -> export=view -> original
   */
  getFallbackUrls(url, size = 800) {
    const fileId = this.getGoogleDriveFileId(url);
    if (!fileId) return [url];
    
    const proxyUrl = this.getProxyUrl(fileId);
    const fallbacks = [];
    
    // Try proxy first (works for private files)
    if (proxyUrl) {
      fallbacks.push(proxyUrl);
    }
    
    // Then try public URLs
    fallbacks.push(
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`,
      `https://drive.google.com/uc?export=view&id=${fileId}`,
      url
    );
    
    return fallbacks;
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
          <div class="add-tile-inner">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            <span>Add Images</span>
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

  // Update QR preview image in modal
  updateQrPreview(imageUrl) {
    const qrPreview = document.getElementById('qrPreview');
    if (!qrPreview) return;
    
    if (imageUrl) {
      const fallbacks = this.getFallbackUrls(imageUrl, 200);
      const escapedUrl = imageUrl.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      qrPreview.innerHTML = `<img src="${fallbacks[0]}" data-tried-index="0" data-original-url="${escapedUrl}" alt="QR Code" loading="lazy" onerror="InventoryImage.handleImageError(this, '${escapedUrl}', 200)">`;
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
