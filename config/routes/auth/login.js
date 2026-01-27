const express = require('express');
const path = require('path');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { supabase } = require('../../database/supabase');
const JWT_SECRET = process.env.JWT_SECRET;

// GET /login - Serve login page
router.get('/', (req, res) => {
  // Check for JWT in cookie
  const token = req.cookies?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const roles = decoded.roles || [];
      if (roles.includes('staff')) return res.redirect('/sales');
      return res.redirect('/dashboard');
    } catch (err) {
      // Invalid token, just show login page
    }
  }
  res.sendFile(path.join(__dirname, '../../../public/login/login.html'));
});

// POST /login - JWT-based login via RPC Function
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      const message = 'Username and password are required';
      if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
        return res.redirect('/?error=' + encodeURIComponent(message));
      }
      return res.status(400).json({ error: message });
    }

    // Call RPC function to get user by username
    const { data: userData, error: rpcError } = await supabase.rpc('user_get_by_username', {
      p_username: username
    });

    if (rpcError || !userData || userData.length === 0) {
      const message = 'Invalid credentials';
      if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
        return res.redirect('/?error=' + encodeURIComponent(message));
      }
      return res.status(401).json({ error: message });
    }

    const user = userData[0];

    // Verify password using bcrypt
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      const message = 'Invalid credentials';
      if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
        return res.redirect('/?error=' + encodeURIComponent(message));
      }
      return res.status(401).json({ error: message });
    }

    // Update last login via RPC
    await supabase.rpc('user_update_last_login', {
      p_user_id: user.id
    });

    // Normalize roles - handle Postgres array format, string, or array
    let normalizedRoles = user.roles || [];
    if (typeof normalizedRoles === 'string') {
      if (normalizedRoles.startsWith('{') && normalizedRoles.endsWith('}')) {
        // Postgres array format: {admin,staff} or {"admin","staff"}
        normalizedRoles = normalizedRoles.slice(1, -1).split(',').map(r => r.trim().replace(/^"|"$/g, ''));
      } else {
        try {
          normalizedRoles = JSON.parse(normalizedRoles);
        } catch (e) {
          normalizedRoles = [normalizedRoles];
        }
      }
    }
    if (!Array.isArray(normalizedRoles)) {
      normalizedRoles = normalizedRoles ? [normalizedRoles] : [];
    }

    // 1. Create JWT with normalized roles
    const token = jwt.sign(
      { id: user.id, username: user.username, roles: normalizedRoles },
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

    // 3. Handle response based on request type
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      if (normalizedRoles.includes('staff')) return res.redirect('/sales');
      return res.redirect('/dashboard');
    }

    res.json({
      message: 'Login successful',
      user: {
        username: user.username,
        roles: normalizedRoles
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      return res.redirect('/?error=' + encodeURIComponent(error.message || 'Internal server error'));
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/logout
router.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// GET /me - Get current user info from JWT
router.get('/me', (req, res) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({
      user: {
        username: decoded.username,
        roles: decoded.roles
      }
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
