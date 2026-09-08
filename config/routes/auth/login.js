const express = require('express');
const path = require('path');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { supabase } = require('../../database/supabase');
const JWT_SECRET = process.env.JWT_SECRET;

// GET /login - Serve login page
// This route checks if user is already logged in and redirects them accordingly
router.get('/login', (req, res) => {
  // Step 1: Check if user has an existing authentication token in cookies
  const token = req.cookies?.token;
  
  if (token) {
    try {
      // Step 2: Verify and decode the JWT token
      // If token is valid, user is already authenticated
      const decoded = jwt.verify(token, JWT_SECRET);
      const roles = decoded.roles;
      
      // Step 3: Redirect authenticated users based on their role
      // Staff users should go to sales page, not dashboard
      if (roles.includes('staff')) return res.redirect('/sales');
      // Admin and other users go to dashboard
      return res.redirect('/dashboard');
    } catch (err) {
      // Step 4: If token is invalid/expired, ignore error and show login page
      // This allows users with expired tokens to log in again
    }
  }
  
  // Step 5: If no token or invalid token, serve the login page
  res.sendFile(path.join(__dirname, '../../../public/login/login.html'));
});

// POST /login - Handle user login
// This route authenticates users by verifying credentials and creating a JWT session
router.post('/login', async (req, res) => {
  try {
    // Step 1: Extract username and password from request body
    const { username, password } = req.body;

    // Step 2: Validate that both username and password are provided
    if (!username || !password) {
      const message = 'Username and password are required';
      // Check if request is from HTML form (form-urlencoded) or API (JSON)
      return req.headers['content-type'] === 'application/x-www-form-urlencoded'
        ? res.redirect('/login?error=' + encodeURIComponent(message))
        : res.status(400).json({ error: message });
    }

    // Step 3: Check if Supabase client is configured
    if (!supabase) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Step 4: Query database to find user by username
    // Uses RPC (Remote Procedure Call) to execute PostgreSQL function
    const { data: userData, error: rpcError } = await supabase.rpc('user_get_by_username', {
      p_username: username
    });

    // Step 5: Check if user exists in database
    if (rpcError || !userData || userData.length === 0) {
      const message = 'Invalid credentials';
      return req.headers['content-type'] === 'application/x-www-form-urlencoded'
        ? res.redirect('/login?error=' + encodeURIComponent(message))
        : res.status(401).json({ error: message });
    }

    // Step 6: Get user object from query result
    const user = userData[0];

    // Step 7: Verify password using bcrypt
    // bcrypt.compareSync compares plain password with hashed password from database
    if (!user.password || !bcrypt.compareSync(password, user.password)) {
      const message = 'Invalid credentials';
      return req.headers['content-type'] === 'application/x-www-form-urlencoded'
        ? res.redirect('/login?error=' + encodeURIComponent(message))
        : res.status(401).json({ error: message });
    }

    // Step 8: Update user's last login timestamp in database
    await supabase.rpc('user_update_last_login', { p_user_id: user.id });

    // Step 9: Get user roles (stored as TEXT string, e.g., "admin,staff")
    const roles = user.roles;

    // Step 10: Create JWT (JSON Web Token) containing user info
    // JWT is signed with secret key and expires in 24 hours
    const token = jwt.sign(
      { id: user.id, username: user.username, roles },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Step 11: Set JWT as HTTP-only cookie for security
    // httpOnly: prevents JavaScript access (XSS protection)
    // secure: only sent over HTTPS in production
    // sameSite: prevents CSRF attacks
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    });

    // Step 12: Redirect user based on their role
    // Staff users go to sales page, others (admin) go to dashboard
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      return roles.includes('staff') ? res.redirect('/sales') : res.redirect('/dashboard');
    }
    
    // Step 13: For API requests, return JSON response with success message
    res.json({
      message: 'Login successful',
      user: { username: user.username, roles }
    });
  } catch (error) {
    // Step 14: Handle any unexpected errors
    console.error('Login error:', error);
    const message = error.message || 'Internal server error';
    return req.headers['content-type'] === 'application/x-www-form-urlencoded'
      ? res.redirect('/login?error=' + encodeURIComponent(message))
      : res.status(500).json({ error: message });
  }
});

// POST /api/logout
router.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

module.exports = router;
