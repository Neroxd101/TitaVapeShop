'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { InventoryFormData } from '@/types/inventory';

export default function AddItemForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [formData, setFormData] = useState<InventoryFormData>({
    name: '',
    description: '',
    quantity: 0,
    sale_price: 0,
    costing: 0,
    category: '',
    image_urls: [],
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'quantity' || name === 'sale_price' || name === 'costing' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;

    // Validate total count (max 5 images)
    if (selectedImages.length + files.length > 5) {
      setError('Maximum 5 images allowed');
      e.target.value = ''; // Reset input
      return;
    }

    // Validate each file
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError('Please select only image files');
        e.target.value = ''; // Reset input
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Each image must be less than 5MB');
        e.target.value = ''; // Reset input
        return;
      }
    }

    // Add new files
    const newFiles = [...selectedImages, ...files];
    setSelectedImages(newFiles);
    setError(null);

    // Create previews for new files
    const previewPromises = files.map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(previewPromises).then((newPreviews) => {
      setImagePreviews([...imagePreviews, ...newPreviews]);
    });

    // Reset file input to allow selecting the same files again if needed
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let imageUrls: string[] = formData.image_urls || [];

      // Upload all images if any are selected
      if (selectedImages.length > 0) {
        setIsUploading(true);
        const uploadPromises = selectedImages.map(async (file) => {
          const formDataUpload = new FormData();
          formDataUpload.append('file', file);

          const uploadResponse = await fetch('/inventory/upload-image', {
            method: 'POST',
            body: formDataUpload,
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error || 'Failed to upload image');
          }

          const uploadData = await uploadResponse.json();
          return uploadData.url;
        });

        try {
          imageUrls = await Promise.all(uploadPromises);
          setIsUploading(false);
        } catch (uploadError) {
          setIsUploading(false);
          throw uploadError;
        }
      }

      // Submit form with image URLs
      const response = await fetch('/inventory/api/add-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...formData, image_urls: imageUrls }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add item');
      }

      const result = await response.json();
      console.log('Item added successfully:', result);

      // Clear form and images
      setSelectedImages([]);
      setImagePreviews([]);
      setFormData({
        name: '',
        description: '',
        quantity: 0,
        sale_price: 0,
        costing: 0,
        category: '',
        image_urls: [],
      });

      // Wait a moment for database to commit
      await new Promise(resolve => setTimeout(resolve, 500));

      // Redirect to inventory page on success with cache bust
      router.push('/inventory?t=' + Date.now());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <div className="backdrop-blur-xl bg-gray-900/95 dark:bg-gray-800/95 border border-white/30 rounded-2xl shadow-2xl overflow-hidden">
      <form onSubmit={handleSubmit} className="divide-y divide-white/10">
        {/* Error Message */}
        {error && (
          <div className="backdrop-blur-md bg-red-600/90 border-b border-red-400/50 text-white px-4 md:px-6 py-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Main Form Content */}
        <div className="p-4 md:p-6 space-y-6 md:space-y-8">
          {/* Top Row: Name and Category */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="md:col-span-2">
              <label htmlFor="name" className="block text-sm font-semibold text-white mb-2">
                Item Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 backdrop-blur-md bg-white/20 dark:bg-white/10 border border-white/30 rounded-xl focus:ring-2 focus:ring-white/50 focus:border-white/50 focus:bg-white/30 text-white placeholder-white/60 transition-all"
                placeholder="Enter item name"
              />
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-semibold text-white mb-2">
                Category <span className="text-red-400">*</span>
              </label>
              <select
                id="category"
                name="category"
                required
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-3 backdrop-blur-md bg-white/20 dark:bg-white/10 border border-white/30 rounded-xl focus:ring-2 focus:ring-white/50 focus:border-white/50 focus:bg-white/30 text-white transition-all"
              >
                <option value="" className="bg-gray-800">Select category</option>
                <option value="Hardware" className="bg-gray-800">Hardware</option>
                <option value="Juices" className="bg-gray-800">Juices</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-white mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-3 backdrop-blur-md bg-white/20 dark:bg-white/10 border border-white/30 rounded-xl focus:ring-2 focus:ring-white/50 focus:border-white/50 focus:bg-white/30 text-white placeholder-white/60 transition-all resize-none"
              placeholder="Enter item description (optional)"
            />
          </div>

          {/* Pricing Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div>
              <label htmlFor="quantity" className="block text-sm font-semibold text-white mb-2">
                Quantity <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                required
                min="0"
                value={formData.quantity}
                onChange={handleChange}
                className="w-full px-4 py-3 backdrop-blur-md bg-white/20 dark:bg-white/10 border border-white/30 rounded-xl focus:ring-2 focus:ring-white/50 focus:border-white/50 focus:bg-white/30 text-white placeholder-white/60 transition-all"
                placeholder="0"
              />
            </div>
            <div>
              <label htmlFor="costing" className="block text-sm font-semibold text-white mb-2">
                Costing Value (₱) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                id="costing"
                name="costing"
                required
                min="0"
                step="0.01"
                value={formData.costing}
                onChange={handleChange}
                className="w-full px-4 py-3 backdrop-blur-md bg-white/20 dark:bg-white/10 border border-white/30 rounded-xl focus:ring-2 focus:ring-white/50 focus:border-white/50 focus:bg-white/30 text-white placeholder-white/60 transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="sale_price" className="block text-sm font-semibold text-white mb-2">
                Sale Price (₱) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                id="sale_price"
                name="sale_price"
                required
                min="0"
                step="0.01"
                value={formData.sale_price}
                onChange={handleChange}
                className="w-full px-4 py-3 backdrop-blur-md bg-white/20 dark:bg-white/10 border border-white/30 rounded-xl focus:ring-2 focus:ring-white/50 focus:border-white/50 focus:bg-white/30 text-white placeholder-white/60 transition-all"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Images Section */}
          <div>
            <label htmlFor="images" className="block text-sm font-semibold text-white mb-3">
              Product Images <span className="text-white/60 font-normal">(Max 5 images)</span>
            </label>
            
            {/* File Input */}
            <div className="mb-4">
              <input
                type="file"
                id="images"
                name="images"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="w-full px-4 py-3 backdrop-blur-md bg-white/20 dark:bg-white/10 border border-white/30 rounded-xl focus:ring-2 focus:ring-white/50 focus:border-white/50 focus:bg-white/30 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:backdrop-blur-md file:bg-white/30 file:text-white file:border file:border-white/30 hover:file:bg-white/40 transition-all cursor-pointer"
              />
              <p className="mt-2 text-xs text-white/70">
                PNG, JPG, GIF up to 5MB each
                {selectedImages.length > 0 && (
                  <span className="ml-2 font-semibold text-white">
                    • {selectedImages.length} / 5 selected
                  </span>
                )}
              </p>
            </div>

            {/* Image Previews Grid */}
            {selectedImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative group aspect-square">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover rounded-xl border-2 border-white/30 backdrop-blur-sm bg-white/10 transition-all group-hover:border-white/50 group-hover:scale-105"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 backdrop-blur-md bg-red-500/90 hover:bg-red-500 border-2 border-white/30 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold shadow-xl transition-all hover:scale-110 z-10"
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                    <div className="absolute bottom-2 left-2 backdrop-blur-md bg-black/60 text-white text-xs font-semibold px-2 py-1 rounded">
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {selectedImages.length === 0 && (
              <div className="border-2 border-dashed border-white/30 rounded-xl p-8 md:p-12 text-center">
                <svg className="w-16 h-16 mx-auto text-white/40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-white/60">No images selected yet</p>
                <p className="text-xs text-white/40 mt-1">Upload up to 5 product images</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="px-4 md:px-6 py-4 backdrop-blur-md bg-gray-800/90 border-t border-white/20 flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 backdrop-blur-md bg-blue-500/40 hover:bg-blue-500/60 disabled:bg-blue-500/20 border border-white/30 text-white font-semibold py-3 px-6 rounded-xl transition-all hover:shadow-xl hover:scale-105 disabled:scale-100 shadow-lg flex items-center justify-center gap-2 min-w-[140px]"
          >
            {isUploading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              </>
            ) : isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Item
              </>
            )}
          </button>
          <Link
            href="/inventory"
            className="flex-1 backdrop-blur-md bg-white/20 hover:bg-white/30 border border-white/30 text-white font-semibold py-3 px-6 rounded-xl transition-all hover:shadow-xl hover:scale-105 text-center inline-flex items-center justify-center gap-2 shadow-lg min-w-[140px]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
