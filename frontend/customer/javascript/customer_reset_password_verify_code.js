const CustomerResetPasswordVerifyCode = {
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
  }
};

window.CustomerResetPasswordVerifyCode = CustomerResetPasswordVerifyCode;
