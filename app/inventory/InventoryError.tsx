'use client';

interface InventoryErrorProps {
  message?: string;
}

export default function InventoryError({ message }: InventoryErrorProps) {
  return (
    <div className="backdrop-blur-xl bg-red-500/20 dark:bg-red-500/10 border border-red-400/50 rounded-2xl shadow-2xl p-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-white"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-white">
            Error Loading Inventory
          </h3>
          <div className="mt-2 text-sm text-white/90">
            <p>
              {message || 'Unable to load inventory items. Please check:'}
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/80">
              <li>Supabase environment variables are set (.env.local)</li>
              <li>Database table "inventory" exists</li>
              <li>Row Level Security policies are configured</li>
              <li>Check browser console for detailed errors</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
