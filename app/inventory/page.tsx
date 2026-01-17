import Link from 'next/link';
import { supabase } from '@/lib/supabase/server';
import { InventoryItem } from '@/types/inventory';
import InventoryTable from './InventoryTable';
import InventoryError from './InventoryError';

// Disable caching for this page to ensure fresh data
export const revalidate = 0;
export const dynamic = 'force-dynamic';

async function getInventoryItems(): Promise<InventoryItem[]> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('date_added', { ascending: false });

    if (error) {
      console.error('Error fetching inventory:', error);
      throw new Error(error.message || 'Failed to fetch inventory');
    }

    console.log('Fetched items:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('Failed to fetch inventory items:', error);
    throw error; // Re-throw to be caught by the page component
  }
}

export default async function InventoryPage() {
  let items: InventoryItem[] = [];
  let error: string | null = null;

  try {
    items = await getInventoryItems();
    console.log('Page loaded with items:', items.length);
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load inventory';
    console.error('Inventory page error:', err);
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white drop-shadow-lg">Inventory Management</h1>
          <Link
            href="/inventory/add-item"
            className="backdrop-blur-xl bg-white/20 dark:bg-white/10 border border-white/30 text-white font-semibold py-2 px-6 rounded-xl transition-all hover:bg-white/30 hover:border-white/50 hover:shadow-2xl hover:scale-105 shadow-lg"
          >
            + Add New Item
          </Link>
        </div>

        {error ? (
          <InventoryError message={error} />
        ) : (
          <InventoryTable items={items} />
        )}
      </div>
    </main>
  );
}
