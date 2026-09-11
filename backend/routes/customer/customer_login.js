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

    // 1. Call customer_login RPC
    const { data: rpcData, error: rpcError } = await client.rpc('customer_login', { p_email: cleanEmail });

    if (rpcError || !Array.isArray(rpcData) || rpcData.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const customer = rpcData[0];

    if (!customer.password || !bcrypt.compareSync(password, customer.password)) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    // If account is not verified, generate OTP via RPC and prompt verification
    if (!customer.is_verified) {
      try {
        const { data: otpResult } = await client.rpc('customer_generate_otp', {
          p_email: cleanEmail,
          p_customer_id: customer.id
        });

        if (otpResult && otpResult.success && otpResult.otp_code) {
          await sendMail(
            cleanEmail,
            'Verify Your Email - Tita\'s Vape Shop',
            generateVerificationEmail(otpResult.otp_code, customer.full_name || 'Customer')
          );
        }
      } catch (e) {
        console.error('[Customer Login] OTP dispatch error:', e);
      }

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
      .maybeSingle();

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
