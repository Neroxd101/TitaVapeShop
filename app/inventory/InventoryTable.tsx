'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { InventoryItem } from '@/types/inventory';
import ImageModal from './ImageModal';
import SearchBar from './SearchBar';

interface InventoryTableProps {
  items: InventoryItem[];
}

export default function InventoryTable({ items }: InventoryTableProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImages, setModalImages] = useState<string[]>([]);
  const [modalQrCode, setModalQrCode] = useState<string | undefined>();
  const [modalTitle, setModalTitle] = useState<string>('');
  const [modalStartIndex, setModalStartIndex] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter items based on search query
  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query)
    );
  });

  const openImageModal = (item: InventoryItem, imageIndex?: number) => {
    setModalImages(item.image_urls || []);
    setModalQrCode(undefined); // Don't include QR code when opening from images
    setModalTitle(item.name);
    setModalStartIndex(imageIndex || 0);
    setModalOpen(true);
  };

  const openQrModal = (item: InventoryItem) => {
    setModalImages([]);
    setModalQrCode(item.qr_code_url);
    setModalTitle(`${item.name} - QR Code`);
    setModalStartIndex(0);
    setModalOpen(true);
  };

  const handleDelete = async (itemId: string, itemName: string) => {
    if (!confirm(`Are you sure you want to delete "${itemName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(itemId);
    try {
      const response = await fetch(`/inventory/api/delete-item?id=${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete item');
      }

      // Refresh the page to show updated inventory
      router.refresh();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete item. Please try again.');
      setDeletingId(null);
    }
  };
  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          No inventory items found. Add your first item to get started!
        </p>
      </div>
    );
  }

  const displayItems = filteredItems;

  return (
    <>
      <ImageModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        images={modalImages}
        qrCodeUrl={modalQrCode}
        title={modalTitle}
        currentIndex={modalStartIndex}
      />
      <div className="backdrop-blur-xl bg-white/20 dark:bg-white/10 border border-white/30 rounded-2xl shadow-2xl overflow-hidden">
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          resultsCount={displayItems.length}
          totalCount={items.length}
        />
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="backdrop-blur-md bg-white/30 dark:bg-white/10 border-b border-white/20">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/90 dark:text-white/80 uppercase tracking-wider">
                Image
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/90 dark:text-white/80 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/90 dark:text-white/80 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/90 dark:text-white/80 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/90 dark:text-white/80 uppercase tracking-wider">
                Costing Value
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/90 dark:text-white/80 uppercase tracking-wider">
                Sale Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/90 dark:text-white/80 uppercase tracking-wider">
                Date Added
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/90 dark:text-white/80 uppercase tracking-wider">
                Last Update
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/90 dark:text-white/80 uppercase tracking-wider">
                QR Code
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="backdrop-blur-sm bg-white/10 dark:bg-white/5 divide-y divide-white/20">
            {displayItems.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-8 text-center">
                  <p className="text-white/80 dark:text-white/70">
                    No items found matching &quot;{searchQuery}&quot;
                  </p>
                </td>
              </tr>
            ) : (
              displayItems.map((item) => (
              <tr key={item.id} className="hover:bg-white/20 dark:hover:bg-white/10 transition-all">
                <td className="px-6 py-4">
                  {item.image_urls && item.image_urls.length > 0 ? (
                    <button
                      onClick={() => openImageModal(item, 0)}
                      className="relative cursor-pointer hover:opacity-80 transition-opacity group"
                    >
                      <img
                        src={item.image_urls[0]}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"%3E%3Crect x="3" y="3" width="18" height="18" rx="2"/%3E%3Cpath d="M9 9h6v6H9z"/%3E%3C/svg%3E';
                        }}
                      />
                      {item.image_urls.length > 1 && (
                        <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-xs font-semibold rounded-full w-6 h-6 flex items-center justify-center group-hover:bg-blue-700 transition-colors">
                          +{item.image_urls.length - 1}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-all flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                          />
                        </svg>
                      </div>
                    </button>
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-white dark:text-white/90">
                    {item.name}
                  </div>
                  {item.description && (
                    <div className="text-sm text-white/80 dark:text-white/70">
                      {item.description}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full backdrop-blur-md bg-white/30 dark:bg-white/20 text-white border border-white/30">
                    {item.category || 'Uncategorized'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white dark:text-white/90">
                  {item.quantity}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                  ₱{item.costing.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white dark:text-white/90">
                  ₱{item.sale_price.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80 dark:text-white/70">
                  {item.date_added
                    ? new Date(item.date_added).toLocaleString()
                    : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80 dark:text-white/70">
                  {item.last_update
                    ? new Date(item.last_update).toLocaleString()
                    : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {item.qr_code_url ? (
                    <button
                      onClick={() => openQrModal(item)}
                      className="cursor-pointer hover:opacity-80 transition-opacity group"
                    >
                      <img
                        src={item.qr_code_url}
                        alt={`QR Code for ${item.name}`}
                        className="w-16 h-16 object-contain bg-white p-1 rounded group-hover:ring-2 group-hover:ring-blue-500 transition-all"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">Generating...</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    href={`/inventory/${item.id}/edit`}
                    className="backdrop-blur-md bg-blue-500/30 hover:bg-blue-500/50 border border-white/30 text-white font-medium py-1.5 px-4 rounded-lg transition-all hover:shadow-lg mr-3"
                  >
                    Edit
                  </Link>
                  <button
                    className="backdrop-blur-md bg-red-500/30 hover:bg-red-500/50 border border-white/30 text-white font-medium py-1.5 px-4 rounded-lg transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleDelete(item.id, item.name)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? 'Deleting...' : 'Delete'}
                  </button>
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}
