// Google-related functions namespace
const InventoryGoogle = {
  // Check if Google is connected
  isConnected() {
    return localStorage.getItem('google_connected') === 'true';
  },

  // Get Google token
  getToken() {
    return localStorage.getItem('google_access_token');
  }
};
