const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../../database/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const dbClient = () => supabaseAdmin || supabase;

/**
 * Generate 6-digit verification code
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate Customer Verification Email HTML
 */
function generateVerificationEmail(code, fullName) {
  const name = fullName ? fullName.split(' ')[0] : 'Customer';
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0a0f; color: #ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #12121a; border: 1px solid #2a2a3a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); max-width: 100%;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #12121a, #1a1a24); padding: 35px 30px; text-align: center; border-bottom: 1px solid #2a2a3a;">
                  <h1 style="margin: 0; color: #00d4aa; font-size: 26px; font-weight: 700; letter-spacing: 1px;">TITA'S VAPE SHOP</h1>
                  <p style="margin: 6px 0 0; color: #8b8b9e; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">Email Verification</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 35px 30px;">
                  <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 20px; font-weight: 600;">Welcome, ${name}!</h2>
                  <p style="margin: 0 0 24px; color: #8b8b9e; font-size: 15px; line-height: 1.6;">
                    Thank you for creating an account with Tita's Vape Shop. To complete your registration and place orders, please enter this verification code:
                  </p>
                  
                  <!-- OTP Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                    <tr>
                      <td align="center">
                        <div style="display: inline-block; background-color: #1a1a24; border: 2px solid #00d4aa; border-radius: 12px; padding: 18px 36px; letter-spacing: 10px; font-size: 32px; font-weight: 700; color: #00d4aa; font-family: monospace;">
                          ${code}
                        </div>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Security Notice -->
                  <div style="background-color: rgba(0, 212, 170, 0.05); border-left: 3px solid #00d4aa; padding: 14px 16px; border-radius: 6px; margin: 24px 0;">
                    <p style="margin: 0; color: #8b8b9e; font-size: 13px; line-height: 1.5;">
                      <strong style="color: #ffffff;">Security Notice:</strong> This code expires in 15 minutes. If you did not create an account at Tita's Vape Shop, please ignore this email.
                    </p>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #0d0d14; padding: 20px 30px; text-align: center; border-top: 1px solid #2a2a3a;">
                  <p style="margin: 0; color: #8b8b9e; font-size: 12px;">
                    &copy; ${new Date().getFullYear()} Tita's Vape Shop. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Send email helper
 */
async function sendMail(to, subject, html) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Customer Auth] SMTP credentials not set, email skipped in development.');
    return { success: false, error: 'SMTP credentials not configured' };
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return await transporter.sendMail({
    from: `"Tita's Vape Shop" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html
  });
}

/**
 * POST /api/customer/register
 * Register a new customer and dispatch 6-digit OTP email
 */
router.post('/api/customer/register', async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const { full_name, email, contact_number, password } = req.body;

    if (!full_name || full_name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Please enter your full name (minimum 2 characters).' });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    const digitsOnly = (contact_number || '').replace(/\D/g, '');
    if (digitsOnly.length !== 11) {
      return res.status(400).json({ success: false, error: 'Contact number must be exactly 11 digits (e.g. 09123456789).' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    // Check if email is already in users table
    const { data: existingUser, error: checkError } = await client
      .from('users')
      .select('id, email, is_verified, roles')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (checkError) {
      console.error('[Customer Register] Check existing error:', checkError);
      return res.status(500).json({ success: false, error: 'Failed to verify email availability.' });
    }

    let userId = null;
    const hashedPassword = bcrypt.hashSync(password, 10);

    if (existingUser) {
      if (existingUser.is_verified) {
        return res.status(400).json({
          success: false,
          error: 'This email is already registered and verified. Please sign in.'
        });
      }
      // Existing unverified user: update their record
      userId = existingUser.id;
      const { error: updateError } = await client
        .from('users')
        .update({
          full_name: full_name.trim(),
          contact_number: digitsOnly,
          password: hashedPassword,
          roles: 'customer'
        })
        .eq('id', userId);

      if (updateError) {
        console.error('[Customer Register] Update unverified error:', updateError);
        return res.status(500).json({ success: false, error: 'Failed to update account information.' });
      }
    } else {
      // Create new user record
      const newUsername = `${cleanEmail.split('@')[0]}_${Date.now().toString().slice(-4)}`;
      const { data: newUser, error: insertError } = await client
        .from('users')
        .insert({
          username: newUsername,
          email: cleanEmail,
          password: hashedPassword,
          full_name: full_name.trim(),
          contact_number: digitsOnly,
          roles: 'customer',
          is_verified: false
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[Customer Register] Insert error:', insertError);
        return res.status(500).json({ success: false, error: insertError.message || 'Failed to create account.' });
      }
      userId = newUser.id;
    }

    // Generate 6-digit OTP code
    const otpCode = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Store in customer_verification_codes
    const { error: otpError } = await client
      .from('customer_verification_codes')
      .insert({
        user_id: userId,
        email: cleanEmail,
        otp_code: otpCode,
        expires_at: expiresAt,
        verified: false
      });

    if (otpError) {
      console.error('[Customer Register] OTP insert error:', otpError);
      return res.status(500).json({ success: false, error: 'Failed to generate verification code.' });
    }

    // Send verification email
    try {
      await sendMail(
        cleanEmail,
        'Verify Your Email - Tita\'s Vape Shop',
        generateVerificationEmail(otpCode, full_name.trim())
      );
    } catch (mailErr) {
      console.error('[Customer Register] Email send error:', mailErr);
    }

    return res.json({
      success: true,
      message: 'Verification code sent to your email address.',
      email: cleanEmail
    });
  } catch (err) {
    console.error('[Customer Register] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/customer/verify-email
 * Validate 6-digit OTP code, mark verified, and set customer_token session cookie
 */
router.post('/api/customer/verify-email', async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const { email, code } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').trim();

    if (!cleanEmail || !cleanCode) {
      return res.status(400).json({ success: false, error: 'Email and 6-digit code are required.' });
    }

    // Find valid matching OTP code
    const nowIso = new Date().toISOString();
    const { data: codeRows, error: codeQueryError } = await client
      .from('customer_verification_codes')
      .select('id, user_id, expires_at, verified')
      .eq('email', cleanEmail)
      .eq('otp_code', cleanCode)
      .eq('verified', false)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1);

    if (codeQueryError || !codeRows || codeRows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code. Please check your code or request a new one.'
      });
    }

    const matchedOtp = codeRows[0];

    // Mark OTP as verified
    await client
      .from('customer_verification_codes')
      .update({ verified: true })
      .eq('id', matchedOtp.id);

    // Mark user as verified
    const { data: updatedUser, error: userUpdateError } = await client
      .from('users')
      .update({
        is_verified: true,
        email_verified_at: new Date().toISOString()
      })
      .eq('id', matchedOtp.user_id)
      .select('id, email, full_name, contact_number, roles')
      .single();

    if (userUpdateError || !updatedUser) {
      console.error('[Customer Verify] User update error:', userUpdateError);
      return res.status(500).json({ success: false, error: 'Failed to update verification status.' });
    }

    // Sign JWT customer session
    const customerPayload = {
      id: updatedUser.id,
      email: updatedUser.email,
      full_name: updatedUser.full_name || '',
      contact_number: updatedUser.contact_number || '',
      role: 'customer'
    };

    const token = jwt.sign(customerPayload, JWT_SECRET, { expiresIn: '30d' });

    res.cookie('customer_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    return res.json({
      success: true,
      message: 'Email successfully verified!',
      user: customerPayload
    });
  } catch (err) {
    console.error('[Customer Verify] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/customer/resend-otp
 * Generate and dispatch a new 6-digit OTP code
 */
router.post('/api/customer/resend-otp', async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const { email } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }

    const { data: user, error: userError } = await client
      .from('users')
      .select('id, email, full_name, is_verified')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (userError || !user) {
      return res.status(404).json({ success: false, error: 'No account found with this email address.' });
    }

    if (user.is_verified) {
      return res.status(400).json({ success: false, error: 'This account is already verified. You can log in.' });
    }

    const otpCode = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: insertError } = await client
      .from('customer_verification_codes')
      .insert({
        user_id: user.id,
        email: cleanEmail,
        otp_code: otpCode,
        expires_at: expiresAt,
        verified: false
      });

    if (insertError) {
      console.error('[Customer Resend] Insert error:', insertError);
      return res.status(500).json({ success: false, error: 'Failed to generate new code.' });
    }

    try {
      await sendMail(
        cleanEmail,
        'Your New Verification Code - Tita\'s Vape Shop',
        generateVerificationEmail(otpCode, user.full_name)
      );
    } catch (mailErr) {
      console.error('[Customer Resend] Mail error:', mailErr);
    }

    return res.json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email.'
    });
  } catch (err) {
    console.error('[Customer Resend] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/customer/login
 * Log in with email and password
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

    const { data: user, error: userError } = await client
      .from('users')
      .select('id, email, password, full_name, contact_number, is_verified, roles')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (userError || !user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    if (!user.password || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    // If account is not verified, require verification
    if (!user.is_verified) {
      // Auto-dispatch a fresh code
      const otpCode = generateCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await client.from('customer_verification_codes').insert({
        user_id: user.id,
        email: cleanEmail,
        otp_code: otpCode,
        expires_at: expiresAt,
        verified: false
      });

      try {
        await sendMail(
          cleanEmail,
          'Verify Your Email - Tita\'s Vape Shop',
          generateVerificationEmail(otpCode, user.full_name)
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
      id: user.id,
      email: user.email,
      full_name: user.full_name || '',
      contact_number: user.contact_number || '',
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
 * Check current customer authentication state
 */
router.get('/api/customer/me', (req, res) => {
  const token = req.cookies?.customer_token;
  if (!token) {
    return res.json({ authenticated: false });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({
      authenticated: true,
      user: {
        id: decoded.id,
        email: decoded.email,
        full_name: decoded.full_name,
        contact_number: decoded.contact_number
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
