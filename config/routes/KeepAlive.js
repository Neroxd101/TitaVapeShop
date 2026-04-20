const express = require('express');
const { supabaseAdmin } = require('../database/supabase');

const keepAliveRouter = express.Router();

keepAliveRouter.get('/', async (req, res) => {
  const expectedToken = process.env.KEEP_ALIVE_TOKEN;
  const providedToken = req.get('x-keep-alive-token') || req.query.token;

  if (!expectedToken) {
    return res.status(500).json({
      success: false,
      message: 'KEEP_ALIVE_TOKEN is not configured'
    });
  }

  if (providedToken !== expectedToken) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized keep-alive request'
    });
  }

  try {
    if (!supabaseAdmin) {
      return res.status(500).json({
        success: false,
        message: 'Database not configured'
      });
    }

    const { error } = await supabaseAdmin
      .from('keep_alive_logs')
      .insert({ source: 'keep-alive-saas' });

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      message: 'Keep-alive log inserted',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Keep-alive insert error:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Database unavailable',
      error: error.message
    });
  }
});

module.exports = keepAliveRouter;
