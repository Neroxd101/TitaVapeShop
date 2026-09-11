/**
 * Customer Check Phone Module
 * Frontend client module matching customer_check_phone RPC and backend route
 */
const CustomerCheckPhone = {
  /**
   * Check if phone number is already registered
   * @param {string} phone
   * @param {string|null} excludeUserId
   * @returns {Promise<{success: boolean, exists: boolean}>}
   */
  async check(phone, excludeUserId = null) {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) return { success: false, exists: false };

    try {
      const resolvedExclude = typeof excludeUserId === 'function' ? excludeUserId() : excludeUserId;
      const excludeParam = (resolvedExclude && typeof resolvedExclude === 'string') 
        ? `&exclude_user_id=${encodeURIComponent(resolvedExclude.trim())}` 
        : '';
      const res = await fetch(`/api/customer/check-phone?phone=${encodeURIComponent(cleanPhone)}${excludeParam}`);
      return await res.json();
    } catch (err) {
      console.error('[CustomerCheckPhone] Error checking phone:', err);
      return { success: false, exists: false, error: err.message };
    }
  },

  /**
   * Attach live validation to phone input element
   * @param {HTMLInputElement} inputEl
   * @param {HTMLElement} errorEl
   * @param {Function} [onExisting]
   * @param {string|null} [excludeUserId]
   */
  attachLiveValidation(inputEl, errorEl, onExisting = null, excludeUserId = null) {
    if (!inputEl) return;

    inputEl.addEventListener('blur', async () => {
      const val = inputEl.value.replace(/\D/g, '');
      if (!val || val.length !== 11) return;

      const data = await this.check(val, excludeUserId);
      if (data.success && data.exists) {
        if (errorEl) {
          errorEl.textContent = 'This mobile number already exists. Please use another number or sign in.';
          errorEl.style.display = 'block';
        }
        inputEl.style.borderColor = 'var(--error, #ff4757)';
        if (typeof onExisting === 'function') onExisting(val);
      } else {
        if (errorEl && errorEl.textContent.includes('mobile number already exists')) {
          errorEl.style.display = 'none';
          errorEl.textContent = '';
        }
        inputEl.style.borderColor = '';
      }
    });

    inputEl.addEventListener('input', () => {
      inputEl.style.borderColor = '';
      if (errorEl && errorEl.textContent.includes('mobile number already exists')) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
      }
    });
  }
};

window.CustomerCheckPhone = CustomerCheckPhone;
