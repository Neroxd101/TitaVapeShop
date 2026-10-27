const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { supabaseAdmin } = require('../../database/supabase');
router.post('/api/customer/orders/chat-read', async (req, res) => {
    const { id, through_id, phone } = req.body || {};
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        || typeof through_id !== 'string' || !/^[1-9]\d{0,18}$/.test(through_id) || BigInt(through_id) > 9223372036854775807n) {
        return res.status(400).json({ success: false, error: 'A valid order and last displayed message are required.' });
    }
    if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Chat is unavailable.' });
    try {
        let customer = null;
        if (req.cookies?.customer_token && process.env.JWT_SECRET) {
            try { customer = jwt.verify(req.cookies.customer_token, process.env.JWT_SECRET); } catch (_) {}
        }
        const { data, error } = await supabaseAdmin.rpc('customer_order_chat_read', {
            p_order_id: id, p_through_id: through_id,
            p_customer_id: customer?.id || null, p_customer_email: customer?.email || null,
            p_phone: typeof phone === 'string' ? phone.trim() : null
        });
        if (error) return res.status(error.message.includes('not authorized') ? 403 : 400).json({ success: false, error: error.message });
        return res.json({ success: true, ...data });
    } catch (error) {
        console.error('[Customer Chat Read]', error);
        return res.status(500).json({ success: false, error: 'Unable to mark messages as read.' });
    }
});
module.exports = router;
