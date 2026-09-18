const express = require('express');
const router = express.Router();
const path = require('path');
const { randomBytes, timingSafeEqual } = require('crypto');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Google OAuth configuration - these should be in .env
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function secureCookies() {
  return process.env.NODE_ENV === 'production' || (process.env.APP_URL || '').startsWith('https');
}

function tokenCookieOptions(maxAge, cookiePath = '/') {
  return {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'lax',
    path: cookiePath,
    maxAge
  };
}

// Protect all routes in this router - Admin only
router.use('/auth/google', isAuthenticated, hasRole(['admin']));

// Helper function to get the correct redirect URI
// For web apps deployed on Netlify, construct from request headers
// Desktop OAuth type doesn't support HTTPS redirects, so use Web Application type instead
function getRedirectUri(req) {
  // If explicit redirect URI is set (useful for production)
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }

  // Construct from base URL (for web OAuth type)
  let baseUrl;
  if (process.env.GOOGLE_REDIRECT_URI_BASE || process.env.APP_URL) {
    baseUrl = process.env.GOOGLE_REDIRECT_URI_BASE || process.env.APP_URL;
  } else {
    // Check for forwarded protocol (hosting proxies forward the original protocol)
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    // Use X-Forwarded-Host if available (when provided by the hosting proxy), otherwise fall back to Host header
    const host = req.get('x-forwarded-host') || req.get('host');
    baseUrl = `${protocol}://${host}`;
  }

  return `${baseUrl}/auth/google/callback`;
}

// GET /auth/google - Generate Google OAuth URL
router.get('/auth/google', async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    const redirectUri = getRedirectUri(req);
    const state = randomBytes(32).toString('hex');

    res.cookie('google_oauth_state', state, tokenCookieOptions(10 * 60 * 1000, '/auth/google'));

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
    authUrl.searchParams.set('state', state);

    res.json({ success: true, authUrl: authUrl.toString() });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/google/callback - Handle OAuth callback page
router.get('/auth/google/callback', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../../../frontend/admin/admin/setting/oauth-callback.html'));
});

// POST /auth/google/exchange - Exchange code for tokens
router.post('/auth/google/exchange', async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    const { code, state } = req.body;
    const expectedState = req.cookies?.google_oauth_state;

    if (!code || !state || !expectedState ||
        state.length !== expectedState.length ||
        !timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))) {
      return res.status(400).json({ error: 'Invalid or expired OAuth state' });
    }

    res.clearCookie('google_oauth_state', { path: '/auth/google' });
    const redirectUri = getRedirectUri(req);

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

    if (tokens.error || !tokens.access_token) {
      return res.status(400).json({ error: tokens.error_description || 'Failed to exchange code' });
    }

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

    res.cookie(
      'google_access_token',
      tokens.access_token,
      tokenCookieOptions(Math.max(Number(tokens.expires_in || 3600) - 60, 60) * 1000)
    );
    if (tokens.refresh_token) {
      res.cookie(
        'google_refresh_token',
        tokens.refresh_token,
        tokenCookieOptions(30 * 24 * 60 * 60 * 1000, '/auth/google')
      );
    }

    res.json({
      success: true,
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

// GET /auth/google/status - Validate the server-held access token.
router.get('/auth/google/status', async (req, res) => {
  const accessToken = req.cookies?.google_access_token;
  if (!accessToken) {
    return res.json({ success: true, connected: false });
  }

  try {
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userInfoResponse.ok) {
      res.clearCookie('google_access_token', { path: '/' });
      return res.json({ success: true, connected: false });
    }

    const userInfo = await userInfoResponse.json();
    return res.json({
      success: true,
      connected: true,
      user: {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      }
    });
  } catch (error) {
    console.error('Google status error:', error);
    return res.status(503).json({ error: 'Unable to verify Google connection' });
  }
});

// POST /auth/google/refresh - Refresh access token
router.post('/auth/google/refresh', async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    const refresh_token = req.cookies?.google_refresh_token;
    if (!refresh_token) {
      return res.status(401).json({ error: 'Google account is not connected' });
    }

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

    res.cookie(
      'google_access_token',
      tokens.access_token,
      tokenCookieOptions(Math.max(Number(tokens.expires_in || 3600) - 60, 60) * 1000)
    );
    res.json({ success: true, expires_in: tokens.expires_in });
  } catch (error) {
    console.error('Google refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/google/disconnect - Revoke token
router.post('/auth/google/disconnect', async (req, res) => {
  try {
    const token = req.cookies?.google_access_token || req.cookies?.google_refresh_token;

    if (token) {
      // Attempt to revoke the token
      await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
    }

    res.clearCookie('google_access_token', { path: '/' });
    res.clearCookie('google_refresh_token', { path: '/auth/google' });
    res.json({ success: true });
  } catch (error) {
    console.error('Google disconnect error:', error);
    res.clearCookie('google_access_token', { path: '/' });
    res.clearCookie('google_refresh_token', { path: '/auth/google' });
    res.json({ success: true });
  }
});

module.exports = router;
