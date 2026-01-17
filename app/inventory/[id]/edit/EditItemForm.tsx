'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { InventoryItem, InventoryFormData } from '@/types/inventory';

interface EditItemFormProps {
  item: InventoryItem;
}

export default function EditItemForm({ item }: EditItemFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>(item.image_urls || []);
  const [formData, setFormData] = useState<InventoryFormData>({
    name: item.name || '',
    description: item.description || '',
    quantity: item.quantity || 0,
    sale_price: item.sale_price || 0,
    costing: item.costing || 0,
    category: item.category || '',
    image_urls: item.image_urls || [],
  });

  useEffect(() => {
    // Initialize form with item data
    setFormData({
      name: item.name || '',
      description: item.description || '',
      quantity: item.quantity || 0,
      sale_price: item.sale_price || 0,
      costing: item.costing || 0,
      category: item.category || '',
      image_urls: item.image_urls || [],
    });
    setExistingImages(item.image_urls || []);
  }, [item]);

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

    // Validate total count (max 5 images including existing)
    if (existingImages.length + selectedImages.length + files.length > 5) {
      setError(`Maximum 5 images allowed. You have ${existingImages.length} existing and ${selectedImages.length} new images.`);
      e.target.value = '';
      return;
    }

    // Validate each file
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError('Please select only image files');
        e.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Each image must be less than 5MB');
        e.target.value = '';
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

    // Reset file input
    e.target.value = '';
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let newImageUrls: string[] = [];

      // Upload new images if any are selected
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
          newImageUrls = await Promise.all(uploadPromises);
          setIsUploading(false);
        } catch (uploadError) {
          setIsUploading(false);
          throw uploadError;
        }
      }

      // Combine existing and new images
      const allImageUrls = [...existingImages, ...newImageUrls];

      // Submit form with updated data
      const response = await fetch('/inventory/api/edit-item', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: item.id,
          ...formData,
          image_urls: allImageUrls,
          removed_images: item.image_urls?.filter(url => !existingImages.includes(url)) || [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update item');
      }

      const result = await response.json();
      console.log('Item updated successfully:', result);

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

  const totalImages = existingImages.length + selectedImages.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Item Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder="Enter item name"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder="Enter item description (optional)"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="quantity"
              name="quantity"
              required
              min="0"
              value={formData.quantity}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="0"
            />
          </div>

          <div>
            <label htmlFor="costing" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Costing Value (₱) <span className="text-red-500">*</span>
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="0.00"
            />
          </div>

          <div>
            <label htmlFor="sale_price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sale Price (₱) <span className="text-red-500">*</span>
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            name="category"
            required
            value={formData.category}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="">Select category</option>
            <option value="Hardware">Hardware</option>
            <option value="Juices">Juices</option>
          </select>
        </div>

        <div>
          <label htmlFor="images" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Images (Max 5 total)
          </label>
          <input
            type="file"
            id="images"
            name="images"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-gray-600 dark:file:text-gray-200"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            PNG, JPG, GIF up to 5MB each. Maximum 5 images total.
            {totalImages > 0 && (
              <span className="ml-2 font-semibold text-blue-600 dark:text-blue-400">
                ({totalImages} / 5 images)
              </span>
            )}
          </p>

          {/* Existing Images */}
          {existingImages.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Existing Images ({existingImages.length}):
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {existingImages.map((imageUrl, index) => (
                  <div key={index} className="relative">
                    <img
                      src={imageUrl}
                      alt={`Existing ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"%3E%3Crect x="3" y="3" width="18" height="18" rx="2"/%3E%3Cpath d="M9 9h6v6H9z"/%3E%3C/svg%3E';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingImage(index)}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Image Previews */}
          {selectedImages.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Images ({selectedImages.length}):
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => removeNewImage(index)}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {isUploading 
              ? `Uploading ${selectedImages.length} image${selectedImages.length > 1 ? 's' : ''}...` 
              : isSubmitting 
              ? 'Updating...' 
              : 'Update Item'}
          </button>
          <Link
            href="/inventory"
            className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold py-3 px-6 rounded-lg transition-colors text-center inline-block"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
