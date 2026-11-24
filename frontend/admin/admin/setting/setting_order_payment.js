window.settingOrderPayment = {
    async setup() {
        const form = document.getElementById('orderPaymentSettingsForm');
        const status = document.getElementById('orderPaymentSettingsStatus');
        const accountName = document.getElementById('orderPaymentAccountName');
        const accountNumber = document.getElementById('orderPaymentAccountNumber');
        const qrFile = document.getElementById('orderPaymentQrFile');
        const preview = document.getElementById('orderPaymentQrPreview');
        const saveButton = document.getElementById('saveOrderPaymentBtn');
        let savedImage;
        let previewUrl;
        const validImage = file =>
            ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) && file.size <= 512 * 1024;
        const imageError = 'Select a PNG, JPG, or WebP QR image up to 512 KB.';

        status.textContent = 'Loading payment details…';
        try {
            const response = await fetch('/api/order-status/payment-details');
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error);
            accountName.value = result.data.account_name;
            accountNumber.value = result.data.account_number.replace(/[ -]/g, '');
            savedImage = result.data.qr_image;
            preview.src = savedImage;
            form.hidden = false;
            status.textContent = '';
        } catch {
            status.textContent = 'Could not load payment details. Reload the page to try again.';
            return;
        }

        qrFile.addEventListener('change', async () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = null;
            preview.src = savedImage;
            status.textContent = '';
            const file = qrFile.files[0];
            if (!file) return;
            if (!validImage(file)) {
                status.textContent = imageError;
                return;
            }

            const url = URL.createObjectURL(file);
            previewUrl = url;
            preview.src = url;
            try {
                await preview.decode();
            } catch {
                if (previewUrl !== url) return;
                URL.revokeObjectURL(url);
                previewUrl = null;
                preview.src = savedImage;
                status.textContent = 'Could not open the QR image.';
            }
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (saveButton.disabled) return;
            const file = qrFile.files[0];
            const name = accountName.value.trim();
            const number = accountNumber.value.trim();
            window.settingsPage.setLoading(saveButton, true);
            status.textContent = '';

            try {
                let image = savedImage;
                if (file) {
                    if (!validImage(file)) throw new Error(imageError);
                    image = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = () => reject(new Error('Could not read the QR image.'));
                        reader.readAsDataURL(file);
                    });
                    const imagePreview = new Image();
                    imagePreview.src = image;
                    await imagePreview.decode().catch(() => { throw new Error('Could not open the QR image.'); });
                }

                const response = await fetch('/api/settings/order-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({ account_name: name, account_number: number, qr_image: image })
                });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.error || 'Could not save the payment details.');
                savedImage = image;
                if (!qrFile.files[0] || qrFile.files[0] === file) {
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    previewUrl = null;
                    preview.src = savedImage;
                    qrFile.value = '';
                }
                status.textContent = 'Payment details saved.';
            } catch (error) {
                status.textContent = error.message;
            } finally {
                window.settingsPage.setLoading(saveButton, false);
            }
        });
    }
};
