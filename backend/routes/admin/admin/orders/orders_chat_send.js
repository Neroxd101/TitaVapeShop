const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

router.post('/api/orders/chat-send', isAuthenticated, hasRole(['admin']), async (req, res) => {
    const { id, message } = req.body || {};
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        || typeof message !== 'string' || !message.trim() || message.trim().length > 1000) {
        return res.status(400).json({ success: false, error: 'A valid order ID and a message of 1–1,000 characters are required.' });
    }
    if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Chat are unavailable.' });
    try {
        const { data, error } = await supabaseAdmin.rpc('orders_chat_send', { p_order_id: id, p_message: message.trim() });
        if (error) return res.status(400).json({ success: false, error: error.message });
        const sent = Array.isArray(data) ? data[0] : data;
        if (!sent) return res.status(404).json({ success: false, error: 'Order not found.' });
        return res.json({ success: true, message: sent });
    } catch (error) {
        console.error('[Admin Chat Send] Error:', error);
        return res.status(500).json({ success: false, error: 'Unable to save message.' });
    }
});
module.exports = router;
