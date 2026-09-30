const CustomerResetPasswordRequest = {
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
  }
};

window.CustomerResetPasswordRequest = CustomerResetPasswordRequest;
