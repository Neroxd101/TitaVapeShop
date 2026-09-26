const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../database/supabase');

router.get('/api/catalog/store-hours', async (_req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('settings').select('key, value').in('key', ['operating_open_time', 'operating_close_time', 'store_location_url', 'store_facebook_url']);
        if (error) throw error;
        const values = Object.fromEntries((data || []).map(item => [item.key, item.value]));
        const open = values.operating_open_time || '08:00';
        const close = values.operating_close_time || '20:30';
        const format = value => { const [hour, minute] = value.split(':').map(Number); const suffix = hour >= 12 ? 'PM' : 'AM'; return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`; };
        res.json({ success: true, data: { open_time: open, close_time: close, label: `${format(open)} - ${format(close)}`, location_url: values.store_location_url || 'https://maps.app.goo.gl/GzssH9xZQUN94pU38', facebook_url: values.store_facebook_url || 'https://www.facebook.com/TitasVShopNaic' } });
    } catch (error) { res.status(500).json({ success: false, error: 'Unable to load store hours' }); }
});

module.exports = router;
