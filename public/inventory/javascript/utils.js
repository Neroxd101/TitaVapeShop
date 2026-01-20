// Utility functions namespace
const InventoryUtils = {
  // Check authentication (Local check for UI purposes)
  checkAuth() {
    const user = localStorage.getItem('user');

    if (!user) {
      window.location.href = '/';
      return null;
    }

    return JSON.parse(user);
  },

  // Format currency
  formatCurrency(amount) {
    return '₱' + Number(amount).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  // Format date with time
  formatDate(date) {
    return new Date(date).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};
