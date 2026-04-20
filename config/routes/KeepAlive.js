const express = require('express');
const pool = require('../../database/mysql-compatible');

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
    await pool.query(
      'INSERT INTO keep_alive_logs (source) VALUES (?)',
      ['keep-alive-saas']
    );

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
