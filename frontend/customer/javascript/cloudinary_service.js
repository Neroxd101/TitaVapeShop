/**
 * Cloudinary Upload Service
 * Handles uploading receipt image files directly to Cloudinary
 */
const CloudinaryService = {
  cloudName: 'titavapeshop',
  uploadPreset: 'tita_receipt',

  /**
   * Upload an image file to Cloudinary (unsigned direct upload)
   * @param {File} file - The receipt image file to upload
   * @returns {Promise<string>} The secure public URL of the uploaded image
   */
  async uploadReceipt(file) {
    if (!file) {
      throw new Error('No receipt file provided for upload.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.uploadPreset);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.error?.message || 'Failed to upload receipt image to Cloudinary.');
    }

    const data = await response.json();
    if (!data || !data.secure_url) {
      throw new Error('Invalid response from Cloudinary upload.');
    }

    return data.secure_url;
  }
};

// Export to window
if (typeof window !== 'undefined') {
  window.CloudinaryService = CloudinaryService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CloudinaryService;
}
