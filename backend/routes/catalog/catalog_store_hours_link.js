const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../database/supabase');

router.get('/api/catalog/store-hours', async (_req, res) => {
    try {
        const { data } = await supabaseAdmin.rpc('catalog_store_hours_link');
        const [storeHours] = Array.isArray(data) ? data : [data];
        const { open_time: open, close_time: close, location_url, facebook_url } = storeHours;
        const format = value => {
            const [hour, minute] = value.split(':').map(Number);
            const suffix = hour >= 12 ? 'PM' : 'AM';
            return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
        };

        return res.json({
            success: true,
            data: {
                open_time: open,
                close_time: close,
                label: `${format(open)} - ${format(close)}`,
                location_url,
                facebook_url
            }
        });
    } catch {
        return res.status(500).json({ success: false, error: 'Unable to load store hours' });
    }
});

module.exports = router;
