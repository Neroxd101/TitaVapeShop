const express = require('express');
const path = require('path');
const router = express.Router();
const { supabase } = require('../database/supabase');

// =============================================
// PUBLIC ROUTES - No authentication required
// These routes are accessible to anyone (customers)
// =============================================

// Public product catalog page - accessible without login
// GET /catalog
router.get('/catalog', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/catalog/catalog.html'));
});

// Public inventory list for catalog
// GET /api/inventory/list
router.get('/api/inventory/list', async (req, res) => {
  try {
    if (!supabase) {
      return res
        .status(500)
        .json({ success: false, error: 'Database not configured' });
    }

    const { category, search } = req.query;

    // Call database RPC function directly
    // All filtering and sorting is done in the database
    const { data, error } = await supabase.rpc('inventory_get_all', {
      filter_category: category || null,
      filter_search: search || null
    });

    if (error) {
      console.error('RPC Error:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to fetch catalog items'
      });
    }

    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Catalog inventory fetch error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Public Google Drive image proxy for catalog (no authentication required)
// GET /api/catalog/image/:fileId
router.get('/api/catalog/image/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const directUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=view`;
    
    try {
      const imageResponse = await fetch(directUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        }
      });

      if (imageResponse.ok) {
        const contentType = imageResponse.headers.get('content-type');
        
        if (contentType && contentType.includes('text/html')) {
          // If HTML response, try thumbnail endpoint
          const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
          const thumbResponse = await fetch(thumbnailUrl, {
            method: 'GET',
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          
          if (thumbResponse.ok) {
            const thumbBuffer = await thumbResponse.arrayBuffer();
            res.setHeader('Content-Type', thumbResponse.headers.get('content-type') || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.send(Buffer.from(thumbBuffer));
            return;
          }
        } else {
          // Direct image response
          const imageBuffer = await imageResponse.arrayBuffer();
          res.setHeader('Content-Type', contentType || 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=31536000');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.send(Buffer.from(imageBuffer));
          return;
        }
      }
    } catch (fetchError) {
      console.error('Error fetching image from Google Drive:', fetchError);
    }

    res.redirect(directUrl);
  } catch (err) {
    console.error('Catalog image proxy error:', err);
    res.status(500).json({ success: false, error: 'Failed to load image' });
  }
});

// Create order from catalog
// POST /api/orders/create
router.post('/api/orders/create', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

        const { customer_name, contact_number, social_media, order_type, items, total_amount } = req.body;

        // Call database RPC function
        const { data, error } = await supabase.rpc('orders_create_order', {
            p_customer_name: customer_name,
            p_contact_number: contact_number,
            p_social_media: social_media || null,
            p_order_type: order_type || 'pickup',
            p_items: items,
            p_total_amount: total_amount
        });

    if (error) {
      console.error('RPC Error:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to create order'
      });
    }

    // RPC function returns an array, get the first element
    const order = Array.isArray(data) && data.length > 0 ? data[0] : data;
    res.json({ success: true, order: order });
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;

