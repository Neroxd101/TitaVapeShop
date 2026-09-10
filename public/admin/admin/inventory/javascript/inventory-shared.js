// Shared inventory utilities, state, and DOM references
// Used by both Inventory and Sales modules

// State management
const InventoryState = {
    inventoryItems: [],
    currentFilter: 'all',
    stockFilter: 'all',
    searchQuery: '',
    editingItemId: null,
    deletingItemId: null,
    currentImages: [], // Array of { url, file, uploading }
    viewingItemId: null,
    viewingHistoryItemId: null,
    historyFilterDate: null,
    historyPage: 1,
    historyPageSize: 6,
    historyTotal: 0,
    MAX_IMAGES: 5
};

// DOM Elements
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
    historyModal: null,
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

// Utility functions
const InventoryUtils = {
    // Check authentication (Local check for UI purposes)
    checkAuth() {
        const user = localStorage.getItem('user');

        if (!user) {
            window.location.href = '/';
            return null;
        }

        return JSON.parse(user);
    },

    // Format currency
    formatCurrency(amount) {
        const num = Number(amount);
        const isNegative = num < 0;
        const absNum = Math.abs(num);
        const formatted = absNum.toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return isNegative ? `- ₱${formatted}` : `₱${formatted}`;
    },

    // Format date with time
    formatDate(date) {
        return new Date(date).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Google Auth Helpers
    isGoogleConnected() {
        return localStorage.getItem('google_connected') === 'true';
    },

    getGoogleToken() {
        return localStorage.getItem('google_access_token');
    }
};
