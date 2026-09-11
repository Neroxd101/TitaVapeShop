const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../../database/supabase');
const { generateCode, generateVerificationEmail, sendMail } = require('./customer_mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const dbClient = () => supabaseAdmin || supabase;

/**
 * POST /api/customer/login
 * Customer Login endpoint
 * Calls RPC customer_login (or fallback customer_get_by_email), verifies bcrypt hash, and issues session cookie
 */
router.post('/api/customer/login', async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const { email, password } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    let customer = null;

    // 1. Attempt customer_login RPC (or customer_get_by_email)
    try {
      let rpcRes = await client.rpc('customer_login', { p_email: cleanEmail });
      if (rpcRes.error) {
        rpcRes = await client.rpc('customer_get_by_email', { p_email: cleanEmail });
      }
      if (!rpcRes.error && Array.isArray(rpcRes.data) && rpcRes.data.length > 0) {
        customer = rpcRes.data[0];
      }
    } catch (_) {}

    // 2. Direct fallback if RPC is not yet applied
    if (!customer) {
      const { data: directCustomer, error: customerError } = await client
        .from('customers')
        .select('id, email, password, full_name, contact_number, birthday, is_verified')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (customerError || !directCustomer) {
        return res.status(401).json({ success: false, error: 'Invalid email or password.' });
      }
      customer = directCustomer;
    }

    if (!customer.password || !bcrypt.compareSync(password, customer.password)) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    // If account is not verified, require verification
    if (!customer.is_verified) {
      const otpCode = generateCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await client.from('customer_verification_codes').insert({
        customer_id: customer.id,
        email: cleanEmail,
        otp_code: otpCode,
        expires_at: expiresAt,
        verified: false
      });

      try {
        await sendMail(
          cleanEmail,
          'Verify Your Email - Tita\'s Vape Shop',
          generateVerificationEmail(otpCode, customer.full_name)
        );
      } catch (e) {}

      return res.status(403).json({
        success: false,
        requires_verification: true,
        email: cleanEmail,
        message: 'Your email is not verified yet. A verification code has been sent to your email.'
      });
    }

    // Set cookie
    const customerPayload = {
      id: customer.id,
      email: customer.email,
      full_name: customer.full_name || '',
      contact_number: customer.contact_number || '',
      birthday: customer.birthday || null,
      role: 'customer'
    };

    const token = jwt.sign(customerPayload, JWT_SECRET, { expiresIn: '30d' });

    res.cookie('customer_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      message: 'Login successful',
      user: customerPayload
    });
  } catch (err) {
    console.error('[Customer Login] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * GET /api/customer/me
 * Check current customer session with fresh database data
 */
router.get('/api/customer/me', async (req, res) => {
  const token = req.cookies?.customer_token;
  if (!token) {
    return res.json({ authenticated: false });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const client = dbClient();

    const { data: customer, error } = await client
      .from('customers')
      .select('id, email, full_name, contact_number, birthday')
      .eq('id', decoded.id)
      .single();

    if (error || !customer) {
      return res.json({
        authenticated: true,
        user: {
          id: decoded.id,
          email: decoded.email,
          full_name: decoded.full_name || '',
          contact_number: decoded.contact_number || '',
          birthday: decoded.birthday || null
        }
      });
    }

    return res.json({
      authenticated: true,
      user: {
        id: customer.id,
        email: customer.email,
        full_name: customer.full_name || '',
        contact_number: customer.contact_number || '',
        birthday: customer.birthday || null
      }
    });
  } catch (err) {
    res.clearCookie('customer_token');
    return res.json({ authenticated: false });
  }
});

/**
 * POST /api/customer/logout
 * Log out customer
 */
router.post('/api/customer/logout', (req, res) => {
  res.clearCookie('customer_token');
  return res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
