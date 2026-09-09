/**
 * Customer Generate OTP Module
 * Frontend client module matching customer_generate_otp RPC and backend route
 */
const CustomerGenerateOtp = {
  timerInterval: null,

  /**
   * Resend a fresh 6-digit OTP code to the given email
   * @param {string} email
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  async resend(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'Email address is required.' };
    }

    try {
      const res = await fetch('/api/customer/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to resend verification code.');
      }
      return data;
    } catch (err) {
      console.error('[CustomerGenerateOtp] Resend error:', err);
      return { success: false, error: err.message || 'Failed to resend code.' };
    }
  },

  /**
   * Start a countdown on the resend button
   * @param {number} seconds
   * @param {HTMLButtonElement} buttonEl
   * @param {HTMLElement} countdownEl
   */
  startCountdown(seconds, buttonEl, countdownEl) {
    if (!buttonEl) return;

    clearInterval(this.timerInterval);
    buttonEl.disabled = true;

    let remaining = seconds;
    if (countdownEl) countdownEl.textContent = `(${remaining}s)`;

    this.timerInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(this.timerInterval);
        buttonEl.disabled = false;
        if (countdownEl) countdownEl.textContent = '';
      } else {
        if (countdownEl) countdownEl.textContent = `(${remaining}s)`;
      }
    }, 1000);
  },

  /**
   * Stop any active timer
   */
  clearTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
};

window.CustomerGenerateOtp = CustomerGenerateOtp;
