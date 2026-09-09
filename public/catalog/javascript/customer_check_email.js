/**
 * Customer Check Email Module
 * Frontend client module matching customer_check_email RPC and backend route
 */
const CustomerCheckEmail = {
  /**
   * Check if email is already registered
   * @param {string} email
   * @param {string|null} excludeUserId
   * @returns {Promise<{success: boolean, exists: boolean, is_verified?: boolean}>}
   */
  async check(email, excludeUserId = null) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return { success: false, exists: false };

    try {
      const excludeParam = excludeUserId ? `&exclude_user_id=${encodeURIComponent(excludeUserId)}` : '';
      const res = await fetch(`/api/customer/check-email?email=${encodeURIComponent(cleanEmail)}${excludeParam}`);
      return await res.json();
    } catch (err) {
      console.error('[CustomerCheckEmail] Error checking email:', err);
      return { success: false, exists: false, error: err.message };
    }
  },

  /**
   * Attach live validation to email input element
   * @param {HTMLInputElement} inputEl
   * @param {HTMLElement} errorEl
   * @param {Function} [onExisting]
   * @param {string|null} [excludeUserId]
   */
  attachLiveValidation(inputEl, errorEl, onExisting = null, excludeUserId = null) {
    if (!inputEl) return;

    inputEl.addEventListener('blur', async () => {
      const val = inputEl.value.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!val || !emailRegex.test(val)) return;

      const data = await this.check(val, excludeUserId);
      if (data.success && data.exists) {
        if (errorEl) {
          errorEl.textContent = 'This email already exists. Please sign in or use another email.';
          errorEl.style.display = 'block';
        }
        inputEl.style.borderColor = 'var(--error, #ff4757)';
        if (typeof onExisting === 'function') onExisting(val);
      } else {
        if (errorEl && errorEl.textContent.includes('already exists')) {
          errorEl.style.display = 'none';
          errorEl.textContent = '';
        }
        inputEl.style.borderColor = '';
      }
    });

    inputEl.addEventListener('input', () => {
      inputEl.style.borderColor = '';
      if (errorEl && errorEl.textContent.includes('already exists')) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
      }
    });
  }
};

window.CustomerCheckEmail = CustomerCheckEmail;
