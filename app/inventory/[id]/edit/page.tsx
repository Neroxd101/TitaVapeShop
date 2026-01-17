import Link from 'next/link';
import { supabase } from '@/lib/supabase/server';
import { InventoryItem } from '@/types/inventory';
import EditItemForm from './EditItemForm';
import { notFound } from 'next/navigation';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

async function getItem(id: string): Promise<InventoryItem | null> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('Error fetching item:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch item:', error);
    return null;
  }
}

export default async function EditItemPage({
  params,
}: {
  params: { id: string };
}) {
  const item = await getItem(params.id);

  if (!item) {
    notFound();
  }

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

        <h1 className="text-4xl font-bold mb-8">Edit Item</h1>

        <EditItemForm item={item} />
      </div>
    </main>
  );
}
