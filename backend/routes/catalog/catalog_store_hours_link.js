const express = require('express');
const router = express.Router();
const { getStoreProfile } = require('../../services/store-profile');

router.get('/api/catalog/store-hours', async (_req, res) => {
    try {
        return res.json({ success: true, data: await getStoreProfile() });
    } catch {
        return res.status(500).json({ success: false, error: 'Unable to load store hours' });
    }
});

module.exports = router;
