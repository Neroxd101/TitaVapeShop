// Check authentication
function checkAuth() {
  const accessToken = localStorage.getItem('access_token');
  const user = localStorage.getItem('user');
  
  if (!accessToken || !user) {
    window.location.href = '/';
    return null;
  }
  
  return JSON.parse(user);
}

// Check if Google is connected
function isGoogleConnected() {
  return localStorage.getItem('google_connected') === 'true';
}

// Get Google token
function getGoogleToken() {
  return localStorage.getItem('google_access_token');
}

// Logout function
function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

// Format currency
function formatCurrency(amount) {
  return '₱' + Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Format date with time
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// State
let inventoryItems = [];
let currentFilter = 'all';
let searchQuery = '';
let editingItemId = null;
let deletingItemId = null;
let currentImages = []; // Array of { url, file, uploading }
const MAX_IMAGES = 5;

// DOM Elements
const inventoryGrid = document.getElementById('inventoryGrid');
const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const searchInput = document.getElementById('searchInput');
const filterTabs = document.querySelectorAll('.filter-tab');
const itemModal = document.getElementById('itemModal');
const deleteModal = document.getElementById('deleteModal');
const viewModal = document.getElementById('viewModal');
const itemForm = document.getElementById('itemForm');
let viewingItemId = null;

// Initialize
function init() {
  const user = checkAuth();
  if (!user) return;
  
  // Set user info
  const userName = document.getElementById('userName');
  const userRole = document.getElementById('userRole');
  const userAvatar = document.getElementById('userAvatar');
  
  if (userName) userName.textContent = user.username || user.email.split('@')[0];
  if (userRole) userRole.textContent = user.role === 'admin' ? 'Administrator' : 'Staff';
  if (userAvatar) userAvatar.textContent = (user.username || user.email)[0].toUpperCase();
  
  // Load inventory
  loadInventory();
  
  // Setup event listeners
  setupEventListeners();
}

// Load inventory from API
async function loadInventory() {
  showLoading(true);
  
  try {
    const response = await fetch('/inventory/api', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      inventoryItems = result.data || [];
      renderInventory();
    } else {
      console.error('Failed to load inventory:', result.error);
      inventoryItems = [];
      renderInventory();
    }
  } catch (error) {
    console.error('Error loading inventory:', error);
    inventoryItems = [];
    renderInventory();
  } finally {
    showLoading(false);
  }
}

// Render inventory cards
function renderInventory() {
  const filtered = filterItems();
  
  if (filtered.length === 0) {
    inventoryGrid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  inventoryGrid.innerHTML = filtered.map(item => createCard(item)).join('');
}

// Filter items based on category and search
function filterItems() {
  return inventoryItems.filter(item => {
    const matchesCategory = currentFilter === 'all' || item.category === currentFilter;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });
}

// Parse images from item (can be JSON array or single URL)
function parseImages(item) {
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
}

// Extract Google Drive file ID from URL
function getGoogleDriveFileId(url) {
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
}

// Get thumbnail URL for Google Drive image
function getThumbnailUrl(url, size = 400) {
  const fileId = getGoogleDriveFileId(url);
  if (fileId) {
    // Use Google Drive thumbnail API - most reliable for thumbnails
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
  }
  // Return original URL if not a Google Drive link
  return url;
}

// Get direct viewable URL for Google Drive image  
function getViewableUrl(url) {
  const fileId = getGoogleDriveFileId(url);
  if (fileId) {
    // Try thumbnail first as it's more reliable for display
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
  }
  return url;
}

// Get full size URL for Google Drive image
function getFullImageUrl(url) {
  const fileId = getGoogleDriveFileId(url);
  if (fileId) {
    return `https://drive.google.com/uc?id=${fileId}`;
  }
  return url;
}

// Create inventory card HTML
function createCard(item) {
  const isLowStock = item.quantity <= 5;
  const images = parseImages(item);
  const hasMultipleImages = images.length > 1;
  
  // Use thumbnails for card display (faster loading)
  const imagesHtml = images.length > 0 
    ? `
      <div class="card-images" data-current="0">
        <div class="card-images-track" style="width: ${images.length * 100}%">
          ${images.map(url => {
            const imgUrl = getViewableUrl(url);
            console.log('Loading image:', url, '->', imgUrl);
            return `<img src="${imgUrl}" alt="${item.name}" loading="lazy" onerror="console.error('Image failed:', this.src); this.style.opacity='0.3'">`;
          }).join('')}
        </div>
        ${hasMultipleImages ? `
          <button class="card-images-arrow prev" onclick="slideImage(event, '${item.id}', -1)">
            <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </button>
          <button class="card-images-arrow next" onclick="slideImage(event, '${item.id}', 1)">
            <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </button>
          <div class="card-images-nav">
            ${images.map((_, i) => `<span class="card-images-dot ${i === 0 ? 'active' : ''}" onclick="goToImage(event, '${item.id}', ${i})"></span>`).join('')}
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
    <div class="inventory-card" data-id="${item.id}" onclick="viewItem('${item.id}')">
      ${imagesHtml}
      
      <div class="card-header">
        <span class="card-category ${item.category}">${item.category}</span>
        <div class="card-qr">
          ${item.qr_image_url 
            ? `<img src="${getViewableUrl(item.qr_image_url)}" alt="QR" loading="lazy">`
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
          <span class="detail-value">${formatCurrency(item.cost_price)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Sale Price</span>
          <span class="detail-value price">${formatCurrency(item.sale_price)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Profit</span>
          <span class="detail-value price">${formatCurrency(item.sale_price - item.cost_price)}</span>
        </div>
      </div>
      
      <div class="card-dates">
        <div class="date-item">
          <span class="date-label">Added</span>
          <span class="date-value">${formatDate(item.created_at)}</span>
        </div>
        <div class="date-item">
          <span class="date-label">Updated</span>
          <span class="date-value">${formatDate(item.updated_at)}</span>
        </div>
      </div>
      
      <div class="card-actions">
        <button class="btn-card btn-edit" onclick="event.stopPropagation(); editItem('${item.id}')">
          <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          Edit
        </button>
        <button class="btn-card btn-delete" onclick="event.stopPropagation(); deleteItem('${item.id}', '${item.name.replace(/'/g, "\\'")}')">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          Delete
        </button>
      </div>
    </div>
  `;
}

// Image carousel functions
function slideImage(event, itemId, direction) {
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
}

function goToImage(event, itemId, index) {
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
}

// Show/hide loading state
function showLoading(show) {
  loadingState.style.display = show ? 'block' : 'none';
  inventoryGrid.style.display = show ? 'none' : 'grid';
}

// Generate unique product code
function generateProductCode(productName) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  const safeName = productName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
  return `TVS-${safeName}-${timestamp}${random}`.toUpperCase();
}

// Update QR preview image in modal
function updateQrPreview(imageUrl) {
  const qrPreview = document.getElementById('qrPreview');
  if (!qrPreview) return;
  
  if (imageUrl) {
    qrPreview.innerHTML = `<img src="${getViewableUrl(imageUrl)}" alt="QR Code" loading="lazy">`;
  } else {
    qrPreview.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13 2h-2v2h2v2h-4v-4h2v-2h-2v-2h4v4zm2-4v2h2v4h-2v2h-2v-4h2v-2h-2v-2h2z"/></svg>`;
  }
}

// Render images grid in modal
function renderImagesGrid() {
  const grid = document.getElementById('imagesGrid');
  if (!grid) return;
  
  grid.innerHTML = currentImages.map((img, index) => {
    // Use thumbnail for existing images, preview for new uploads
    const imgSrc = img.url ? getThumbnailUrl(img.url, 200) : img.preview;
    return `
      <div class="image-item ${img.uploading ? 'uploading' : ''}" data-index="${index}">
        <img src="${imgSrc}" alt="Product image" loading="lazy">
        <button type="button" class="remove-image" onclick="removeImage(${index})">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>
    `;
  }).join('');
}

// Handle image files selection
async function handleImagesSelect(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  
  // Check max images limit
  const remainingSlots = MAX_IMAGES - currentImages.length;
  if (remainingSlots <= 0) {
    alert(`Maximum ${MAX_IMAGES} images allowed`);
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
    
    currentImages.push({
      file,
      preview,
      url: null,
      uploading: false
    });
  }
  
  renderImagesGrid();
  e.target.value = ''; // Reset input
}

// Remove image from list
function removeImage(index) {
  currentImages.splice(index, 1);
  renderImagesGrid();
}

// Upload single image to Google Drive
async function uploadSingleImage(imageData, index, productName) {
  if (!isGoogleConnected()) {
    throw new Error('Please connect your Google account first');
  }
  
  const googleToken = getGoogleToken();
  if (!googleToken) {
    throw new Error('Google token not found');
  }
  
  // Mark as uploading
  currentImages[index].uploading = true;
  renderImagesGrid();
  
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
    
    currentImages[index].url = result.imageUrl;
    currentImages[index].uploading = false;
    renderImagesGrid();
    
    return result.imageUrl;
  } catch (error) {
    currentImages[index].uploading = false;
    renderImagesGrid();
    throw error;
  }
}

// Upload all pending images to product folder
async function uploadPendingImages(productName) {
  const pendingImages = currentImages.filter((img) => img.file && !img.url);
  
  if (pendingImages.length === 0) return;
  
  const uploadingEl = document.getElementById('imageUploading');
  const hintEl = document.getElementById('imageHint');
  
  if (uploadingEl) uploadingEl.style.display = 'flex';
  if (hintEl) hintEl.style.display = 'none';
  
  try {
    for (let i = 0; i < currentImages.length; i++) {
      if (currentImages[i].file && !currentImages[i].url) {
        await uploadSingleImage(currentImages[i], i, productName);
      }
    }
  } finally {
    if (uploadingEl) uploadingEl.style.display = 'none';
    if (hintEl) hintEl.style.display = 'block';
  }
}

// Upload QR code to Google Drive (backend fetches from QRtag.net API)
async function uploadQrCode(productCode, productName) {
  if (!isGoogleConnected()) {
    console.log('Google not connected, skipping QR upload');
    return null;
  }
  
  const googleToken = getGoogleToken();
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

// Open modal for adding new item
function openAddModal() {
  editingItemId = null;
  currentImages = [];
  
  document.getElementById('modalTitle').textContent = 'Add New Item';
  document.getElementById('saveBtn').querySelector('.btn-text').textContent = 'Save Item';
  itemForm.reset();
  
  renderImagesGrid();
  
  // Hide QR code section for new items
  document.getElementById('qrGroup').style.display = 'none';
  
  itemModal.classList.add('show');
}

// Open modal for editing item
function editItem(id) {
  const item = inventoryItems.find(i => i.id === id);
  if (!item) return;
  
  editingItemId = id;
  
  // Load existing images
  const images = parseImages(item);
  currentImages = images.map(url => ({ url, file: null, uploading: false }));
  
  document.getElementById('modalTitle').textContent = 'Edit Item';
  document.getElementById('saveBtn').querySelector('.btn-text').textContent = 'Update Item';
  
  document.getElementById('itemId').value = item.id;
  document.getElementById('itemCategory').value = item.category;
  document.getElementById('itemName').value = item.name;
  document.getElementById('itemDescription').value = item.description || '';
  document.getElementById('itemQuantity').value = item.quantity;
  document.getElementById('itemCostPrice').value = item.cost_price;
  document.getElementById('itemSalePrice').value = item.sale_price;
  
  renderImagesGrid();
  
  // Show QR code for existing items
  if (item.qr_image_url) {
    document.getElementById('qrGroup').style.display = 'block';
    updateQrPreview(item.qr_image_url);
  } else {
    document.getElementById('qrGroup').style.display = 'none';
  }
  
  itemModal.classList.add('show');
}

// Close item modal
function closeItemModal() {
  itemModal.classList.remove('show');
  editingItemId = null;
  currentImages = [];
}

// Open view modal
function viewItem(id) {
  const item = inventoryItems.find(i => i.id === id);
  if (!item) return;
  
  viewingItemId = id;
  const images = parseImages(item);
  const isLowStock = item.quantity <= 5;
  
  // Set modal title
  document.getElementById('viewModalTitle').textContent = item.name;
  
  // Set main image
  const mainImageEl = document.getElementById('viewMainImage');
  if (images.length > 0) {
    mainImageEl.innerHTML = `<img src="${getViewableUrl(images[0])}" alt="${item.name}">`;
    mainImageEl.classList.remove('no-image');
  } else {
    mainImageEl.innerHTML = '';
    mainImageEl.classList.add('no-image');
  }
  
  // Set thumbnails
  const thumbnailsEl = document.getElementById('viewThumbnails');
  if (images.length > 1) {
    thumbnailsEl.innerHTML = images.map((url, index) => `
      <div class="view-thumbnail ${index === 0 ? 'active' : ''}" onclick="setViewMainImage('${url}', ${index})">
        <img src="${getThumbnailUrl(url, 100)}" alt="Thumbnail ${index + 1}">
      </div>
    `).join('');
  } else {
    thumbnailsEl.innerHTML = '';
  }
  
  // Set QR code
  const qrEl = document.getElementById('viewQr');
  if (item.qr_image_url) {
    qrEl.innerHTML = `<img src="${getViewableUrl(item.qr_image_url)}" alt="QR Code">`;
    qrEl.classList.remove('no-qr');
  } else {
    qrEl.innerHTML = '';
    qrEl.classList.add('no-qr');
  }
  
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
  
  document.getElementById('viewCostPrice').textContent = formatCurrency(item.cost_price);
  document.getElementById('viewSalePrice').textContent = formatCurrency(item.sale_price);
  document.getElementById('viewProfit').textContent = formatCurrency(item.sale_price - item.cost_price);
  
  // Set dates
  document.getElementById('viewCreatedAt').textContent = formatDate(item.created_at);
  document.getElementById('viewUpdatedAt').textContent = formatDate(item.updated_at);
  
  viewModal.classList.add('show');
}

// Set main image in view modal
function setViewMainImage(url, activeIndex) {
  const mainImageEl = document.getElementById('viewMainImage');
  const item = inventoryItems.find(i => i.id === viewingItemId);
  
  mainImageEl.innerHTML = `<img src="${getViewableUrl(url)}" alt="${item?.name || 'Product'}">`;
  
  // Update active thumbnail
  const thumbnails = document.querySelectorAll('.view-thumbnail');
  thumbnails.forEach((thumb, index) => {
    thumb.classList.toggle('active', index === activeIndex);
  });
}

// Close view modal
function closeViewModal() {
  viewModal.classList.remove('show');
  viewingItemId = null;
}

// Open delete confirmation
function deleteItem(id, name) {
  deletingItemId = id;
  document.getElementById('deleteItemName').textContent = name;
  deleteModal.classList.add('show');
}

// Close delete modal
function closeDeleteModal() {
  deleteModal.classList.remove('show');
  deletingItemId = null;
}

// Save item (create or update)
async function saveItem(e) {
  e.preventDefault();
  
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.classList.add('loading');
  saveBtn.disabled = true;
  
  const productName = document.getElementById('itemName').value.trim();
  
  if (!productName) {
    alert('Product name is required');
    saveBtn.classList.remove('loading');
    saveBtn.disabled = false;
    return;
  }
  
  try {
    // Upload any pending images to product folder
    await uploadPendingImages(productName);
    
    // Get all image URLs
    const imageUrls = currentImages
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
    
    // Generate and upload QR code for new items only
    if (!editingItemId) {
      const productCode = generateProductCode(productName);
      console.log('Generated product code:', productCode);
      
      // Upload QR code to Google Drive (fetched from QRtag.net API)
      const qrImageUrl = await uploadQrCode(productCode, productName);
      if (qrImageUrl) {
        itemData.qr_image_url = qrImageUrl;
      }
    }
    
    if (editingItemId) {
      itemData.id = editingItemId;
    }
    
    const response = await fetch('/inventory/api', {
      method: editingItemId ? 'PUT' : 'POST',
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
      closeItemModal();
      loadInventory();
    } else {
      alert(result.error || 'Failed to save item');
    }
  } catch (error) {
    console.error('Error saving item:', error);
    alert('Failed to save item: ' + error.message);
    saveBtn.classList.remove('loading');
    saveBtn.disabled = false;
  }
}

// Confirm delete
async function confirmDelete() {
  if (!deletingItemId) return;
  
  const deleteBtn = document.getElementById('confirmDeleteBtn');
  deleteBtn.classList.add('loading');
  deleteBtn.disabled = true;
  
  try {
    const response = await fetch(`/inventory/api/${deletingItemId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      closeDeleteModal();
      loadInventory();
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
}

// Toggle sidebar on mobile
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

// Setup event listeners
function setupEventListeners() {
  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  
  // Menu toggle
  document.getElementById('menuToggle')?.addEventListener('click', toggleSidebar);
  
  // Add item button
  document.getElementById('addItemBtn')?.addEventListener('click', openAddModal);
  
  // Search input
  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderInventory();
  });
  
  // Filter tabs
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.category;
      renderInventory();
    });
  });
  
  // Item form submit
  itemForm?.addEventListener('submit', saveItem);
  
  // Multiple images upload
  document.getElementById('itemImages')?.addEventListener('change', handleImagesSelect);
  
  // Modal close buttons
  document.getElementById('modalClose')?.addEventListener('click', closeItemModal);
  document.getElementById('cancelBtn')?.addEventListener('click', closeItemModal);
  document.getElementById('deleteModalClose')?.addEventListener('click', closeDeleteModal);
  document.getElementById('cancelDeleteBtn')?.addEventListener('click', closeDeleteModal);
  document.getElementById('confirmDeleteBtn')?.addEventListener('click', confirmDelete);
  
  // View modal buttons
  document.getElementById('viewModalClose')?.addEventListener('click', closeViewModal);
  document.getElementById('viewEditBtn')?.addEventListener('click', () => {
    closeViewModal();
    if (viewingItemId) editItem(viewingItemId);
  });
  document.getElementById('viewDeleteBtn')?.addEventListener('click', () => {
    const item = inventoryItems.find(i => i.id === viewingItemId);
    closeViewModal();
    if (item) deleteItem(item.id, item.name);
  });
  
  // Close modals on overlay click
  itemModal?.addEventListener('click', (e) => {
    if (e.target === itemModal) closeItemModal();
  });
  deleteModal?.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });
  viewModal?.addEventListener('click', (e) => {
    if (e.target === viewModal) closeViewModal();
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
