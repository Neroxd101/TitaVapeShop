import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { sanitizeItemNameForPath } from '../../qrcode';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('id');

    if (!itemId) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    // First, get the item to retrieve its name and image URLs
    const { data: item, error: fetchError } = await supabase
      .from('inventory')
      .select('id, name, image_urls')
      .eq('id', itemId)
      .single();

    if (fetchError || !item) {
      console.error('Error fetching item:', fetchError);
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Delete associated files from Supabase Storage
    try {
      const folderName = sanitizeItemNameForPath(item.name);
      const filesToDelete: string[] = [];

      // Add QR code to deletion list
      filesToDelete.push(`items/${folderName}/qr-code.png`);

      // Add all images to deletion list
      if (item.image_urls && Array.isArray(item.image_urls) && item.image_urls.length > 0) {
        // Extract image paths from URLs
        item.image_urls.forEach((imageUrl: string) => {
          try {
            const url = new URL(imageUrl);
            const path = url.pathname.split('/storage/v1/object/public/inventory-images/')[1];
            if (path) {
              filesToDelete.push(path);
            }
          } catch (urlError) {
            console.error('Error parsing image URL:', urlError);
          }
        });
      }

      // Delete all files from storage
      if (filesToDelete.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from('inventory-images')
          .remove(filesToDelete);

        if (deleteError) {
          console.error('Error deleting files from storage:', deleteError);
          // Continue with database deletion even if file deletion fails
        }
      }
    } catch (storageError) {
      console.error('Error handling storage deletion:', storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete the item from the database
    const { error: deleteError } = await supabase
      .from('inventory')
      .delete()
      .eq('id', itemId);

    if (deleteError) {
      console.error('Error deleting item:', deleteError);
      return NextResponse.json(
        { error: deleteError.message || 'Failed to delete item' },
        { status: 500 }
      );
    }

    console.log('Item deleted successfully:', itemId);
    return NextResponse.json(
      { message: 'Item deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
