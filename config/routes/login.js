const express = require('express');
const path = require('path');
const router = express.Router();
const supabase = require('../database/supabase');

// GET /login - Serve login page
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/login.html'));
});

// POST /login - Forward to Supabase Edge Function
router.post('/', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Call Supabase Edge Function for login logic (runs close to database)
    const { data, error } = await supabase.functions.invoke('login', {
      body: { email, password }
    });

    if (error) {
      return res.status(401).json({ error: error.message || 'Login failed' });
    }

    res.json(data);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
