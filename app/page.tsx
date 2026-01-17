import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Tita Vape Shop - Inventory System</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          Welcome to your inventory management system. Let&apos;s get started!
        </p>
        <Link
          href="/inventory"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
        >
          View Inventory →
        </Link>
      </div>
    </main>
  );
}
