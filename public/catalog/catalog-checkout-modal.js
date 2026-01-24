/**
 * Catalog Checkout Modal
 * Handles checkout modal display and order creation
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

        // Validate contact number (11 digits)
        const digitsOnly = contactNumber.replace(/\D/g, '');
        if (digitsOnly.length !== 11) {
            alert('Contact number must be exactly 11 digits');
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
                // Show success modal
                if (window.CatalogOrderSuccessModal) {
                    window.CatalogOrderSuccessModal.show(result.order);
                }
                window.CatalogCart.clearCart();
                this.close();
                this.form.reset();
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
    },

    /**
     * Show the checkout modal
     */
    show() {
        if (!this.modal) {
            console.error('[Checkout Modal] Modal not initialized');
            return;
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
