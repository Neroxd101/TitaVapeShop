/**
 * Customer Verify OTP Module
 * Frontend client module matching customer_verify_otp RPC and backend route
 */
const CustomerVerifyOtp = {
  /**
   * Verify OTP code for given email
   * @param {string} email
   * @param {string} code 6-digit code
   * @returns {Promise<{success: boolean, user?: object, message?: string, error?: string}>}
   */
  async verify(email, code) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').trim();

    if (!cleanEmail) {
      return { success: false, error: 'Email is required for verification.' };
    }
    if (cleanCode.length !== 6) {
      return { success: false, error: 'Please enter the complete 6-digit verification code.' };
    }

    try {
      const res = await fetch('/api/customer/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: cleanEmail, code: cleanCode })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification failed. Please check the code.');
      }
      return data;
    } catch (err) {
      console.error('[CustomerVerifyOtp] Verification error:', err);
      return { success: false, error: err.message || 'Verification failed.' };
    }
  },

  /**
   * Bind auto-submit and digit-only sanitization on an OTP input
   * @param {HTMLInputElement} inputEl
   * @param {Function} onSixDigitsEntered
   */
  bindOtpInput(inputEl, onSixDigitsEntered) {
    if (!inputEl) return;

    inputEl.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
      e.target.value = val;
      if (val.length === 6 && typeof onSixDigitsEntered === 'function') {
        onSixDigitsEntered(val);
      }
    });

    inputEl.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text');
      const digits = pasteData.replace(/\D/g, '').slice(0, 6);
      inputEl.value = digits;
      if (digits.length === 6 && typeof onSixDigitsEntered === 'function') {
        onSixDigitsEntered(digits);
      }
    });
  }
};

window.CustomerVerifyOtp = CustomerVerifyOtp;
