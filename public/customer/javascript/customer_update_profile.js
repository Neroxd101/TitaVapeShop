/**
 * Customer Update Profile Module
 * Frontend client module matching customer_update_profile RPC and backend route
 */
const CustomerUpdateProfile = {
  /**
   * Submit profile update
   * @param {{full_name: string, contact_number: string, email: string}} payload
   * @returns {Promise<{success: boolean, email_changed?: boolean, email?: string, message?: string, user?: object, error?: string}>}
   */
  async update(payload) {
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update profile.');
      }
      return data;
    } catch (err) {
      console.error('[CustomerUpdateProfile] Update error:', err);
      return { success: false, error: err.message || 'Profile update failed.' };
    }
  },

  /**
   * Reset all profile inline edit forms to collapsed state
   */
  resetEditState() {
    ['Name', 'Phone', 'Email'].forEach(field => {
      const form = document.getElementById(`formEditProfile${field}`);
      const btn = document.getElementById(`btnToggleEdit${field}`);
      if (form) form.style.display = 'none';
      if (btn) {
        btn.textContent = 'Edit';
        btn.style.display = 'inline-flex';
      }
    });
  },

  /**
   * Populate profile modal display values and inputs from user object
   * @param {object} user
   */
  populate(user) {
    if (!user) return;
    this.resetEditState();

    // Value display spans
    const nameDisplay = document.getElementById('profileDisplayName');
    const phoneDisplay = document.getElementById('profileDisplayPhone');
    const emailDisplay = document.getElementById('profileDisplayEmail');

    if (nameDisplay) nameDisplay.textContent = user.full_name || '—';
    if (phoneDisplay) phoneDisplay.textContent = user.contact_number || '—';
    if (emailDisplay) emailDisplay.textContent = user.email || '—';

    // Form inputs
    const nameInput = document.getElementById('customerProfileName');
    const phoneInput = document.getElementById('customerProfilePhone');
    const emailInput = document.getElementById('customerProfileEmail');
    const avatarBadge = document.getElementById('profileModalAvatar');
    const ageBadgeText = document.getElementById('profileAgeBadgeText');

    if (nameInput) nameInput.value = user.full_name || '';
    if (phoneInput) phoneInput.value = user.contact_number || '';
    if (emailInput) emailInput.value = user.email || '';

    if (avatarBadge) {
      const initial = (user.full_name || user.email || 'C').trim().charAt(0).toUpperCase();
      avatarBadge.textContent = initial;
    }

    if (ageBadgeText && user.birthday) {
      ageBadgeText.textContent = `Verified 18+ Customer (Born ${user.birthday}) • RA 11900`;
    }
  }
};

window.CustomerUpdateProfile = CustomerUpdateProfile;
