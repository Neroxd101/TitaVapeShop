const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');
router.post('/api/orders/chat-read', isAuthenticated, hasRole(['admin', 'staff']), async (req, res) => {
    const { id, through_id } = req.body || {};
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        || typeof through_id !== 'string' || !/^[1-9]\d{0,18}$/.test(through_id) || BigInt(through_id) > 9223372036854775807n) {
        return res.status(400).json({ success: false, error: 'A valid order and last displayed message are required.' });
    }
    if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Chat is unavailable.' });
    try {
        const { data, error } = await supabaseAdmin.rpc('orders_chat_read', { p_order_id: id, p_through_id: through_id });
        if (error) return res.status(400).json({ success: false, error: error.message });
        return res.json({ success: true, ...data });
    } catch (error) {
        console.error('[Store Chat Read]', error);
        return res.status(500).json({ success: false, error: 'Unable to mark messages as read.' });
    }
});
router.get('/api/orders/chat-unread', isAuthenticated, hasRole(['admin', 'staff']), async (req, res) => {
    const ids = typeof req.query.ids === 'string' && req.query.ids ? req.query.ids.split(',') : [];
    if (ids.length > 200 || ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
        return res.status(400).json({ success: false, error: 'Invalid order IDs.' });
    }
    if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Chat is unavailable.' });
    try {
        const { data, error } = await supabaseAdmin.rpc('orders_chat_unread', { p_order_ids: [...new Set(ids)] });
        if (error) return res.status(400).json({ success: false, error: error.message });
        res.set('Cache-Control', 'private, no-store');
        return res.json({ success: true, counts: data });
    } catch (error) {
        console.error('[Store Chat Unread]', error);
        return res.status(500).json({ success: false, error: 'Unable to load unread counts.' });
    }
});
module.exports = router;
