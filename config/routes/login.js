const express = require('express');
const path = require('path');
const router = express.Router();
const jwt = require('jsonwebtoken');
const supabase = require('../database/supabase');
const JWT_SECRET = process.env.JWT_SECRET || 'tita-vape-shop-jwt-secret';

// GET /login - Serve login page
router.get('/', (req, res) => {
  // Check for JWT in cookie
  const token = req.cookies?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const roles = decoded.roles || [];
      if (roles.includes('staff')) return res.redirect('/inventory');
      if (roles.includes('supplier')) return res.redirect('/supply');
      return res.redirect('/dashboard');
    } catch (err) {
      // Invalid token, just show login page
    }
  }
  res.sendFile(path.join(__dirname, '../../public/login.html'));
});

// POST /login - JWT-based login via Edge Function
router.post('/', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    console.log('Login attempt via Edge Function for:', username);

    // Call Supabase Edge Function for verification
    const { data, error: edgeError } = await supabase.functions.invoke('login', {
      body: { username, password }
    });

    if (edgeError || !data || !data.success) {
      const message = edgeError?.message || data?.error || 'Invalid credentials';
      console.log('Edge Function login failed:', message);
      return res.status(401).json({ error: message });
    }

    const { user } = data;

    // 1. Create JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, roles: user.roles },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 2. Set Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({
      message: 'Login successful',
      user: {
        username: user.username,
        roles: user.roles
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

module.exports = router;
