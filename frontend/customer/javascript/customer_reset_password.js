/**
 * Customer Reset Password Module
 * Frontend client module matching customer_reset_password RPC and backend routes
 */

const CustomerResetPassword = {
  /**
   * Request password reset code
   * @param {string} email
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  async requestReset(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'Email address is required.' };
    }

    try {
      const res = await fetch('/api/customer/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        return {
          success: false,
          error: data?.error || 'Failed to send reset code. Please try again.'
        };
      }

      return {
        success: true,
        message: data?.message || 'A 6-digit verification code has been sent to your email.'
      };
    } catch (err) {
      console.error('[CustomerResetPassword] Request error:', err);
      return {
        success: false,
        error: err.message || 'Network error occurred while requesting reset code.'
      };
    }
  },

  /**
   * Verify the 6-digit OTP code before setting new password
   * @param {string} email
   * @param {string} otpCode
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  async verifyCode(email, otpCode) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (otpCode || '').trim();

    if (!cleanEmail) {
      return { success: false, error: 'Email address is required.' };
    }
    if (!cleanCode || cleanCode.length !== 6) {
      return { success: false, error: 'Please enter a valid 6-digit verification code.' };
    }

    try {
      const res = await fetch('/api/customer/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          otp_code: cleanCode
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        return {
          success: false,
          error: data?.error || 'Invalid or expired verification code.'
        };
      }

      return {
        success: true,
        message: data?.message || 'Verification code confirmed.'
      };
    } catch (err) {
      console.error('[CustomerResetPassword] verifyCode error:', err);
      return {
        success: false,
        error: err.message || 'Network error occurred while verifying code.'
      };
    }
  },

  /**
   * Verify code and update password
   * @param {string} email
   * @param {string} otpCode
   * @param {string} newPassword
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  async confirmReset(email, otpCode, newPassword) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (otpCode || '').trim();

    if (!cleanEmail) {
      return { success: false, error: 'Email address is required.' };
    }
    if (!cleanCode || cleanCode.length !== 6) {
      return { success: false, error: 'A valid 6-digit verification code is required.' };
    }
    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    try {
      const res = await fetch('/api/customer/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          otp_code: cleanCode,
          new_password: newPassword
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        return {
          success: false,
          error: data?.error || 'Failed to reset password. Please try again.'
        };
      }

      return {
        success: true,
        message: data?.message || 'Password has been reset successfully.'
      };
    } catch (err) {
      console.error('[CustomerResetPassword] Confirm error:', err);
      return {
        success: false,
        error: err.message || 'Network error occurred while resetting password.'
      };
    }
  }
};

window.CustomerResetPassword = CustomerResetPassword;
