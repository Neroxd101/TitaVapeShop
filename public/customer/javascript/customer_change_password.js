/**
 * Customer Change Password Module
 * Frontend client module matching customer_change_password RPC and backend route
 */

const CustomerChangePassword = {
  /**
   * Submit change password request
   * @param {string} currentPassword
   * @param {string} newPassword
   * @param {string} confirmPassword
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  async changePassword(currentPassword, newPassword, confirmPassword) {
    if (!currentPassword) {
      return { success: false, error: 'Please enter your current password.' };
    }

    if (!newPassword) {
      return { success: false, error: 'Please enter a new password.' };
    }

    if (newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: 'New passwords do not match.' };
    }

    try {
      const res = await fetch('/api/customer/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        return {
          success: false,
          error: data?.error || 'Failed to update password. Please check your current password.'
        };
      }

      return {
        success: true,
        message: data?.message || 'Password updated successfully!'
      };
    } catch (err) {
      console.error('[CustomerChangePassword] Error:', err);
      return {
        success: false,
        error: err.message || 'Network error occurred while changing password.'
      };
    }
  }
};

window.CustomerChangePassword = CustomerChangePassword;
