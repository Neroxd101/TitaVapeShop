const express = require('express');
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../../database/supabase');
const router = express.Router();
const validId = value => typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;

async function authenticate(req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (!supabaseAdmin || !process.env.JWT_SECRET) return res.status(503).json({ success: false, error: 'Notifications are unavailable.' });
  try {
    const user = jwt.verify(req.cookies?.customer_token || '', process.env.JWT_SECRET);
    if (user.role !== 'customer' || !user.id) throw new Error('Invalid session');
    req.customerId = user.id;
  } catch (_) {
    return res.status(401).json({ success: false, error: 'Please sign in to view notifications.' });
  }
  return next();
}

router.get('/api/customer/notifications', authenticate, async (req, res) => {
  const before = req.query.before_id;
  if (before !== undefined && !validId(before)) return res.status(400).json({ success: false, error: 'Invalid notification cursor.' });
  try {
    const { data, error } = await supabaseAdmin.rpc('customer_notifications_get', {
      p_customer_id: req.customerId, p_before_id: before || null, p_limit: 20
    });
    if (error) throw error;
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('[Customer Notifications]', error.message);
    return res.status(503).json({ success: false, error: 'Unable to load notifications. Please try again.' });
  }
});

router.post('/api/customer/notifications/read', authenticate, async (req, res) => {
  const { id, through_id } = req.body || {};
  if ((id === undefined) === (through_id === undefined) || !validId(id === undefined ? through_id : id)) {
    return res.status(400).json({ success: false, error: 'Select a valid notification.' });
  }
  try {
    const { data, error } = await supabaseAdmin.rpc('customer_notifications_read', {
      p_customer_id: req.customerId, p_id: id || null, p_through_id: through_id || null
    });
    if (error) throw error;
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('[Customer Notifications Read]', error.message);
    return res.status(503).json({ success: false, error: 'Unable to mark notifications as read. Please try again.' });
  }
});
module.exports = router;
