const express = require('express');
const router = express.Router();

// Find or create folder in Google Drive
async function findOrCreateFolder(googleToken, folderName, parentId = null) {
  // Search for existing folder
  let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${googleToken}` },
    }
  );

  const searchData = await searchResponse.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create new folder
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const createResponse = await fetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${googleToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    }
  );

  const folderData = await createResponse.json();

  // Make folder publicly accessible
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderData.id}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${googleToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    }
  );

  return folderData.id;
}

// Upload file to Google Drive
async function uploadFile(googleToken, base64Data, filename, mimeType, folderId = null) {
  const metadata = {
    name: filename,
    mimeType: mimeType,
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = 'xxxxxxx' + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    base64Data +
    closeDelim;

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${googleToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!uploadResponse.ok) {
    const errorData = await uploadResponse.json();
    throw new Error(errorData.error?.message || 'Upload failed');
  }

  const fileData = await uploadResponse.json();
  console.log('File uploaded:', fileData.id);

  // Make file publicly accessible
  const permResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${googleToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    }
  );

  if (!permResponse.ok) {
    const permError = await permResponse.json().catch(() => ({}));
    console.error('Failed to set permissions:', permError);
    // Continue anyway - file was uploaded, just might not be public
  } else {
    console.log('File permissions set to public');
  }

  return {
    fileId: fileData.id,
    imageUrl: `https://drive.google.com/uc?id=${fileData.id}`,
  };
}

// POST /api/upload - Upload image to Google Drive (in product folder)
router.post('/', async (req, res) => {
  try {
    const { image, filename, mimeType, productName } = req.body;
    const googleToken = req.headers['x-google-token'];

    if (!googleToken) {
      return res.status(401).json({ error: 'Google account not connected' });
    }

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    let folderId = null;

    // If product name provided, create/find folder structure
    if (productName) {
      // First, find or create "Tita Vape Shop" root folder
      const rootFolderId = await findOrCreateFolder(googleToken, 'Tita Vape Shop');
      
      // Then, find or create "Inventory" subfolder
      const inventoryFolderId = await findOrCreateFolder(googleToken, 'Inventory', rootFolderId);
      
      // Finally, find or create product folder
      folderId = await findOrCreateFolder(googleToken, productName, inventoryFolderId);
    }

    const result = await uploadFile(
      googleToken,
      base64Data,
      filename || `product-${Date.now()}.jpg`,
      mimeType || 'image/jpeg',
      folderId
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// POST /api/upload/qrcode - Upload QR code image to Google Drive
router.post('/qrcode', async (req, res) => {
  try {
    const { qrCode, qrImage, productName } = req.body;
    const googleToken = req.headers['x-google-token'];

    if (!googleToken) {
      return res.status(401).json({ error: 'Google account not connected' });
    }

    if (!qrCode || !productName) {
      return res.status(400).json({ error: 'QR code and product name are required' });
    }

    let base64Data;

    // If qrImage is provided (from frontend fetch of QRtag.net), use it
    if (qrImage) {
      base64Data = qrImage.replace(/^data:image\/\w+;base64,/, '');
    } else {
      // Fallback: Fetch QR from QRtag.net API on backend
      const qrApiUrl = `https://qrtag.net/api/qr_6.png?url=${encodeURIComponent(qrCode)}`;
      console.log('Fetching QR from QRtag.net:', qrApiUrl);
      
      const qrResponse = await fetch(qrApiUrl);
      if (!qrResponse.ok) {
        throw new Error('Failed to fetch QR code from QRtag.net');
      }

      const qrBuffer = await qrResponse.arrayBuffer();
      base64Data = Buffer.from(qrBuffer).toString('base64');
    }

    // Find or create folder structure
    const rootFolderId = await findOrCreateFolder(googleToken, 'Tita Vape Shop');
    const inventoryFolderId = await findOrCreateFolder(googleToken, 'Inventory', rootFolderId);
    const productFolderId = await findOrCreateFolder(googleToken, productName, inventoryFolderId);

    // Upload QR code to product folder
    const result = await uploadFile(
      googleToken,
      base64Data,
      `qr-${qrCode}.png`,
      'image/png',
      productFolderId
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('QR upload error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/upload/drive-image/:fileId - Proxy Google Drive image with auth
router.get('/drive-image/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    // Check both header and query param for token
    const googleToken = req.headers['x-google-token'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.token;

    if (!googleToken) {
      return res.status(401).json({ error: 'Google account not connected' });
    }

    // Try to get the file metadata first
    const metadataResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name`,
      {
        headers: {
          Authorization: `Bearer ${googleToken}`,
        },
      }
    );

    if (!metadataResponse.ok) {
      return res.status(metadataResponse.status).json({ error: 'File not found or access denied' });
    }

    // Fetch the actual image file
    const imageResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${googleToken}`,
        },
      }
    );

    if (!imageResponse.ok) {
      return res.status(imageResponse.status).json({ error: 'Failed to fetch image' });
    }

    // Get content type from metadata or response
    const metadata = await metadataResponse.json();
    const contentType = metadata.mimeType || imageResponse.headers.get('content-type') || 'image/jpeg';

    // Stream the image to the client
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    const imageBuffer = await imageResponse.arrayBuffer();
    res.send(Buffer.from(imageBuffer));
  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/upload/:fileId - Delete image from Google Drive
router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const googleToken = req.headers['x-google-token'];

    if (!googleToken) {
      return res.status(401).json({ error: 'Google account not connected' });
    }

    const deleteResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${googleToken}`,
        },
      }
    );

    if (!deleteResponse.ok && deleteResponse.status !== 204) {
      return res.status(400).json({ error: 'Failed to delete file' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
