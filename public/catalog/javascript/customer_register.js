/**
 * Customer Register Module
 * Frontend client module matching customer_register RPC and backend route
 */
const CustomerRegister = {
  /**
   * Submit registration request
   * @param {{full_name: string, email: string, contact_number: string, birthday: string, password: string}} payload
   * @returns {Promise<{success: boolean, email?: string, message?: string, error?: string}>}
   */
  async submit(payload) {
    try {
      const res = await fetch('/api/customer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to register account.');
      }
      return data;
    } catch (err) {
      console.error('[CustomerRegister] Registration error:', err);
      return { success: false, error: err.message || 'Registration failed.' };
    }
  },

  /**
   * Validate registration fields client-side
   * @param {{full_name: string, email: string, contact_number: string, birthday: string, password: string, confirm_password?: string, privacy_check?: boolean}} data
   * @returns {{valid: boolean, error?: string}}
   */
  validate(data) {
    if (!data.full_name || data.full_name.trim().length < 2) {
      return { valid: false, error: 'Please enter your full name (minimum 2 characters).' };
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !emailPattern.test(data.email.trim())) {
      return { valid: false, error: 'Please enter a valid email address.' };
    }

    const phonePattern = /^(09|\+639)\d{9}$/;
    if (!data.contact_number || !phonePattern.test(data.contact_number.trim())) {
      return { valid: false, error: 'Please enter a valid 11-digit mobile number (e.g. 09123456789).' };
    }

    if (!data.birthday) {
      return { valid: false, error: 'Please enter your date of birth.' };
    }

    const birthDate = new Date(data.birthday);
    if (isNaN(birthDate.getTime())) {
      return { valid: false, error: 'Please enter a valid date of birth.' };
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      return { valid: false, error: 'You must be at least 18 years old to create an account (RA 11900).' };
    }

    if (!data.password || data.password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters long.' };
    }

    const hasUpper = /[A-Z]/.test(data.password);
    const hasLower = /[a-z]/.test(data.password);
    const hasNumber = /[0-9]/.test(data.password);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(data.password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return { valid: false, error: 'Password must include uppercase, lowercase, a number, and a special character.' };
    }

    if (data.confirm_password !== undefined && data.password !== data.confirm_password) {
      return { valid: false, error: 'Passwords do not match. Please re-enter your password.' };
    }

    if (data.privacy_check !== undefined && !data.privacy_check) {
      return { valid: false, error: 'You must consent to the Data Privacy Act terms to register.' };
    }

    return { valid: true };
  }
};

window.CustomerRegister = CustomerRegister;
