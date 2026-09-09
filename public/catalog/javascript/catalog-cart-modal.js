/**
 * Catalog Cart Modal
 * Handles cart modal display and interactions
 */

const CatalogCartModal = {
    modal: null,
    closeButton: null,
    clearCartBtn: null,
    nextToCheckoutBtn: null,
    cartItems: null,
    cartTotal: null,

    /**
     * Initialize the cart modal
     */
    async init() {
        const container = document.getElementById('cart-modal-container');
        if (!container) {
            console.error('[Cart Modal] Container not found');
            return false;
        }

        try {
            const response = await fetch('/catalog/catalog-cart-modal.html');
            if (!response.ok) {
                console.error('[Cart Modal] Failed to load modal HTML:', response.status);
                return false;
            }
            
            container.innerHTML = await response.text();
            
            // Get modal references
            this.modal = document.getElementById('cartModal');
            this.closeButton = document.getElementById('closeCartModal');
            this.clearCartBtn = document.getElementById('clearCartBtn');
            this.nextToCheckoutBtn = document.getElementById('nextToCheckoutBtn');
            this.cartItems = document.getElementById('cartItems');
            this.cartTotal = document.getElementById('cartTotal');

            if (!this.modal) {
                console.error('[Cart Modal] Modal element not found');
                return false;
            }

            // Setup event listeners
            this.setupEventListeners();
            return true;
        } catch (error) {
            console.error('[Cart Modal] Error loading modal:', error);
            return false;
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        document.getElementById('closeEmptyCartBtn')?.addEventListener('click', () => this.close());
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.close());
        }

        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.close();
                }
            });
        }

        if (this.clearCartBtn) {
            const clearDialog = document.getElementById('clearCartModal');
            this.clearCartBtn.addEventListener('click', () => {
                if (window.CatalogCart?.cart.length && !clearDialog.open) {
                    clearDialog.showModal();
                }
            });
            document.getElementById('confirmClearCartBtn').addEventListener('click', () => {
                if (window.CatalogCart) {
                    window.CatalogCart.clearCart();
                    window.CatalogCart.renderCart();
                }
                clearDialog.close();
            });
            clearDialog.addEventListener('close', () => {
                if (window.CatalogCart?.cart.length) {
                    this.clearCartBtn.focus();
                } else {
                    document.getElementById('closeEmptyCartBtn')?.focus();
                }
            });
        }

        if (this.nextToCheckoutBtn) {
            this.nextToCheckoutBtn.addEventListener('click', () => {
                if (window.CatalogCart && window.CatalogCart.cart.length === 0) {
                    window.CatalogCart.renderCart();
                    return;
                }

                // Check customer authentication before checkout
                if (window.CustomerAuth && !window.CustomerAuth.currentUser) {
                    this.close();
                    window.CustomerAuth.requireAuth(() => {
                        if (window.CatalogCheckoutModal) {
                            window.CatalogCheckoutModal.show();
                        }
                    }, 'Please sign in or create a verified account to place your order.');
                    return;
                }

                this.close();
                if (window.CatalogCheckoutModal) {
                    window.CatalogCheckoutModal.show();
                }
            });
        }
    },

    /**
     * Show the cart modal
     */
    show() {
        if (!this.modal) {
            console.error('[Cart Modal] Modal not initialized');
            return;
        }

        // Re-render cart if CatalogCart is available
        if (window.CatalogCart) {
            window.CatalogCart.renderCart();
        }

        this.modal.classList.add('show');
    },

    /**
     * Close the cart modal
     */
    close() {
        if (this.modal) {
            this.modal.classList.remove('show');
        }
    }
};

// Expose globally
window.CatalogCartModal = CatalogCartModal;
