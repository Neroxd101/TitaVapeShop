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
            this.updatePaymentFields();
            document.getElementById('paymentReference').addEventListener('input', () => {
                this.referenceScan = null;
                this.detectedReference = null;
                document.getElementById('paymentReferenceStatus').textContent = '';
            });
            checkoutForm.addEventListener('change', (event) => {
                if (event.target.name === 'paymentMethod') this.updatePaymentFields();
                if (event.target.id !== 'paymentUpload') return;
                const file = event.target.files[0];
                document.getElementById('paymentUploadName').textContent = file?.name || '';
                if (file) {
                    this.closePaymentCamera();
                    this.setCapturedPhoto(null);
                }
                this.updatePaymentPhotoPreview(file);
            });
            document.getElementById('paymentCapture').addEventListener('click', () => this.openPaymentCamera());
            document.getElementById('closePaymentCamera').addEventListener('click', () => this.closePaymentCamera());
            document.getElementById('removePaymentPhoto').addEventListener('click', () => {
                this.clearPaymentUpload();
                this.setCapturedPhoto(null);
            });
            document.getElementById('takePaymentPhoto').addEventListener('click', () => this.takePaymentPhoto());
            document.getElementById('paymentCameraVideo').addEventListener('playing', () => {
                document.getElementById('takePaymentPhoto').disabled = false;
            });
            const paymentModal = document.getElementById('paymentModal');
            new MutationObserver(() => {
                if (!paymentModal.classList.contains('show')) this.closePaymentCamera();
            }).observe(paymentModal, { attributes: true, attributeFilter: ['class'] });
            document.getElementById('clearCartBtn').addEventListener('click', () => {
                this.closePaymentCamera();
                this.clearPaymentUpload();
                this.setCapturedPhoto(null);
                document.getElementById('paymentReference').value = '';
            });
            window.addEventListener('pagehide', () => this.closePaymentCamera());
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

    updatePaymentFields() {
        const online = document.querySelector('#checkoutForm [name="paymentMethod"]:checked')?.value === 'online';
        const cashFields = document.getElementById('cashPaymentFields');
        const onlineFields = document.getElementById('onlinePaymentFields');
        if (cashFields) cashFields.hidden = cashFields.disabled = online;
        if (onlineFields) onlineFields.hidden = onlineFields.disabled = !online;
        if (!online) this.closePaymentCamera();
    },

    async openPaymentCamera() {
        const panel = document.getElementById('paymentCameraPanel');
        const status = document.getElementById('paymentCameraStatus');
        const video = document.getElementById('paymentCameraVideo');
        if (this.cameraRequest) return;

        if (!navigator.mediaDevices?.getUserMedia) {
            status.textContent = 'Camera access requires HTTPS and a browser with camera support.';
            return;
        }

        const request = {};
        this.cameraRequest = request;
        panel.hidden = false;
        this.updatePaymentPreviewVisibility();
        status.textContent = 'Waiting for camera access…';
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
            if (this.cameraRequest !== request) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }
            video.srcObject = stream;
            await video.play();
            if (this.cameraRequest === request) status.textContent = '';
        } catch (error) {
            if (this.cameraRequest !== request) return;
            this.closePaymentCamera();
            status.textContent = error.name === 'NotAllowedError'
                ? 'Camera access was denied. Allow camera access in your browser and try again.'
                : 'The camera could not start. Check that a camera is connected and available.';
        }
    },

    closePaymentCamera() {
        this.cameraRequest = null;
        const video = document.getElementById('paymentCameraVideo');
        if (!video) return;
        video.srcObject?.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        document.getElementById('paymentCameraPanel').hidden = true;
        this.updatePaymentPreviewVisibility();
        document.getElementById('takePaymentPhoto').disabled = true;
        document.getElementById('paymentCameraStatus').textContent = '';
    },

    takePaymentPhoto() {
        const video = document.getElementById('paymentCameraVideo');
        if (!video.srcObject || video.readyState < 2 || !video.videoWidth) return;
        try {
            const photo = this.encodePaymentPhoto(video, video.videoWidth, video.videoHeight);
            this.clearPaymentUpload();
            this.setCapturedPhoto(photo);
            this.closePaymentCamera();
        } catch {
            document.getElementById('paymentCameraStatus').textContent = 'Could not capture the photo. Try again.';
        }
    },

    clearPaymentUpload() {
        document.getElementById('paymentUpload').value = '';
        document.getElementById('paymentUploadName').textContent = '';
    },

    setCapturedPhoto(photo) {
        this.capturedPhoto = photo;
        this.updatePaymentPhotoPreview();
    },

    updatePaymentPhotoPreview(file) {
        if (this.paymentPreviewUrl) URL.revokeObjectURL(this.paymentPreviewUrl);
        this.paymentPreviewUrl = file ? URL.createObjectURL(file) : null;
        const photo = this.paymentPreviewUrl || this.capturedPhoto;
        const preview = document.getElementById('paymentPhotoPreview');
        if (photo) preview.src = photo;
        else preview.removeAttribute('src');
        this.updatePaymentPreviewVisibility();
        document.getElementById('removePaymentPhoto').hidden = !photo;
        this.scanPaymentReference(file || this.capturedPhoto);
    },

    updatePaymentPreviewVisibility() {
        const cameraOpen = !document.getElementById('paymentCameraPanel').hidden;
        const preview = document.getElementById('paymentPhotoPreview');
        const hasPhoto = preview.hasAttribute('src');
        preview.hidden = cameraOpen || !hasPhoto;
        document.getElementById('paymentQrInstructions').hidden = cameraOpen || hasPhoto;
    },

    async scanPaymentReference(photo) {
        const input = document.getElementById('paymentReference');
        const status = document.getElementById('paymentReferenceStatus');
        this.referenceScan = null;
        if (this.detectedReference === input.value) input.value = '';
        this.detectedReference = null;
        status.textContent = '';
        if (!photo || input.value.trim()) return;

        const scan = {};
        this.referenceScan = scan;
        status.textContent = 'Reading reference number…';
        try {
            const reference = await window.PaymentReferenceScanner.read(photo);
            if (this.referenceScan !== scan) return;
            if (reference) {
                input.value = this.detectedReference = reference;
                status.textContent = 'Check the detected number against the photo.';
            } else {
                status.textContent = 'Reference number not found. You can enter it manually.';
            }
        } catch {
            if (this.referenceScan === scan) {
                status.textContent = 'Could not read the reference number. You can enter it manually.';
            }
        }
    },

    encodePaymentPhoto(source, width, height) {
        const scale = Math.min(1, 1200 / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
        const photo = canvas.toDataURL('image/jpeg', 0.75);
        if (photo.length > 900000) throw new Error('Payment photo is too large.');
        return photo;
    },

    async readPaymentPhoto(file) {
        const image = await createImageBitmap(file);
        try {
            return this.encodePaymentPhoto(image, image.width, image.height);
        } finally {
            image.close();
        }
    },

    async handleCompleteSale(e, state) {
        e?.preventDefault?.();

        // Handle case where state is passed as first arg (fallback)
        if (!state && e && e.cart) {
            state = e;
            e = null;
        }

        if (!state || !state.cart.length) {
            alert('Add items to the cart first.');
            return;
        }

        const total = Math.round(state.cart.reduce((sum, item) => sum + item.qty * item.price, 0) * 100) / 100;
        const cashInput = document.getElementById('cashInput');

        const online = document.querySelector('#checkoutForm [name="paymentMethod"]:checked')?.value === 'online';
        const cash = online ? total : (parseFloat(cashInput?.value || '0') || 0);

        if (cash < total) {
            alert('Cash is not enough to complete the sale.');
            return;
        }

        const customerName = document.getElementById('customerName')?.value || 'Walk-in';
        const change = cash - total;

        // Show confirmation modal instead of native confirm
        const reference = online ? document.getElementById('paymentReference').value.trim() : null;
        const photo = online && document.getElementById('paymentUpload').files[0];
        const capturedPhoto = online ? this.capturedPhoto : null;
        this.closePaymentCamera();
        this.showConfirmModal(customerName, total, cash, change, state, { online, reference, photo, capturedPhoto });
    },

    showConfirmModal(customerName, total, cash, change, state, payment) {
        const modal = document.getElementById('confirmModal');
        if (!modal) return;

        // Populate fields
        document.getElementById('confirmCustomer').textContent = customerName;
        document.getElementById('confirmTotal').textContent = SalesCart.formatCurrencySafe(total);
        document.getElementById('confirmCash').textContent = SalesCart.formatCurrencySafe(cash);
        document.getElementById('confirmChange').textContent = SalesCart.formatCurrencySafe(change);

        document.getElementById('confirmPaymentLabel').textContent = payment.online ? 'GCash:' : 'Cash:';
        document.getElementById('confirmChangeRow').hidden = payment.online;

        const items = state.cart.map(item => ({
            id: item.id,
            qty: item.qty,
            selected_variation: item.selected_variation || null
        }));
        window._pendingSale = { customerName, cash, state, items, payment };

        modal.classList.add('show');
    },

    async proceedWithSale() {
        if (this.isProcessing) return; // Prevent duplicate execution from double clicks
        
        const pending = window._pendingSale;
        if (!pending) return;

        this.isProcessing = true; // Lock processing

        const { customerName, cash, state, items, payment } = pending;
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
            if (!payment.proofUrl && (payment.photo || payment.capturedPhoto)) {
                try {
                    const photo = payment.capturedPhoto || await this.readPaymentPhoto(payment.photo);
                    payment.proofUrl = await window.CloudinaryService.uploadReceipt(photo);
                } catch (error) {
                    console.error('Payment photo upload failed:', error);
                    alert('Could not upload the payment photo. Retry, or return to the cart to change or remove it.');
                    proceedBtn?.classList.remove('loading');
                    if (proceedBtn) proceedBtn.disabled = false;
                    this.isProcessing = false;
                    return;
                }
            }
            const checkoutResponse = await fetch(checkoutUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Include cookies for authentication
                body: JSON.stringify({ 
                    items,
                    cash,
                    ...(payment.online && { payment_method: "online", payment_reference: payment.reference, payment_proof: payment.proofUrl }),
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
                paymentMethod: payment.online ? 'online' : 'cash',
                change: confirmedChange
            });
            emailSent = emailResult.emailSent;
            emailError = emailResult.emailError;
        }

        // Show success modal
        this.showSuccessModal(customerName, confirmedTotal, confirmedCash, confirmedChange, customerEmail, emailSent, emailError, payment.online);

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
        form?.reset();
        this.clearPaymentUpload();
        this.setCapturedPhoto(null);
        this.updatePaymentFields();
        SalesCart.updateCartUI(state);

        // Also reload products to get fresh stock counts from server since we just deducted
        await SalesLoad.loadProducts(state);
        
        this.isProcessing = false; // Reset lock on successful completion
    },

    showSuccessModal(customerName, total, cash, change, email, emailSent, emailError, online) {
        const modal = document.getElementById('successModal');
        if (!modal) return;

        // Populate modal data
        document.getElementById('successCustomer').textContent = customerName || 'Walk-in';
        document.getElementById('successTotal').textContent = SalesCart.formatCurrencySafe(total);
        document.getElementById('successCash').textContent = SalesCart.formatCurrencySafe(cash);
        document.getElementById('successChange').textContent = SalesCart.formatCurrencySafe(change);

        document.getElementById('successPaymentLabel').textContent = online ? 'GCash:' : 'Cash:';
        document.getElementById('successChangeRow').hidden = online;

        // Show email status if applicable
        const emailStatus = document.getElementById('successEmailStatus');
        if (emailStatus) {
            if (email) {
                if (emailSent) {
                    emailStatus.textContent = `✓ Invoice sent to ${email}`;
                    emailStatus.className = 'success-email-status sent';
                } else if (emailError) {
                    emailStatus.textContent = `⚠ Failed to send invoice to ${email}`;
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
        const paymentModal = document.getElementById('paymentModal');
        if (paymentModal) {
            paymentModal.classList.remove('show');
        }
    }
};
