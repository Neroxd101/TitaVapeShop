const express = require('express');
const path = require('path');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { supabase, supabaseAdmin } = require('../../../database/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const dbClient = () => supabaseAdmin || supabase;

/**
 * Helper to serve the admin/staff login page
 * Redirects already-authenticated users based on their role:
 * - staff -> /sales (POS)
 * - admin -> /dashboard
 */
function serveLoginPage(req, res) {
  const token = req.cookies?.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const roles = decoded.roles || [];
      const roleList = Array.isArray(roles) ? roles : String(roles).split(',').map(r => r.trim());

      // Staff users go to staff POS; admin goes to dashboard
      if (roleList.includes('staff')) {
        return res.redirect('/staff/pos');
      }
      return res.redirect('/dashboard');
    } catch (_) {
      // Invalid/expired token: continue to render login page
    }
  }

  res.sendFile(path.join(__dirname, '../../../../public/admin/login/login.html'));
}

// GET /login and GET /admin/login - Serve login page
router.get('/login', serveLoginPage);
router.get('/admin/login', serveLoginPage);

/**
 * Handle authentication for admin & staff
 * Determines user role upon login
 */
async function handleLogin(req, res) {
  try {
    const { username, password } = req.body;
    const cleanUsername = (username || '').trim();

    if (!cleanUsername || !password) {
      const message = 'Username and password are required';
      return req.headers['content-type'] === 'application/x-www-form-urlencoded'
        ? res.redirect('/login?error=' + encodeURIComponent(message))
        : res.status(400).json({ success: false, error: message });
    }

    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    let user = null;

    // 1. Try primary admin_login RPC
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('admin_login', {
        p_username: cleanUsername
      });
      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        user = rpcData[0];
      }
    } catch (_) {}

    // 2. Fallback: try legacy user_get_by_username RPC
    if (!user) {
      try {
        const { data: legacyData, error: legacyError } = await client.rpc('user_get_by_username', {
          p_username: cleanUsername
        });
        if (!legacyError && Array.isArray(legacyData) && legacyData.length > 0) {
          user = legacyData[0];
        }
      } catch (_) {}
    }

    // 3. Fallback: direct table query if RPCs not yet executed
    if (!user) {
      const { data: directData, error: directError } = await client
        .from('users')
        .select('id, username, email, password, roles, last_login, created_at')
        .or(`username.ilike.${cleanUsername},email.ilike.${cleanUsername}`)
        .maybeSingle();

      if (!directError && directData) {
        user = directData;
      }
    }

    // Verify credentials
    if (!user || !user.password || !bcrypt.compareSync(password, user.password)) {
      const message = 'Invalid credentials';
      return req.headers['content-type'] === 'application/x-www-form-urlencoded'
        ? res.redirect('/login?error=' + encodeURIComponent(message))
        : res.status(401).json({ success: false, error: message });
    }

    // Update last login timestamp in background
    try {
      await client.rpc('admin_update_last_login', { p_user_id: user.id });
    } catch (_) {
      try {
        await client.rpc('user_update_last_login', { p_user_id: user.id });
      } catch (_) {
        await client.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);
      }
    }

    const roles = user.roles || '';
    const roleList = Array.isArray(roles) ? roles : String(roles).split(',').map(r => r.trim());

    // Generate JWT token (24h)
    const token = jwt.sign(
      { id: user.id, username: user.username, roles },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      return roleList.includes('staff') ? res.redirect('/staff/pos') : res.redirect('/dashboard');
    }

    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles
      }
    });
  } catch (error) {
    console.error('[Admin Login] Error:', error);
    const message = error.message || 'Internal server error';
    return req.headers['content-type'] === 'application/x-www-form-urlencoded'
      ? res.redirect('/login?error=' + encodeURIComponent(message))
      : res.status(500).json({ success: false, error: message });
  }
}

// POST /login, POST /api/admin/login, POST /api/login
router.post('/login', handleLogin);
router.post('/api/admin/login', handleLogin);
router.post('/api/login', handleLogin);

/**
 * Handle admin / staff logout
 */
function handleLogout(req, res) {
  res.clearCookie('token');
  if (req.headers['accept']?.includes('text/html')) {
    return res.redirect('/login');
  }
  return res.json({ success: true, message: 'Logged out' });
}

// POST /api/logout and POST /api/admin/logout
router.post('/api/logout', handleLogout);
router.post('/api/admin/logout', handleLogout);

module.exports = router;
