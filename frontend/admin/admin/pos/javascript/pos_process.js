// Logic for Sales Checkout (Transaction)
const SalesCreate = {

    async handleCompleteSale(e, state) {
        if (e) e.preventDefault();

        // Handle case where state is passed as first arg (fallback)
        if (!state && e && e.cart) {
            state = e;
            e = null;
        }

        if (!state || !state.cart.length) {
            alert('Add items to the cart first.');
            return;
        }

        const total = state.cart.reduce((sum, item) => sum + item.qty * item.price, 0);
        const cashInput = document.getElementById('cashInput');

        const cash = parseFloat(cashInput?.value || '0') || 0;

        if (cash < total) {
            alert('Cash is not enough to complete the sale.');
            return;
        }

        const customerName = document.getElementById('customerName')?.value || 'Walk-in';
        const change = cash - total;

        // Show confirmation modal instead of native confirm
        this.showConfirmModal(customerName, total, cash, change, state);
    },

    showConfirmModal(customerName, total, cash, change, state) {
        const modal = document.getElementById('confirmModal');
        if (!modal) return;

        // Populate fields
        document.getElementById('confirmCustomer').textContent = customerName;
        document.getElementById('confirmTotal').textContent = SalesCart.formatCurrencySafe(total);
        document.getElementById('confirmCash').textContent = SalesCart.formatCurrencySafe(cash);
        document.getElementById('confirmChange').textContent = SalesCart.formatCurrencySafe(change);

        // Store state/current sale info on the modal or a global for the "Proceed" button
        window._pendingSale = { customerName, total, cash, change, state };

        modal.classList.add('show');
    },

    async proceedWithSale() {
        if (this.isProcessing) return; // Prevent duplicate execution from double clicks
        
        const pending = window._pendingSale;
        if (!pending) return;

        this.isProcessing = true; // Lock processing

        const { customerName, total, cash, change, state } = pending;
        const form = document.getElementById('checkoutForm');
        const checkoutUrl = form?.dataset.apiRouteCheckout || '/pos/pos_process';
        const receiptUrl = form?.dataset.apiRouteReceipt || '/pos/email_send_receipt';
        const customerEmail = document.getElementById('customerEmail')?.value?.trim();

        const proceedBtn = document.getElementById('proceedSaleBtn');
        if (proceedBtn) {
            proceedBtn.classList.add('loading');
            proceedBtn.disabled = true;
        }

        // 1. Deduct Inventory (Checkout)
        try {
            const checkoutResponse = await fetch(checkoutUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Include cookies for authentication
                body: JSON.stringify({ 
                    items: state.cart,
                    customer_name: customerName,
                    customer_email: customerEmail
                })
            });

            const checkoutResult = await checkoutResponse.json();

            if (!checkoutResult.success) {
                console.error('Checkout failed:', checkoutResult);
                let errorMsg = 'Failed to process sale (Inventory Error).\n';
                if (checkoutResult.errors) {
                    errorMsg += checkoutResult.errors.map(e => `- ${e.name}: ${e.error}`).join('\n');
                } else {
                    errorMsg += checkoutResult.message || 'Unknown error';
                }
                alert(errorMsg);
                if (proceedBtn) {
                    proceedBtn.classList.remove('loading');
                    proceedBtn.disabled = false;
                }
                this.isProcessing = false; // Reset lock on error
                return; // Stop processing
            }
        } catch (error) {
            console.error('Checkout error:', error);
            alert('Failed to process sale due to network or server error.');
            if (proceedBtn) {
                proceedBtn.classList.remove('loading');
                proceedBtn.disabled = false;
            }
            this.isProcessing = false; // Reset lock on network/server error
            return;
        }

        // 2. Send email receipt if email is provided
        let emailSent = false;
        let emailError = false;

        if (customerEmail) {
            try {
                const emailResponse = await fetch(receiptUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        customerEmail: customerEmail,
                        customerName: customerName,
                        items: state.cart,
                        total,
                        cash,
                        change,
                        saleDate: new Date().toLocaleString('en-PH', {
                            timeZone: 'Asia/Manila',
                            dateStyle: 'medium',
                            timeStyle: 'short'
                        })
                    })
                });

                await emailResponse.json();
                emailSent = emailResponse.ok;
                emailError = !emailResponse.ok;
            } catch (error) {
                console.error('Error sending email:', error);
                emailError = true;
            }
        }

        // Show success modal
        this.showSuccessModal(customerName, total, cash, change, customerEmail, emailSent, emailError);

        // Reset pending sale
        window._pendingSale = null;
        const confirmModal = document.getElementById('confirmModal');
        if (confirmModal) confirmModal.classList.remove('show');

        if (proceedBtn) {
            proceedBtn.classList.remove('loading');
            proceedBtn.disabled = false;
        }

        // Transaction is now logged server-side in sales_process route (like orders)

        // Reset cart
        state.cart = [];
        const cashInput = document.getElementById('cashInput');
        if (cashInput) cashInput.value = '';
        const nameInput = document.getElementById('customerName');
        if (nameInput) nameInput.value = '';
        const emailInput = document.getElementById('customerEmail');
        if (emailInput) emailInput.value = '';

        SalesCart.updateCartUI(state);

        // Also reload products to get fresh stock counts from server since we just deducted
        await SalesLoad.loadProducts(state);
        
        this.isProcessing = false; // Reset lock on successful completion
    },

    showSuccessModal(customerName, total, cash, change, email, emailSent, emailError) {
        const modal = document.getElementById('successModal');
        if (!modal) return;

        // Populate modal data
        document.getElementById('successCustomer').textContent = customerName || 'Walk-in';
        document.getElementById('successTotal').textContent = SalesCart.formatCurrencySafe(total);
        document.getElementById('successCash').textContent = SalesCart.formatCurrencySafe(cash);
        document.getElementById('successChange').textContent = SalesCart.formatCurrencySafe(change);

        // Show email status if applicable
        const emailStatus = document.getElementById('successEmailStatus');
        if (emailStatus) {
            if (email) {
                if (emailSent) {
                    emailStatus.textContent = `✓ Receipt sent to ${email}`;
                    emailStatus.className = 'success-email-status sent';
                } else if (emailError) {
                    emailStatus.textContent = `⚠ Failed to send receipt to ${email}`;
                    emailStatus.className = 'success-email-status failed';
                }
            } else {
                emailStatus.textContent = '';
                emailStatus.className = 'success-email-status';
            }
        }

        // Show modal
        modal.classList.add('show');

        // Close cart modal
        const cartModal = document.getElementById('cartModal');
        if (cartModal) {
            cartModal.classList.remove('show');
        }
    }
};
