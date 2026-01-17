import Link from 'next/link';
import AddItemForm from './AddItemForm';

export default function AddItemPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/inventory"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Inventory
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-8">Add New Item</h1>

        <AddItemForm />
      </div>
    </main>
  );
}
