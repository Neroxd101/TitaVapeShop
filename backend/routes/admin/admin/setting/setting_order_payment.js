const express = require('express');
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

const router = express.Router();
const key = 'order_status_payment_details';
const defaults = {
    account_name: 'RY*N CH********R S.',
    account_number: '0938 066 9484',
    qr_image: '/qr/qr_gcash.jpg'
};

function isQrImage(value) {
    if (value === defaults.qr_image) return true;
    if (typeof value !== 'string' || value.length > 700000) return false;
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) return false;

    const [, type, encoded] = match;
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length > 512 * 1024 || bytes.toString('base64') !== encoded) return false;
    if (type === 'png') return bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
    if (type === 'jpeg') return bytes.subarray(0, 3).toString('hex') === 'ffd8ff';
    return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

router.get('/api/order-status/payment-details', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const { data, error } = await supabaseAdmin.from('settings').select('value').eq('key', key).maybeSingle();
        if (error) throw error;
        return res.json({ success: true, data: data?.value ?? defaults });
    } catch (error) {
        console.error('[Order Payment Settings] Load failed:', error.message);
        return res.status(503).json({ success: false, error: 'Payment details are temporarily unavailable.' });
    }
});

router.post('/api/settings/order-payment', isAuthenticated, hasRole(['admin']), async (req, res) => {
    const { account_name, account_number, qr_image } = req.body || {};
    const name = typeof account_name === 'string' ? account_name.trim() : '';
    const number = typeof account_number === 'string' ? account_number.trim() : '';
    if (!name || name.length > 50) {
        return res.status(400).json({ success: false, error: 'Enter an account name of up to 50 characters.' });
    }
    if (!/^[0-9]{11}$/.test(number)) {
        return res.status(400).json({ success: false, error: 'Enter an account number with exactly 11 digits.' });
    }
    if (!isQrImage(qr_image)) {
        return res.status(400).json({ success: false, error: 'Select a PNG, JPG, or WebP QR image up to 512 KB.' });
    }

    try {
        const { error } = await supabaseAdmin.from('settings').upsert({
            key,
            value: { account_name: name, account_number: number, qr_image },
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        if (error) throw error;
        return res.json({ success: true });
    } catch (error) {
        console.error('[Order Payment Settings] Save failed:', error.message);
        return res.status(503).json({ success: false, error: 'Could not save the payment details. Please try again.' });
    }
});

module.exports = router;
