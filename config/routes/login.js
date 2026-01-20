const express = require('express');
const path = require('path');
const router = express.Router();
const bcrypt = require('bcryptjs');
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

// POST /login - Local session-based login
router.post('/', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // 1. Find user by username
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    console.log('Login attempt for:', username);

    if (findError || !user) {
      console.log('User not found or database error:', findError?.message);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2. Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3. Store user info in session
    req.session.user = {
      id: user.id,
      username: user.username,
      roles: user.roles
    };

    // 4. Update last login (fire and forget)
    supabase.from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id)
      .then(({ error }) => {
        if (error) console.error('Error updating last login:', error);
      });

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
