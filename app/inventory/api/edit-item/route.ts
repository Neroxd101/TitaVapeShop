import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { InventoryFormData } from '@/types/inventory';
import { generateQRCodeWithText, sanitizeItemNameForPath } from '../../qrcode';

interface EditItemRequest extends InventoryFormData {
  id: string;
  removed_images?: string[];
}

export async function PUT(request: NextRequest) {
  try {
    const body: EditItemRequest = await request.json();
    console.log('Received edit data:', body);

    // Validate required fields
    if (!body.id || !body.name || body.quantity === undefined || body.sale_price === undefined || body.costing === undefined) {
      return NextResponse.json(
        { error: 'ID, name, quantity, sale price, and costing are required' },
        { status: 400 }
      );
    }

    // Validate quantity, sale_price, and costing are non-negative
    if (body.quantity < 0 || body.sale_price < 0 || body.costing < 0) {
      return NextResponse.json(
        { error: 'Quantity, sale price, and costing must be non-negative' },
        { status: 400 }
      );
    }

    // Get current item to check if name changed
    const { data: currentItem, error: fetchError } = await supabase
      .from('inventory')
      .select('id, name')
      .eq('id', body.id)
      .single();

    if (fetchError || !currentItem) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    const nameChanged = currentItem.name !== body.name;
    const oldFolderName = sanitizeItemNameForPath(currentItem.name);
    const newFolderName = sanitizeItemNameForPath(body.name);

    // Delete removed images from storage
    if (body.removed_images && body.removed_images.length > 0) {
      try {
        const filesToDelete: string[] = [];
        body.removed_images.forEach((imageUrl: string) => {
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

        if (filesToDelete.length > 0) {
          await supabase.storage
            .from('inventory-images')
            .remove(filesToDelete);
        }
      } catch (removeError) {
        console.error('Error removing images:', removeError);
        // Continue with update even if image removal fails
      }
    }

    // If images were uploaded to temp location, move them to item-specific folders
    let finalImageUrls: string[] = body.image_urls || [];
    if (body.image_urls && body.image_urls.length > 0) {
      try {
        const movedUrls: string[] = [];
        
        for (let i = 0; i < body.image_urls.length; i++) {
          const imageUrl = body.image_urls[i];
          if (!imageUrl) continue;

          // Extract the path from the URL
          const url = new URL(imageUrl);
          const oldPath = url.pathname.split('/storage/v1/object/public/inventory-images/')[1];
          
          if (oldPath && oldPath.startsWith('temp/')) {
            // Move to item-specific folder with index
            const fileExt = oldPath.split('.').pop();
            const newPath = `items/${newFolderName}/image-${i + 1}.${fileExt}`;
            
            // Copy file to new location
            const { error: copyError } = await supabase.storage
              .from('inventory-images')
              .copy(oldPath, newPath);

            if (!copyError) {
              // Delete old file
              await supabase.storage
                .from('inventory-images')
                .remove([oldPath]);

              // Get new public URL
              const { data: urlData } = supabase.storage
                .from('inventory-images')
                .getPublicUrl(newPath);

              movedUrls.push(urlData.publicUrl);
            } else {
              // If move fails, keep original URL
              movedUrls.push(imageUrl);
            }
          } else {
            // Already in final location or external URL
            movedUrls.push(imageUrl);
          }
        }

        if (movedUrls.length > 0) {
          finalImageUrls = movedUrls;
        }
      } catch (moveError) {
        console.error('Error moving images:', moveError);
        // Continue with original URLs if move fails
      }
    }

    // If name changed, move all files to new folder and regenerate QR code
    if (nameChanged) {
      try {
        // Move existing images to new folder
        const filesToMove: { oldPath: string; newPath: string }[] = [];
        
        finalImageUrls.forEach((imageUrl, index) => {
          try {
            const url = new URL(imageUrl);
            const oldPath = url.pathname.split('/storage/v1/object/public/inventory-images/')[1];
            if (oldPath && oldPath.startsWith(`items/${oldFolderName}/`)) {
              const fileName = oldPath.split('/').pop();
              const newPath = `items/${newFolderName}/${fileName}`;
              filesToMove.push({ oldPath, newPath });
            }
          } catch (urlError) {
            console.error('Error parsing image URL:', urlError);
          }
        });

        // Move files
        for (const { oldPath, newPath } of filesToMove) {
          const { error: copyError } = await supabase.storage
            .from('inventory-images')
            .copy(oldPath, newPath);
          
          if (!copyError) {
            await supabase.storage.from('inventory-images').remove([oldPath]);
            
            // Update URL in finalImageUrls
            const { data: urlData } = supabase.storage
              .from('inventory-images')
              .getPublicUrl(newPath);
            
            const index = finalImageUrls.findIndex(url => url.includes(oldPath));
            if (index !== -1) {
              finalImageUrls[index] = urlData.publicUrl;
            }
          }
        }

        // Regenerate QR code with new name
        try {
          const qrCodeBuffer = await generateQRCodeWithText({
            data: body.id,
            itemName: body.name,
          });

          const qrCodePath = `items/${newFolderName}/qr-code.png`;
          const { error: qrUploadError } = await supabase.storage
            .from('inventory-images')
            .upload(qrCodePath, qrCodeBuffer, {
              contentType: 'image/png',
              upsert: true,
            });

          if (!qrUploadError) {
            const { data: qrUrlData } = supabase.storage
              .from('inventory-images')
              .getPublicUrl(qrCodePath);

            // Update item with new QR code URL
            await supabase
              .from('inventory')
              .update({
                name: body.name,
                description: body.description || null,
                quantity: body.quantity,
                sale_price: body.sale_price,
                costing: body.costing,
                category: body.category || null,
                image_urls: finalImageUrls,
                qr_code_url: qrUrlData.publicUrl,
              })
              .eq('id', body.id);

            // Delete old QR code
            await supabase.storage
              .from('inventory-images')
              .remove([`items/${oldFolderName}/qr-code.png`]);

            console.log('Item updated successfully with new QR code');
            return NextResponse.json({
              data: { id: body.id },
              message: 'Item updated successfully',
            }, { status: 200 });
          }
        } catch (qrError) {
          console.error('Error regenerating QR code:', qrError);
          // Continue with update even if QR code regeneration fails
        }
      } catch (moveError) {
        console.error('Error moving files:', moveError);
        // Continue with update even if file moving fails
      }
    }

    // Update item in database
    const { data, error } = await supabase
      .from('inventory')
      .update({
        name: body.name,
        description: body.description || null,
        quantity: body.quantity,
        sale_price: body.sale_price,
        costing: body.costing,
        category: body.category || null,
        image_urls: finalImageUrls,
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update item' },
        { status: 500 }
      );
    }

    console.log('Item updated successfully:', data);
    return NextResponse.json({
      data,
      message: 'Item updated successfully',
    }, { status: 200 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
