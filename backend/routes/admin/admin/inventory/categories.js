const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

router.get('/inventory/categories', isAuthenticated, hasRole(['admin', 'staff']), async (_req, res) => {
  const { data, error } = await supabaseAdmin.rpc('categories_get_all');
  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true, categories: data || [] });
});

router.post('/inventory/categories', isAuthenticated, hasRole(['admin']), async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const { data, error } = await supabaseAdmin.rpc('category_create', { p_name: name, p_user_email: req.user?.username || req.user?.email || null });
  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true, category: Array.isArray(data) ? data[0] : data });
});

router.delete('/inventory/categories/:slug', isAuthenticated, hasRole(['admin']), async (req, res) => {
  const slug = typeof req.params.slug === 'string' ? req.params.slug.trim() : '';
  const { error } = await supabaseAdmin.rpc('category_delete', { p_slug: slug, p_user_email: req.user?.username || req.user?.email || null });
  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true });
});

module.exports = router;
