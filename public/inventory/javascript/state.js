// State management namespace
const InventoryState = {
  inventoryItems: [],
  currentFilter: 'all',
  searchQuery: '',
  editingItemId: null,
  deletingItemId: null,
  currentImages: [], // Array of { url, file, uploading }
  viewingItemId: null,
  MAX_IMAGES: 5
};
