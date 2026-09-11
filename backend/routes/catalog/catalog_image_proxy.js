const express = require('express');
const path = require('path');
const router = express.Router();

/**
 * Public Google Drive image proxy for catalog items
 * GET /api/catalog/image/:fileId
 * Streams Google Drive product images with public caching headers.
 * Uses high-res thumbnail and lh3 endpoints (avoids forbidden drive.usercontent.google.com).
 */
router.get('/api/catalog/image/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!fileId || typeof fileId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      return res.status(400).json({ success: false, error: 'Invalid file ID' });
    }

    const targetUrls = [
      `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1000`,
      `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}`
    ];

    for (const imgUrl of targetUrls) {
      try {
        const response = await fetch(imgUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
          }
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && !contentType.includes('text/html')) {
            const buffer = await response.arrayBuffer();
            res.setHeader('Content-Type', contentType || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.send(Buffer.from(buffer));
          }
        }
      } catch (err) {
        console.warn(`[Catalog Image Proxy] Failed fetching from ${imgUrl}:`, err.message);
      }
    }

    // If both endpoints fail, serve default placeholder image
    const placeholderPath = path.join(__dirname, '../../../frontend/img/placeholder-product.png');
    return res.sendFile(placeholderPath);
  } catch (err) {
    console.error('[Catalog Image Proxy] Server error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load image' });
  }
});

module.exports = router;
