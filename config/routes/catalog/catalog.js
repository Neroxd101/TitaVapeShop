const express = require('express');
const path = require('path');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../../database/supabase');
const { sendOrderEmail } = require('../orders/orders_email');
const JWT_SECRET = process.env.JWT_SECRET;

// =============================================
// PUBLIC ROUTES - No authentication required
// These routes are accessible to anyone (customers)
// =============================================

// Public product catalog page - accessible without login
// GET /catalog
router.get(['/', '/catalog'], (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/catalog/catalog.html'));
});

// Public order status tracking page
// GET /order-status
router.get('/order-status', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/order-status/order-status.html'));
});

router.get('/order-status/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/order-status/order-status.html'));
});

// Public product catalog modal HTML - accessible without login
// GET /catalog/catalog-product-modal.html
router.get('/catalog/catalog-product-modal.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/catalog/catalog-product-modal.html'));
});

// Public cart modal HTML
router.get('/catalog/catalog-cart-modal.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/catalog/catalog-cart-modal.html'));
});

// Public privacy modal HTML
router.get('/catalog/catalog-privacy-modal.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/catalog/catalog-privacy-modal.html'));
});

// Public checkout modal HTML
router.get('/catalog/catalog-checkout-modal.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/catalog/catalog-checkout-modal.html'));
});

// Public order success modal HTML
router.get('/catalog/catalog-order-success-modal.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/catalog/catalog-order-success-modal.html'));
});

// Public customer recent orders modal HTML
router.get('/catalog/catalog-orders-modal.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/catalog/catalog-orders-modal.html'));
});

// Public customer auth modal HTML
router.get('/catalog/customer-auth-modal.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/catalog/customer-auth-modal.html'));
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

// Public Google Drive image proxy for catalog
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

// Create order from catalog (Requires verified customer account)
// POST /api/orders/create
router.post('/api/orders/create', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    // Enforce customer account & email verification
    const customerToken = req.cookies?.customer_token;
    if (!customerToken) {
      return res.status(401).json({
        success: false,
        error: 'Please sign in or create a verified customer account to place an order.'
      });
    }

    let customerPayload = null;
    try {
      customerPayload = jwt.verify(customerToken, JWT_SECRET);
    } catch (tokenErr) {
      return res.status(401).json({
        success: false,
        error: 'Your session has expired. Please sign in again.'
      });
    }

    const client = supabaseAdmin || supabase;
    const { data: dbCustomer, error: customerErr } = await client
      .from('customers')
      .select('id, is_verified, email, full_name, contact_number')
      .eq('id', customerPayload.id)
      .maybeSingle();

    if (customerErr || !dbCustomer || !dbCustomer.is_verified) {
      return res.status(403).json({
        success: false,
        error: 'Your email address is not verified yet. Please verify your email before placing an order.'
      });
    }

    const { customer_name, contact_number, social_media, customer_email, order_type, items, total_amount } = req.body;

    const finalEmail = dbCustomer.email || customer_email;
    const finalName = customer_name || dbCustomer.full_name;
    const finalContact = contact_number || dbCustomer.contact_number;

    // Stock check (prevents ordering more than available)
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Order must contain at least one item' });
    }

    const requested = items
      .map(i => ({
        id: i?.id,
        quantity: Number.isFinite(Number(i?.quantity)) ? Number(i.quantity) : NaN
      }))
      .filter(i => i.id);

    if (requested.length === 0 || requested.some(i => !Number.isInteger(i.quantity) || i.quantity <= 0)) {
      return res.status(400).json({ success: false, error: 'Invalid items payload' });
    }

    const inventoryClient = supabaseAdmin || supabase;
    const uniqueIds = [...new Set(requested.map(i => i.id))];
    const { data: invRows, error: invError } = await inventoryClient
      .from('inventory')
      .select('id,name,quantity')
      .in('id', uniqueIds);

    if (invError) {
      console.error('Inventory check error:', invError);
      return res.status(400).json({ success: false, error: invError.message || 'Failed to validate stock' });
    }

    const invMap = new Map((invRows || []).map(r => [r.id, r]));
    const insufficient = requested
      .map(r => {
        const row = invMap.get(r.id);
        const available = row?.quantity ?? 0;
        return {
          id: r.id,
          name: row?.name || null,
          requested: r.quantity,
          available
        };
      })
      .filter(x => x.requested > x.available);

    if (insufficient.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Insufficient stock',
        items: insufficient
      });
    }

    // Call database RPC function
    const { data, error } = await supabase.rpc('orders_create_order', {
        p_customer_name: finalName,
        p_contact_number: finalContact,
        p_social_media: social_media || null,
        p_customer_email: finalEmail,
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

    // Link customer_id to order in database
    if (order && order.id) {
      try {
        await client
          .from('orders')
          .update({ customer_id: dbCustomer.id })
          .eq('id', order.id);
      } catch (linkErr) {
        console.error('Failed to link customer_id to order:', linkErr);
      }
    }

    const trackingUrl = `/order-status?id=${order.id}`;

    // Send order confirmation email
    if (order && finalEmail) {
      try {
        await sendOrderEmail(
          finalEmail,
          finalName,
          order.id,
          'pending',
          {
            items: items,
            total_amount: total_amount,
            order_type: order_type,
            trackingUrl: trackingUrl
          }
        );
      } catch (emailError) {
        console.error('[Order Creation] Error sending email:', emailError);
      }
    }

    res.json({
      success: true,
      order: order,
      trackingUrl: trackingUrl
    });
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/orders/track
router.get('/api/orders/track', async (req, res) => {
  try {
    const { id, phone } = req.query;
    const targetOrderId = id;

    if (!targetOrderId || typeof targetOrderId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetOrderId)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid order ID'
      });
    }

    const client = supabaseAdmin || supabase;
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    const { data: order, error } = await client
      .from('orders')
      .select('id, customer_name, contact_number, social_media, customer_email, customer_id, order_type, items, total_amount, status, created_at, updated_at')
      .eq('id', targetOrderId)
      .maybeSingle();

    if (error || !order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    let isVerified = false;

    // Verify if logged-in customer owns this order
    if (req.cookies && req.cookies.customer_token && JWT_SECRET) {
      try {
        const decCust = jwt.verify(req.cookies.customer_token, JWT_SECRET);
        if (decCust && decCust.id && (order.customer_id === decCust.id || order.customer_email === decCust.email)) {
          isVerified = true;
        }
      } catch (e) {}
    }

    if (!isVerified) {
      if (!phone) {
        return res.status(401).json({
          success: false,
          requiresPhone: true,
          error: 'Please enter the contact number used during checkout to view this order.'
        });
      }

      const inputDigits = String(phone).replace(/\D/g, '');
      const orderDigits = String(order.contact_number || '').replace(/\D/g, '');

      const isMatch =
        (inputDigits.length >= 4 && orderDigits.endsWith(inputDigits)) ||
        orderDigits === inputDigits;

      if (!isMatch) {
        return res.status(403).json({
          success: false,
          error: 'The contact number entered does not match this order.'
        });
      }
    }

    res.json({
      success: true,
      order: order
    });
  } catch (err) {
    console.error('Order tracking API error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve order status' });
  }
});

// Customers may cancel only their own pending orders.
router.post('/api/orders/cancel', async (req, res) => {
  const { id, phone } = req.body || {};
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ success: false, error: 'A valid order ID is required.' });
  }
  if (!supabaseAdmin) {
    return res.status(503).json({ success: false, error: 'Order cancellation is currently unavailable.' });
  }

  // Check if customer is logged in
  let customerLoggedIn = null;
  if (req.cookies?.customer_token && JWT_SECRET) {
    try {
      customerLoggedIn = jwt.verify(req.cookies.customer_token, JWT_SECRET);
    } catch (_) {}
  }

  // Verify ownership
  const { data: existingOrder, error: fetchErr } = await supabaseAdmin
    .from('orders')
    .select('id, customer_id, customer_email, contact_number, status')
    .eq('id', id)
    .eq('status', 'pending')
    .maybeSingle();

  if (fetchErr || !existingOrder) {
    return res.status(409).json({ success: false, error: 'Only pending orders can be cancelled. This order may already have been updated.' });
  }

  let isVerified = false;
  if (customerLoggedIn && (existingOrder.customer_id === customerLoggedIn.id || existingOrder.customer_email === customerLoggedIn.email)) {
    isVerified = true;
  } else if (phone) {
    const inputDigits = String(phone).replace(/\D/g, '');
    const orderDigits = String(existingOrder.contact_number || '').replace(/\D/g, '');
    if ((inputDigits.length >= 4 && orderDigits.endsWith(inputDigits)) || orderDigits === inputDigits) {
      isVerified = true;
    }
  }

  if (!isVerified) {
    return res.status(403).json({ success: false, error: 'You are not authorized to cancel this order. Please sign in with your account.' });
  }

  try {
    const { data: order, error } = await supabaseAdmin.from('orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id, customer_name, contact_number, social_media, customer_email, order_type, items, total_amount, status, created_at, updated_at')
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      return res.status(409).json({ success: false, error: 'Only pending orders can be cancelled. This order may already have been updated.' });
    }

    const { error: logError } = await supabaseAdmin.rpc('transactions_log', {
      p_action_type: 'order_cancel',
      p_user_email: customerLoggedIn ? customerLoggedIn.email : 'Customer',
      p_entity_id: order.id,
      p_entity_type: 'order',
      p_sale_total: order.total_amount,
      p_sale_items: order.items,
      p_customer_name: order.customer_name,
      p_customer_email: order.customer_email,
      p_details: {
        order_id: order.id,
        order_type: order.order_type,
        previous_status: 'pending',
        cancelled_by: 'customer',
        items_count: Array.isArray(order.items) ? order.items.length : 0
      }
    });
    if (logError) console.error('Customer cancellation audit log failed:', logError);
    return res.json({ success: true, order });
  } catch (error) {
    console.error('Order cancellation failed:', error);
    return res.status(500).json({ success: false, error: 'Unable to cancel your order. Please try again.' });
  }
});

// Track batch orders for customer's recent orders modal
// POST /api/orders/track-batch
router.post('/api/orders/track-batch', async (req, res) => {
  try {
    const client = supabaseAdmin || supabase;
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    // Require verified logged-in customer session
    let loggedInCustomer = null;
    if (req.cookies?.customer_token && JWT_SECRET) {
      try {
        loggedInCustomer = jwt.verify(req.cookies.customer_token, JWT_SECRET);
      } catch (e) {}
    }

    if (!loggedInCustomer || !loggedInCustomer.id) {
      return res.json({
        success: false,
        requiresAuth: true,
        error: 'Please sign in to view your orders.',
        orders: []
      });
    }

    const { data: orderRows, error } = await client
      .from('orders')
      .select('id, customer_name, order_type, total_amount, status, created_at, items')
      .or(`customer_id.eq.${loggedInCustomer.id},customer_email.eq.${loggedInCustomer.email}`)
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    const results = (orderRows || []).map(row => ({
      id: row.id,
      customer_name: row.customer_name,
      order_type: row.order_type,
      total_amount: row.total_amount,
      status: row.status,
      created_at: row.created_at,
      items_count: Array.isArray(row.items) ? row.items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0) : 0
    }));

    res.json({ success: true, orders: results });
  } catch (err) {
    console.error('Batch order tracking error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
