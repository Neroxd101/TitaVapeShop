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
        const existingItem = this.cart.find(item => item.id === product.id);

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.cart.push({
                id: product.id,
                name: product.name,
                category: product.category,
                sale_price: product.sale_price,
                image: product.images && product.images.length > 0 ? product.images[0] : null,
                quantity: quantity
            });
        }

        this.saveCart();
        this.updateCartBadge();
    },

    /**
     * Remove product from cart
     * @param {string} productId - Product ID
     */
    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.id !== productId);
        this.saveCart();
        this.updateCartBadge();
    },

    /**
     * Update quantity of item in cart
     * @param {string} productId - Product ID
     * @param {number} quantity - New quantity
     */
    updateQuantity(productId, quantity) {
        const item = this.cart.find(item => item.id === productId);
        if (item) {
            if (quantity <= 0) {
                this.removeFromCart(productId);
            } else {
                item.quantity = quantity;
                this.saveCart();
            }
            this.updateCartBadge();
        }
    },

    /**
     * Clear entire cart
     */
    clearCart() {
        this.cart = [];
        this.saveCart();
        this.updateCartBadge();
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
            badge.style.display = total > 0 ? 'inline-block' : 'none';
        }
    },

    /**
     * Render cart items
     */
    renderCart() {
        const cartItems = document.getElementById('cartItems');
        if (!cartItems) return;

        if (this.cart.length === 0) {
            cartItems.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
            return;
        }

        cartItems.innerHTML = this.cart.map(item => {
            const imageUrl = this.getImageUrl(item.image);
            return `
                <div class="cart-item" data-id="${item.id}">
                    <img src="${imageUrl}" alt="${item.name}" class="cart-item-image" onerror="this.src='/img/placeholder-product.png'">
                    <div class="cart-item-info">
                        <h4>${this.escapeHtml(item.name)}</h4>
                        <p class="cart-item-category">${this.escapeHtml(item.category)}</p>
                        <p class="cart-item-price">₱${parseFloat(item.sale_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div class="cart-item-controls">
                        <div class="quantity-controls">
                            <button class="qty-btn" onclick="CatalogCart.updateQuantity('${item.id}', ${item.quantity - 1})">-</button>
                            <span class="qty-value">${item.quantity}</span>
                            <button class="qty-btn" onclick="CatalogCart.updateQuantity('${item.id}', ${item.quantity + 1})">+</button>
                        </div>
                        <button class="remove-btn" onclick="CatalogCart.removeFromCart('${item.id}')">
                            <svg viewBox="0 0 24 24" width="18" height="18">
                                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Update total
        const cartTotal = document.getElementById('cartTotal');
        if (cartTotal) {
            cartTotal.textContent = `₱${this.getTotalAmount().toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        }
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
    const closeOrderSuccessModal = document.getElementById('closeOrderSuccessModal');
    const closeOrderSuccessBtn = document.getElementById('closeOrderSuccessBtn');

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
                } catch (error) {
                    console.error('Error generating QR code:', error);
                    qrCodeContainer.innerHTML = '<p>QR code generation failed</p>';
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
        }

        // Show the modal
        orderSuccessModal.classList.add('show');
        console.log('Modal should be visible now');
    }

    if (closeOrderSuccessModal) {
        closeOrderSuccessModal.addEventListener('click', () => {
            orderSuccessModal.classList.remove('show');
        });
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
