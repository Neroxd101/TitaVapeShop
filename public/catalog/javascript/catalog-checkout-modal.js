/**
 * Catalog Checkout Modal
 * Handles checkout modal display, verified customer autofill, and order creation
 */

const CatalogCheckoutModal = {
    modal: null,
    closeButton: null,
    cancelBtn: null,
    form: null,
    checkoutTotal: null,

    /**
     * Initialize the checkout modal
     */
    async init() {
        const container = document.getElementById('checkout-modal-container');
        if (!container) {
            console.error('[Checkout Modal] Container not found');
            return false;
        }

        try {
            const response = await fetch('/catalog/catalog-checkout-modal.html');
            if (!response.ok) {
                console.error('[Checkout Modal] Failed to load modal HTML:', response.status);
                return false;
            }
            
            container.innerHTML = await response.text();
            
            // Get modal references
            this.modal = document.getElementById('checkoutModal');
            this.closeButton = document.getElementById('closeCheckoutModal');
            this.cancelBtn = document.getElementById('cancelCheckoutBtn');
            this.form = document.getElementById('checkoutForm');
            this.checkoutTotal = document.getElementById('checkoutTotal');

            if (!this.modal || !this.form) {
                console.error('[Checkout Modal] Modal elements not found');
                return false;
            }

            // Setup event listeners
            this.setupEventListeners();
            return true;
        } catch (error) {
            console.error('[Checkout Modal] Error loading modal:', error);
            return false;
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.close());
        }

        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => this.close());
        }

        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.close();
                }
            });
        }

        if (this.form) {
            this.form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleSubmit();
            });
        }
    },

    /**
     * Handle form submission
     */
    async handleSubmit() {
        const orderType = document.getElementById('orderType').value;
        const customerName = document.getElementById('customerName').value.trim();
        const contactNumber = document.getElementById('contactNumber').value.trim();
        const socialMedia = document.getElementById('socialMedia').value.trim();
        const customerEmail = document.getElementById('customerEmail').value.trim();

        // Validate contact number (11 digits)
        const digitsOnly = contactNumber.replace(/\D/g, '');
        if (digitsOnly.length !== 11) {
            alert('Contact number must be exactly 11 digits (e.g. 09123456789)');
            return;
        }

        // Validate email
        if (!customerEmail) {
            alert('Email is required');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerEmail)) {
            alert('Please enter a valid email address');
            return;
        }

        // Prepare order items
        if (!window.CatalogCart) {
            alert('Cart not available');
            return;
        }

        const items = window.CatalogCart.cart.map(item => ({
            id: item.id,
            name: item.name,
            category: item.category,
            price: item.sale_price,
            quantity: item.quantity
        }));

        const totalAmount = window.CatalogCart.getTotalAmount();

        // Disable submit button
        const submitBtn = document.getElementById('createOrderBtn');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Order...';
        let isRedirecting = false;

        try {
            const response = await fetch('/api/orders/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    customer_name: customerName,
                    contact_number: digitsOnly,
                    social_media: socialMedia || null,
                    customer_email: customerEmail,
                    order_type: orderType,
                    items: items,
                    total_amount: totalAmount
                })
            });

            const result = await response.json();

            // Authentication or verification required from server
            if (response.status === 401 || response.status === 403) {
                this.close();
                if (window.CustomerAuth) {
                    window.CustomerAuth.requireAuth(() => this.show(), result.error || 'Please sign in or verify your email to create an order.');
                } else {
                    alert(result.error || 'Please sign in with a verified account to place an order.');
                }
                return;
            }

            if (result.success && result.order) {
                isRedirecting = true;
                submitBtn.textContent = 'Redirecting to Order Status...';

                // Save to customer's local recent orders cache
                try {
                    let orders = JSON.parse(localStorage.getItem('tita_recent_orders') || '[]');
                    if (!Array.isArray(orders)) orders = [];
                    orders.unshift({
                        id: result.order.id,
                        order_type: result.order.order_type,
                        total_amount: result.order.total_amount,
                        status: result.order.status || 'pending',
                        created_at: result.order.created_at || new Date().toISOString(),
                        customer_name: result.order.customer_name
                    });
                    orders = orders.slice(0, 15);
                    localStorage.setItem('tita_recent_orders', JSON.stringify(orders));
                    if (window.CatalogOrdersModal) {
                        window.CatalogOrdersModal.updateBadge();
                    }
                } catch (e) {
                    console.warn('Failed to save recent order to localStorage:', e);
                }

                // Clear cart and reset form
                if (window.CatalogCart) {
                    window.CatalogCart.clearCart();
                }
                this.close();
                this.form.reset();

                // Direct to order status page
                const targetUrl = result.trackingUrl || `/order-status?id=${encodeURIComponent(result.order.id)}`;
                window.location.href = targetUrl;
                return;
            } else {
                // Friendly stock error message (409 from backend)
                if (response.status === 409 && result?.items?.length) {
                    const lines = result.items.map(i => {
                        const name = i.name || 'Item';
                        return `- ${name}: requested ${i.requested}, available ${i.available}`;
                    });
                    alert(`Some items are out of stock or not enough quantity:\n\n${lines.join('\n')}\n\nPlease update your cart and try again.`);
                } else {
                    alert('Failed to create order: ' + (result.error || 'Unknown error'));
                }
            }
        } catch (error) {
            console.error('Error creating order:', error);
            alert('Error creating order. Please try again.');
        } finally {
            if (!isRedirecting) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    },

    /**
     * Show the checkout modal
     */
    show() {
        if (!this.modal) {
            console.error('[Checkout Modal] Modal not initialized');
            return;
        }

        // Enforce verified customer account
        if (window.CustomerAuth && !window.CustomerAuth.currentUser) {
            window.CustomerAuth.requireAuth(() => this.show(), 'Please sign in or create a verified account to place your order.');
            return;
        }

        // Auto-fill verified customer info
        if (window.CustomerAuth && window.CustomerAuth.currentUser) {
            const user = window.CustomerAuth.currentUser;
            const nameInput = document.getElementById('customerName');
            const emailInput = document.getElementById('customerEmail');
            const phoneInput = document.getElementById('contactNumber');

            if (nameInput && !nameInput.value && user.full_name) {
                nameInput.value = user.full_name;
            }
            if (emailInput && user.email) {
                emailInput.value = user.email;
                emailInput.readOnly = true;
                emailInput.style.opacity = '0.9';
                emailInput.title = 'Verified customer email';
            }
            if (phoneInput && !phoneInput.value && user.contact_number) {
                phoneInput.value = user.contact_number;
            }
        }

        // Update total
        if (this.checkoutTotal && window.CatalogCart) {
            this.checkoutTotal.textContent = `₱${window.CatalogCart.getTotalAmount().toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        }

        this.modal.classList.add('show');
    },

    /**
     * Close the checkout modal
     */
    close() {
        if (this.modal) {
            this.modal.classList.remove('show');
        }
    }
};

// Expose globally
window.CatalogCheckoutModal = CatalogCheckoutModal;
