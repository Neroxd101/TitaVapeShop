const express = require('express');
const path = require('path');
const router = express.Router();

// Google OAuth configuration - these should be in .env
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// GET /auth/google - Generate Google OAuth URL
router.get('/', async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/auth/google/callback`;
    
    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    res.json({ success: true, authUrl: authUrl.toString() });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/google/callback - Handle OAuth callback page
router.get('/callback', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/google-callback.html'));
});

// POST /auth/google/exchange - Exchange code for tokens
router.post('/exchange', async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    const { code } = req.body;
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/google/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      return res.status(400).json({ error: tokens.error_description || 'Failed to exchange code' });
    }

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

    res.json({
      success: true,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
      },
      user: {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      },
    });
  } catch (error) {
    console.error('Google exchange error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/google/refresh - Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    const { refresh_token } = req.body;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      return res.status(400).json({ error: tokens.error_description || 'Failed to refresh token' });
    }

    res.json({
      success: true,
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
    });
  } catch (error) {
    console.error('Google refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
