import Link from 'next/link';
import AddItemForm from './AddItemForm';

export default function AddItemPage() {
  return (
    <main className="min-h-screen p-3 md:p-4 lg:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/inventory"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Back to Inventory</span>
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">Add New Item</h1>
          <p className="mt-2 text-sm md:text-base text-white/70">Fill in the details below to add a new item to your inventory</p>
        </div>

        <AddItemForm />
      </div>
    </main>
  );
}
