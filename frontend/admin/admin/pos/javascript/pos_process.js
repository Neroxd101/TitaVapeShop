// Logic for Sales Checkout (Transaction)
const SalesCreate = {
    setupEventListeners(state) {
        const checkoutForm = document.getElementById('checkoutForm');
        const completeSaleBtn = document.getElementById('completeSaleBtn');
        const confirmModal = document.getElementById('confirmModal');
        const closeConfirmModalBtn = document.getElementById('closeConfirmModalBtn');
        const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
        const proceedSaleBtn = document.getElementById('proceedSaleBtn');
        const successModal = document.getElementById('successModal');
        const closeSuccessModalBtn = document.getElementById('closeSuccessModalBtn');
        const closeSuccessBtn = document.getElementById('closeSuccessBtn');

        if (checkoutForm) {
            checkoutForm.addEventListener('submit', (e) => this.handleCompleteSale(e, state));
        } else if (completeSaleBtn) {
            completeSaleBtn.addEventListener('click', () => this.handleCompleteSale(null, state));
        }

        const closeConfirm = () => {
            confirmModal?.classList.remove('show');
            window._pendingSale = null;
        };
        closeConfirmModalBtn?.addEventListener('click', closeConfirm);
        cancelConfirmBtn?.addEventListener('click', closeConfirm);
        confirmModal?.addEventListener('click', (e) => {
            if (e.target === confirmModal) closeConfirm();
        });

        proceedSaleBtn?.addEventListener('click', () => {
            this.proceedWithSale();
        });

        const closeSuccess = () => {
            successModal?.classList.remove('show');
        };
        closeSuccessModalBtn?.addEventListener('click', closeSuccess);
        closeSuccessBtn?.addEventListener('click', closeSuccess);
        successModal?.addEventListener('click', (e) => {
            if (e.target === successModal) closeSuccess();
        });
    },

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

        let checkoutResult;

        // 1. Complete the sale atomically using server-verified prices
        try {
            const checkoutResponse = await fetch(checkoutUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Include cookies for authentication
                body: JSON.stringify({ 
                    items: state.cart.map(item => ({ id: item.id, qty: item.qty })),
                    cash,
                    customer_name: customerName,
                    customer_email: customerEmail
                })
            });

            checkoutResult = await checkoutResponse.json();

            if (!checkoutResult.success) {
                console.error('Checkout failed:', checkoutResult);
                let errorMsg = 'Failed to process sale.\n';
                if (checkoutResult.errors) {
                    errorMsg += checkoutResult.errors.map(e => `- ${e.name}: ${e.error}`).join('\n');
                } else {
                    errorMsg += checkoutResult.error || checkoutResult.message || 'Unknown error';
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

        const confirmedItems = checkoutResult.items || state.cart;
        const confirmedTotal = Number(checkoutResult.total);
        const confirmedCash = Number(checkoutResult.cash);
        const confirmedChange = Number(checkoutResult.change);

        // 2. Send email receipt if email is provided
        let emailSent = false;
        let emailError = false;

        if (customerEmail && window.SalesReceiptEmail?.sendReceipt) {
            const emailResult = await SalesReceiptEmail.sendReceipt({
                receiptUrl,
                customerEmail,
                customerName,
                items: confirmedItems,
                total: confirmedTotal,
                cash: confirmedCash,
                change: confirmedChange
            });
            emailSent = emailResult.emailSent;
            emailError = emailResult.emailError;
        }

        // Show success modal
        this.showSuccessModal(customerName, confirmedTotal, confirmedCash, confirmedChange, customerEmail, emailSent, emailError);

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
