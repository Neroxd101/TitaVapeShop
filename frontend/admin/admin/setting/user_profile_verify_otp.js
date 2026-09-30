// Profile updates verify the OTP inside their protected backend routes.
// This dialog submits the code with the selected update rather than consuming it twice.
window.UserProfileVerifyOtp = (() => {
    let currentVerify;
    const setLoading = (button, loading) => window.settingsPage.setLoading(button, loading);

    /**
     * Show OTP Verification Modal
     */
    function showOTPModal(title, onVerify) {
        currentVerify = onVerify;
        // Create modal if it doesn't exist
        let modal = document.getElementById('otpVerificationModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'otpVerificationModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal modal-small">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="modal-close" id="closeOtpModal">
                            <svg viewBox="0 0 24 24">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                            </svg>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div id="otpModalError" class="alert alert-error" style="margin-bottom: 16px; display: none;">
                            <svg viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                            </svg>
                            <span id="otpModalErrorText"></span>
                        </div>
                        <div id="otpModalSuccess" class="alert alert-success" style="margin-bottom: 16px; display: none;">
                            <svg viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                            <span id="otpModalSuccessText"></span>
                        </div>
                        <p style="color: var(--text-secondary); margin-bottom: 20px;">
                            Enter the 6-digit OTP code sent to your email address.
                        </p>
                        <form id="otpVerifyForm">
                            <div class="form-group">
                                <label for="otpInput">OTP Code</label>
                                <div class="input-wrapper">
                                    <input type="text" id="otpInput" name="otp" placeholder="000000" maxlength="6" pattern="[0-9]{6}" required autocomplete="one-time-code" style="text-align: center; font-size: 24px; letter-spacing: 8px; font-family: 'Courier New', monospace; font-weight: 600;">
                                </div>
                            </div>
                            <button type="submit" class="btn btn-primary btn-full" id="verifyOtpBtn">
                                <span class="btn-text">Verify OTP</span>
                                <div class="spinner"></div>
                            </button>
                        </form>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Close button
            document.getElementById('closeOtpModal').addEventListener('click', closeOTPModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeOTPModal();
            });

            // OTP form handler
            document.getElementById('otpVerifyForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const otp = document.getElementById('otpInput').value.trim();
                if (otp.length !== 6) {
                    showModalError('Please enter a valid 6-digit OTP code');
                    return;
                }

                const btn = document.getElementById('verifyOtpBtn');
                setLoading(btn, true);

                try {
                    await currentVerify(otp);
                } catch (error) {
                    showModalError(error.message || 'Verification failed');
                } finally {
                    setLoading(btn, false);
                }
            });

            // Auto-format OTP input
            document.getElementById('otpInput').addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
            });
        } else {
            // Update title if modal exists
            modal.querySelector('.modal-header h3').textContent = title;
            const errorAlert = modal.querySelector('#otpModalError');
            if (errorAlert) {
                errorAlert.style.display = 'none';
                modal.querySelector('#otpModalErrorText').textContent = '';
            }
            const successAlert = modal.querySelector('#otpModalSuccess');
            if (successAlert) {
                successAlert.style.display = 'none';
                modal.querySelector('#otpModalSuccessText').textContent = '';
            }
        }

        modal.classList.add('show');
        setTimeout(() => document.getElementById('otpInput')?.focus(), 100);

        return modal;
    }

    /**
     * Close OTP Modal
     */
    function closeOTPModal() {
        const modal = document.getElementById('otpVerificationModal');
        if (modal) {
            modal.classList.remove('show');
            document.getElementById('otpInput').value = '';
            const errorAlert = modal.querySelector('#otpModalError');
            if (errorAlert) {
                errorAlert.style.display = 'none';
                modal.querySelector('#otpModalErrorText').textContent = '';
            }
            const successAlert = modal.querySelector('#otpModalSuccess');
            if (successAlert) {
                successAlert.style.display = 'none';
                modal.querySelector('#otpModalSuccessText').textContent = '';
            }
        }
    }

    function showModalSuccess(message) {
        const successAlert = document.getElementById('otpModalSuccess');
        const successText = document.getElementById('otpModalSuccessText');
        const errorAlert = document.getElementById('otpModalError');
        if (errorAlert) errorAlert.style.display = 'none';
        if (successAlert && successText) {
            successText.textContent = message;
            successAlert.className = 'alert alert-success show';
            successAlert.style.display = 'flex';
        }
    }

    function showModalError(message) {
        const errorAlert = document.getElementById('otpModalError');
        const errorText = document.getElementById('otpModalErrorText');
        const successAlert = document.getElementById('otpModalSuccess');
        if (successAlert) successAlert.style.display = 'none';
        if (errorAlert && errorText) {
            errorText.textContent = message;
            errorAlert.className = 'alert alert-error show';
            errorAlert.style.display = 'flex';
        }
    }

    return { show: showOTPModal, close: closeOTPModal, showSuccess: showModalSuccess, showError: showModalError };
})();
