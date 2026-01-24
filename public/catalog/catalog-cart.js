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
        const cartModal = document.getElementById('cartModal');
        if (cartModal && cartModal.classList.contains('show')) {
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
        const cartModal = document.getElementById('cartModal');
        if (cartModal && cartModal.classList.contains('show')) {
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
            badge.textContent = total;
            badge.style.display = 'inline-flex';
        }
    },

    /**
     * Render cart items
     */
    renderCart() {
        const cartItems = document.getElementById('cartItems');
        if (!cartItems) return;

        // Update total first (always update, even if cart is empty)
        const cartTotal = document.getElementById('cartTotal');
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
document.addEventListener('DOMContentLoaded', () => {
    CatalogCart.init();

    // Cart button
    const cartBtn = document.getElementById('cartBtn');
    const cartModal = document.getElementById('cartModal');
    const closeCartModal = document.getElementById('closeCartModal');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const nextToCheckoutBtn = document.getElementById('nextToCheckoutBtn');

    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            CatalogCart.renderCart();
            cartModal.classList.add('show');
        });
    }

    if (closeCartModal) {
        closeCartModal.addEventListener('click', () => {
            cartModal.classList.remove('show');
        });
    }

    if (cartModal) {
        cartModal.addEventListener('click', (e) => {
            if (e.target === cartModal) {
                cartModal.classList.remove('show');
            }
        });
    }

    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear your cart?')) {
                CatalogCart.clearCart();
                CatalogCart.renderCart();
            }
        });
    }

    if (nextToCheckoutBtn) {
        nextToCheckoutBtn.addEventListener('click', () => {
            if (CatalogCart.cart.length === 0) {
                alert('Your cart is empty');
                return;
            }
            cartModal.classList.remove('show');
            openPrivacyConsentModal();
        });
    }

    // Data Privacy Consent Modal
    const privacyConsentModal = document.getElementById('privacyConsentModal');
    const privacyConsentCheckbox = document.getElementById('privacyConsentCheckbox');
    const acceptPrivacyBtn = document.getElementById('acceptPrivacyBtn');
    const declinePrivacyBtn = document.getElementById('declinePrivacyBtn');

    function openPrivacyConsentModal() {
        // Reset checkbox
        if (privacyConsentCheckbox) {
            privacyConsentCheckbox.checked = false;
        }
        if (acceptPrivacyBtn) {
            acceptPrivacyBtn.disabled = true;
        }
        if (privacyConsentModal) {
            privacyConsentModal.classList.add('show');
        }
    }

    // Enable/disable accept button based on checkbox
    if (privacyConsentCheckbox) {
        privacyConsentCheckbox.addEventListener('change', (e) => {
            if (acceptPrivacyBtn) {
                acceptPrivacyBtn.disabled = !e.target.checked;
            }
        });
    }

    // Accept privacy consent
    if (acceptPrivacyBtn) {
        acceptPrivacyBtn.addEventListener('click', () => {
            if (privacyConsentCheckbox && privacyConsentCheckbox.checked) {
                privacyConsentModal.classList.remove('show');
                openCheckoutModal();
            }
        });
    }

    // Decline privacy consent
    if (declinePrivacyBtn) {
        declinePrivacyBtn.addEventListener('click', () => {
            alert('We cannot process your order without your consent to collect and process your personal information. If you have any concerns, please contact us.');
            privacyConsentModal.classList.remove('show');
        });
    }

    // Close privacy modal when clicking outside
    if (privacyConsentModal) {
        privacyConsentModal.addEventListener('click', (e) => {
            if (e.target === privacyConsentModal) {
                privacyConsentModal.classList.remove('show');
            }
        });
    }

    // Checkout modal
    const checkoutModal = document.getElementById('checkoutModal');
    const closeCheckoutModal = document.getElementById('closeCheckoutModal');
    const cancelCheckoutBtn = document.getElementById('cancelCheckoutBtn');
    const checkoutForm = document.getElementById('checkoutForm');
    const checkoutTotal = document.getElementById('checkoutTotal');

    function openCheckoutModal() {
        if (checkoutTotal) {
            checkoutTotal.textContent = `₱${CatalogCart.getTotalAmount().toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        }
        checkoutModal.classList.add('show');
    }

    if (closeCheckoutModal) {
        closeCheckoutModal.addEventListener('click', () => {
            checkoutModal.classList.remove('show');
        });
    }

    if (cancelCheckoutBtn) {
        cancelCheckoutBtn.addEventListener('click', () => {
            checkoutModal.classList.remove('show');
        });
    }

    if (checkoutModal) {
        checkoutModal.addEventListener('click', (e) => {
            if (e.target === checkoutModal) {
                checkoutModal.classList.remove('show');
            }
        });
    }

    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const orderType = document.getElementById('orderType').value;
            const customerName = document.getElementById('customerName').value.trim();
            const contactNumber = document.getElementById('contactNumber').value.trim();
            const socialMedia = document.getElementById('socialMedia').value.trim();

            // Validate contact number (11 digits)
            const digitsOnly = contactNumber.replace(/\D/g, '');
            if (digitsOnly.length !== 11) {
                alert('Contact number must be exactly 11 digits');
                return;
            }

            // Prepare order items
            const items = CatalogCart.cart.map(item => ({
                id: item.id,
                name: item.name,
                category: item.category,
                price: item.sale_price,
                quantity: item.quantity
            }));

            const totalAmount = CatalogCart.getTotalAmount();

            // Disable submit button
            const submitBtn = document.getElementById('createOrderBtn');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Order...';

            try {
                const response = await fetch('/api/orders/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        customer_name: customerName,
                        contact_number: digitsOnly,
                        social_media: socialMedia || null,
                        order_type: orderType,
                        items: items,
                        total_amount: totalAmount
                    })
                });

                const result = await response.json();

                if (result.success && result.order) {
                    // Show success modal with QR code
                    console.log('Order created:', result.order); // Debug log
                    showOrderSuccess(result.order);
                    CatalogCart.clearCart();
                    checkoutModal.classList.remove('show');
                    checkoutForm.reset();
                } else {
                    alert('Failed to create order: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error creating order:', error);
                alert('Error creating order. Please try again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // Order success modal
    const orderSuccessModal = document.getElementById('orderSuccessModal');
    const closeOrderSuccessBtn = document.getElementById('closeOrderSuccessBtn');

    /**
     * Save QR code as image
     * @param {string} orderId - Order ID
     */
    function saveQRCode(orderId) {
        const qrCodeContainer = document.getElementById('orderQrCodeDisplay');
        if (!qrCodeContainer) {
            alert('QR code not found');
            return;
        }

        // Find the canvas element (QRCode library creates a canvas)
        const canvas = qrCodeContainer.querySelector('canvas');
        if (!canvas) {
            // Try to find img element if canvas is not available
            const img = qrCodeContainer.querySelector('img');
            if (img) {
                // Create a link to download the image
                const link = document.createElement('a');
                link.download = `QRCode_${orderId}.png`;
                link.href = img.src;
                link.click();
                return;
            }
            alert('QR code image not found');
            return;
        }

        // Convert canvas to blob and download
        canvas.toBlob((blob) => {
            if (!blob) {
                alert('Failed to generate QR code image');
                return;
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `QRCode_${orderId}.png`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    function showOrderSuccess(order) {
        console.log('showOrderSuccess called with:', order); // Debug log
        
        // Ensure orderSuccessModal exists
        if (!orderSuccessModal) {
            console.error('Order success modal not found!');
            alert('Order created successfully!');
            return;
        }

        // Handle case where order might be an array (from RPC)
        if (Array.isArray(order) && order.length > 0) {
            order = order[0];
        }

        if (!order || !order.id) {
            console.error('Invalid order data:', order);
            // Still show modal with generic message
            const orderIdDisplay = document.getElementById('orderIdDisplay');
            const orderTotalDisplay = document.getElementById('orderTotalDisplay');
            if (orderIdDisplay) orderIdDisplay.textContent = 'N/A';
            if (orderTotalDisplay) orderTotalDisplay.textContent = 'N/A';
            orderSuccessModal.classList.add('show');
            return;
        }

        // Display order info
        const orderIdDisplay = document.getElementById('orderIdDisplay');
        const orderTypeDisplay = document.getElementById('orderTypeDisplay');
        const orderTotalDisplay = document.getElementById('orderTotalDisplay');
        const qrCodeContainer = document.getElementById('orderQrCodeDisplay');
        const qrCodeSection = document.getElementById('qrCodeSection');
        const successMessage = document.getElementById('orderSuccessMessage');

        if (orderIdDisplay) {
            orderIdDisplay.textContent = order.id;
        }

        if (orderTypeDisplay) {
            const typeLabel = order.order_type === 'pickup' ? 'Pickup' : 'Delivery (3rd Party)';
            orderTypeDisplay.textContent = typeLabel;
        }

        if (orderTotalDisplay) {
            orderTotalDisplay.textContent = `₱${parseFloat(order.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        }

        // Only generate QR code for pickup orders
        const saveQrCodeBtn = document.getElementById('saveQrCodeBtn');
        if (order.order_type === 'pickup') {
            if (successMessage) {
                successMessage.textContent = 'Your order has been created. Please show this QR code to the admin when picking up.';
            }
            if (qrCodeSection) {
                qrCodeSection.style.display = 'block';
            }
            if (qrCodeContainer && typeof QRCode !== 'undefined') {
                qrCodeContainer.innerHTML = '';
                try {
                    new QRCode(qrCodeContainer, {
                        text: order.id,
                        width: 256,
                        height: 256,
                        colorDark: '#000000',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.H
                    });
                    
                    // Show save button after QR code is generated (wait a bit for canvas to render)
                    if (saveQrCodeBtn) {
                        setTimeout(() => {
                            saveQrCodeBtn.style.display = 'flex';
                            saveQrCodeBtn.onclick = () => saveQRCode(order.id);
                        }, 100);
                    }
                } catch (error) {
                    console.error('Error generating QR code:', error);
                    qrCodeContainer.innerHTML = '<p>QR code generation failed</p>';
                    if (saveQrCodeBtn) {
                        saveQrCodeBtn.style.display = 'none';
                    }
                }
            }
        } else {
            // Delivery order - no QR code
            if (successMessage) {
                successMessage.textContent = 'Your delivery order has been created. We will contact you soon through your provided social media or contact number!';
            }
            if (qrCodeSection) {
                qrCodeSection.style.display = 'none';
            }
            if (qrCodeContainer) {
                qrCodeContainer.innerHTML = '';
            }
            if (saveQrCodeBtn) {
                saveQrCodeBtn.style.display = 'none';
            }
        }

        // Show the modal
        orderSuccessModal.classList.add('show');
        console.log('Modal should be visible now');
    }

    if (closeOrderSuccessBtn) {
        closeOrderSuccessBtn.addEventListener('click', () => {
            orderSuccessModal.classList.remove('show');
        });
    }

    if (orderSuccessModal) {
        orderSuccessModal.addEventListener('click', (e) => {
            if (e.target === orderSuccessModal) {
                orderSuccessModal.classList.remove('show');
            }
        });
    }
});

window.CatalogCart = CatalogCart;
