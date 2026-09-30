const CustomerResetPasswordConfirm = {
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

window.CustomerResetPasswordConfirm = CustomerResetPasswordConfirm;
