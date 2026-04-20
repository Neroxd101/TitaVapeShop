/**
 * Catalog Cart Module
 * Handles shopping cart functionality with localStorage persistence
 */
const CatalogCart = {
    storageKey: 'catalog_cart',
    cart: [],

    /**
     * Initialize cart from localStorage
     */
    init() {
        this.loadCart();
        this.updateCartBadge();
    },

    /**
     * Load cart from localStorage
     */
    loadCart() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            this.cart = stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading cart:', error);
            this.cart = [];
        }
    },

    /**
     * Save cart to localStorage
     */
    saveCart() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.cart));
        } catch (error) {
            console.error('Error saving cart:', error);
        }
    },

    /**
     * Add product to cart
     * @param {Object} product - Product object
     * @param {number} quantity - Quantity to add (default 1)
     */
    addToCart(product, quantity = 1) {
        // Get available stock
        const availableStock = window.CatalogProducts?.getAvailableStock(product) ?? product.quantity;
        const existingItem = this.cart.find(item => item.id === product.id);
        const currentCartQuantity = existingItem ? existingItem.quantity : 0;
        const newTotalQuantity = currentCartQuantity + quantity;

        // Check if adding this quantity would exceed available stock
        if (newTotalQuantity > product.quantity) {
            const maxCanAdd = product.quantity - currentCartQuantity;
            if (maxCanAdd <= 0) {
                alert(`Cannot add more. Only ${availableStock} item(s) available in stock.`);
                return;
            }
            alert(`Only ${maxCanAdd} more item(s) can be added. Available stock: ${availableStock}`);
            quantity = maxCanAdd;
        }

        if (existingItem) {
            existingItem.quantity += quantity;
            // Update max_quantity if not set or if product data is available
            if (!existingItem.max_quantity || (product && product.quantity)) {
                existingItem.max_quantity = product.quantity;
            }
        } else {
            this.cart.push({
                id: product.id,
                name: product.name,
                category: product.category,
                sale_price: product.sale_price,
                image: product.images && product.images.length > 0 ? product.images[0] : null,
                quantity: quantity,
                max_quantity: product.quantity // Store max quantity for validation
            });
        }

        this.saveCart();
        this.updateCartBadge();
        // Trigger stock update event
        document.dispatchEvent(new CustomEvent('cartUpdated', { detail: product.id }));
    },

    /**
     * Remove product from cart
     * @param {string} productId - Product ID
     */
    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.id !== productId);
        this.saveCart();
        this.updateCartBadge();
        // Re-render cart if modal is open
        if (window.CatalogCartModal && window.CatalogCartModal.modal && window.CatalogCartModal.modal.classList.contains('show')) {
            this.renderCart();
        }
        // Trigger stock update event
        document.dispatchEvent(new CustomEvent('cartUpdated', { detail: productId }));
    },

    /**
     * Update quantity of item in cart
     * @param {string} productId - Product ID
     * @param {number} quantity - New quantity
     */
    updateQuantity(productId, quantity) {
        const item = this.cart.find(item => item.id === productId);
        if (!item) return;

        if (quantity <= 0) {
            this.removeFromCart(productId);
            return;
        }

        // Get product to check max stock
        const product = window.CatalogProducts?.getProductById(productId);
        if (product) {
            // Validate against max stock
            if (quantity > product.quantity) {
                alert(`Cannot set quantity to ${quantity}. Maximum available stock is ${product.quantity}.`);
                quantity = product.quantity;
            }
        } else if (item.max_quantity && quantity > item.max_quantity) {
            // Fallback to stored max_quantity if product not found
            alert(`Cannot set quantity to ${quantity}. Maximum available stock is ${item.max_quantity}.`);
            quantity = item.max_quantity;
        }

        item.quantity = quantity;
        this.saveCart();
        // Re-render cart if modal is open
        if (window.CatalogCartModal && window.CatalogCartModal.modal && window.CatalogCartModal.modal.classList.contains('show')) {
            this.renderCart();
        }
        this.updateCartBadge();
        // Trigger stock update event
        document.dispatchEvent(new CustomEvent('cartUpdated', { detail: productId }));
    },

    /**
     * Clear entire cart
     */
    clearCart() {
        const productIds = this.cart.map(item => item.id);
        this.cart = [];
        this.saveCart();
        this.updateCartBadge();
        // Trigger stock update events for all products
        productIds.forEach(productId => {
            document.dispatchEvent(new CustomEvent('cartUpdated', { detail: productId }));
        });
    },

    /**
     * Get total items in cart
     * @returns {number}
     */
    getTotalItems() {
        return this.cart.reduce((sum, item) => sum + item.quantity, 0);
    },

    /**
     * Get total amount
     * @returns {number}
     */
    getTotalAmount() {
        return this.cart.reduce((sum, item) => sum + (item.sale_price * item.quantity), 0);
    },

    /**
     * Update cart badge
     */
    updateCartBadge() {
        const badge = document.getElementById('cartBadge');
        if (badge) {
            const total = this.getTotalItems();
            if (total > 0) {
                badge.textContent = total > 99 ? '99+' : String(total);
                badge.classList.add('has-items');
                badge.style.display = 'inline-flex';
            } else {
                badge.textContent = '0';
                badge.classList.remove('has-items');
                badge.style.display = 'none';
            }
        }
    },

    /**
     * Render cart items
     */
    renderCart() {
        // Use modal's cartItems if available, otherwise fallback to direct element
        const cartItems = (window.CatalogCartModal && window.CatalogCartModal.cartItems) 
            ? window.CatalogCartModal.cartItems 
            : document.getElementById('cartItems');
        if (!cartItems) return;

        // Update total first (always update, even if cart is empty)
        const cartTotal = (window.CatalogCartModal && window.CatalogCartModal.cartTotal)
            ? window.CatalogCartModal.cartTotal
            : document.getElementById('cartTotal');
        if (cartTotal) {
            cartTotal.textContent = `₱${this.getTotalAmount().toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        }

        if (this.cart.length === 0) {
            cartItems.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
            return;
        }

        cartItems.innerHTML = this.cart.map(item => {
            const imageUrl = this.getImageUrl(item.image);
            // Get max quantity from product or stored value
            const product = window.CatalogProducts?.getProductById(item.id);
            const maxQuantity = product ? product.quantity : (item.max_quantity || 999);
            return `
                <div class="cart-row" data-id="${item.id}">
                    <div class="cart-main">
                        <div class="cart-name">${this.escapeHtml(item.name)}</div>
                        <div class="cart-price">${this.escapeHtml(item.category)} • ₱${parseFloat(item.sale_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                    <input type="number" class="cart-qty-input" value="${item.quantity}" min="1" max="${maxQuantity}"
                           onchange="CatalogCart.updateQuantity('${item.id}', parseInt(this.value) || 1)">
                    <div class="cart-subtotal">₱${(parseFloat(item.sale_price) * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <button class="cart-remove-btn" onclick="CatalogCart.removeFromCart('${item.id}')" title="Remove">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');
    },

    /**
     * Get image URL (handling drive proxy)
     */
    getImageUrl(imageUrl) {
        if (!imageUrl) return '/img/placeholder-product.png';
        if (imageUrl.includes('drive.google.com')) {
            const fileId = imageUrl.match(/id=([^&]+)/)?.[1];
            return fileId ? `/api/upload/drive-image/${fileId}` : imageUrl;
        }
        return imageUrl;
    },

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }
};

// Initialize cart on page load
document.addEventListener('DOMContentLoaded', async () => {
    CatalogCart.init();

    // Initialize all modals
    if (window.CatalogCartModal) {
        await CatalogCartModal.init();
    }
    if (window.CatalogPrivacyModal) {
        await CatalogPrivacyModal.init();
    }
    if (window.CatalogCheckoutModal) {
        await CatalogCheckoutModal.init();
    }
    if (window.CatalogOrderSuccessModal) {
        await CatalogOrderSuccessModal.init();
    }

    // Cart button
    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            if (window.CatalogCartModal) {
                window.CatalogCartModal.show();
            }
        });
    }
});

window.CatalogCart = CatalogCart;
