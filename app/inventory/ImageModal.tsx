'use client';

import { useEffect, useState } from 'react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  images?: string[];
  qrCodeUrl?: string;
  title?: string;
  currentIndex?: number;
}

export default function ImageModal({
  isOpen,
  onClose,
  images,
  qrCodeUrl,
  title,
  currentIndex = 0,
}: ImageModalProps) {
  const [activeIndex, setActiveIndex] = useState(currentIndex);

  useEffect(() => {
    setActiveIndex(currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayImages = images || [];
  const hasMultipleImages = displayImages.length > 1;
  const hasQrCode = !!qrCodeUrl;

  const handlePrevious = () => {
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    } else if (hasQrCode) {
      // If we have QR code and are at first image, go to QR code
      setActiveIndex(displayImages.length);
    } else {
      // Loop to last image if no QR code
      setActiveIndex(displayImages.length - 1);
    }
  };

  const handleNext = () => {
    if (activeIndex < displayImages.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else if (hasQrCode && activeIndex === displayImages.length - 1) {
      // If we have QR code and are at last image, go to QR code
      setActiveIndex(displayImages.length);
    } else {
      // Loop back to first image
      setActiveIndex(0);
    }
  };

  // Only count QR code in total if it's provided
  const totalItems = displayImages.length + (hasQrCode ? 1 : 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title || 'Preview'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="relative flex items-center justify-center p-8 min-h-[400px]">
          {/* Previous Button */}
          {totalItems > 1 && (
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white dark:bg-gray-700 rounded-full p-2 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors z-10"
              aria-label="Previous"
            >
              <svg
                className="w-6 h-6 text-gray-700 dark:text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}

          {/* Image/QR Code Display */}
          <div className="flex items-center justify-center w-full">
            {activeIndex < displayImages.length ? (
              <img
                src={displayImages[activeIndex]}
                alt={`Image ${activeIndex + 1} of ${displayImages.length}`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"%3E%3Crect x="3" y="3" width="18" height="18" rx="2"/%3E%3Cpath d="M9 9h6v6H9z"/%3E%3C/svg%3E';
                }}
              />
            ) : hasQrCode ? (
              <div className="flex flex-col items-center">
                <img
                  src={qrCodeUrl}
                  alt="QR Code"
                  className="max-w-full max-h-[60vh] object-contain rounded-lg bg-white p-4"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  QR Code
                </p>
              </div>
            ) : displayImages.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No images available</p>
            ) : null}
          </div>

          {/* Next Button */}
          {totalItems > 1 && (
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white dark:bg-gray-700 rounded-full p-2 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors z-10"
              aria-label="Next"
            >
              <svg
                className="w-6 h-6 text-gray-700 dark:text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
