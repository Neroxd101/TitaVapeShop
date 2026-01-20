const express = require('express');
const path = require('path');
const router = express.Router();
const supabase = require('../database/supabase');

// GET /login - Serve login page
router.get('/', (req, res) => {
  // If already logged in, redirect based on role
  if (req.session.user) {
    const roles = req.session.user.roles || [];
    if (roles.includes('staff')) return res.redirect('/inventory');
    if (roles.includes('supplier')) return res.redirect('/supply');
    return res.redirect('/dashboard');
  }
  res.sendFile(path.join(__dirname, '../../public/login.html'));
});

// POST /login - Local session-based login via Edge Function
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
      // Edge function library might throw or return error in body
      const message = edgeError?.message || data?.error || 'Invalid credentials';
      console.log('Edge Function login failed:', message);
      return res.status(401).json({ error: message });
    }

    const { user } = data;

    // 1. Store user info in session
    req.session.user = {
      id: user.id,
      username: user.username,
      roles: user.roles
    };

    // Explicitly save session before responding to ensure the cookie is set
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session could not be saved' });
      }
      res.json({
        message: 'Login successful',
        user: {
          username: user.username,
          roles: user.roles
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

module.exports = router;
