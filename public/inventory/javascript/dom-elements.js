// DOM Elements namespace
const InventoryDOM = {
  // Static elements
  inventoryGrid: null,
  emptyState: null,
  loadingState: null,
  searchInput: null,
  filterTabs: null,
  
  // Modal references (will be set after modals are loaded)
  itemModal: null,
  viewModal: null,
  deleteModal: null,
  itemForm: null,

  // Initialize DOM references
  init() {
    this.inventoryGrid = document.getElementById('inventoryGrid');
    this.emptyState = document.getElementById('emptyState');
    this.loadingState = document.getElementById('loadingState');
    this.searchInput = document.getElementById('searchInput');
    this.filterTabs = document.querySelectorAll('.filter-tab');
  }
};
