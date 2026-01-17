import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { InventoryFormData } from '@/types/inventory';
import { generateQRCodeWithText, sanitizeItemNameForPath } from '../../qrcode';

export async function POST(request: NextRequest) {
  try {
    const body: InventoryFormData = await request.json();
    console.log('Received form data:', body);

    // Validate required fields
    if (!body.name || body.quantity === undefined || body.sale_price === undefined || body.costing === undefined) {
      return NextResponse.json(
        { error: 'Name, quantity, sale price, and costing are required' },
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

    // Insert into Supabase
    const { data, error } = await supabase
      .from('inventory')
      .insert([
        {
          name: body.name,
          description: body.description || null,
          quantity: body.quantity,
          sale_price: body.sale_price,
          costing: body.costing,
          category: body.category || null,
          image_urls: body.image_urls || [],
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create item' },
        { status: 500 }
      );
    }

    // If images were uploaded to temp location, move them to item-specific folders
    let finalImageUrls: string[] = body.image_urls || [];
    if (body.image_urls && body.image_urls.length > 0 && data.id) {
      try {
        const movedUrls: string[] = [];
        // Sanitize item name for folder path
        const folderName = sanitizeItemNameForPath(data.name);
        
        for (let i = 0; i < body.image_urls.length; i++) {
          const imageUrl = body.image_urls[i];
          if (!imageUrl) continue;

          // Extract the path from the URL
          const url = new URL(imageUrl);
          const oldPath = url.pathname.split('/storage/v1/object/public/inventory-images/')[1];
          
          if (oldPath && oldPath.startsWith('temp/')) {
            // Move to item-specific folder with index (using item name instead of ID)
            const fileExt = oldPath.split('.').pop();
            const newPath = `items/${folderName}/image-${i + 1}.${fileExt}`;
            
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
          
          // Update item with final image URLs
          await supabase
            .from('inventory')
            .update({ image_urls: finalImageUrls })
            .eq('id', data.id);
        }
      } catch (moveError) {
        console.error('Error moving images:', moveError);
        // Continue with original URLs if move fails
      }
    }

    // Generate and upload QR code
    let qrCodeUrl: string | null = null;
    if (data.id) {
      try {
        // Generate QR code with item ID (can be scanned to look up the item)
        // In production, you might want to use a full URL like: `${process.env.NEXT_PUBLIC_SITE_URL}/inventory/${data.id}`
        const qrData = data.id;
        
        // Generate QR code image with item name
        const finalBuffer = await generateQRCodeWithText({
          data: qrData,
          itemName: data.name,
        });

        // Sanitize item name for folder path
        const folderName = sanitizeItemNameForPath(data.name);
        
        // Upload QR code to Supabase Storage (using item name instead of ID)
        const qrCodePath = `items/${folderName}/qr-code.png`;
        const { error: qrUploadError } = await supabase.storage
          .from('inventory-images')
          .upload(qrCodePath, finalBuffer, {
            contentType: 'image/png',
            upsert: true,
          });

        if (!qrUploadError) {
          // Get public URL for QR code
          const { data: qrUrlData } = supabase.storage
            .from('inventory-images')
            .getPublicUrl(qrCodePath);

          qrCodeUrl = qrUrlData.publicUrl;

          // Update item with QR code URL
          await supabase
            .from('inventory')
            .update({ qr_code_url: qrCodeUrl })
            .eq('id', data.id);
        } else {
          console.error('Error uploading QR code:', qrUploadError);
        }
      } catch (qrError) {
        console.error('Error generating QR code:', qrError);
        // Continue without QR code if generation fails
      }
    }

    console.log('Item created successfully:', data);
    return NextResponse.json({ 
      data: { ...data, image_urls: finalImageUrls, qr_code_url: qrCodeUrl }, 
      message: 'Item added successfully' 
    }, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
