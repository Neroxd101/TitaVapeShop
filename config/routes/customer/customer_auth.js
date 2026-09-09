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
 * GET /api/customer/check-email
 * Check if email address is already registered in the database
 */
router.get('/api/customer/check-email', async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const cleanEmail = (req.query.email || '').trim().toLowerCase();
    const excludeUserId = req.query.exclude_user_id || null;

    if (!cleanEmail) {
      return res.status(400).json({ success: false, error: 'Email parameter is required.' });
    }

    let query = client
      .from('users')
      .select('id, email, is_verified')
      .ilike('email', cleanEmail);

    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data: existingUser, error: checkError } = await query.maybeSingle();

    if (checkError) {
      console.error('[Customer Check Email] Error:', checkError);
      return res.status(500).json({ success: false, error: 'Error checking email availability.' });
    }

    return res.json({
      success: true,
      exists: Boolean(existingUser),
      is_verified: existingUser ? Boolean(existingUser.is_verified) : false
    });
  } catch (err) {
    console.error('[Customer Check Email] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * GET /api/customer/check-phone
 * Check if contact number is already registered in the database
 */
router.get('/api/customer/check-phone', async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const cleanPhone = (req.query.phone || '').trim().replace(/\D/g, '');
    const excludeUserId = req.query.exclude_user_id || null;

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ success: false, error: 'Valid phone number is required.' });
    }

    let query = client
      .from('users')
      .select('id, contact_number')
      .or(`contact_number.eq.${cleanPhone},contact_number.eq.0${cleanPhone.slice(-10)},contact_number.eq.+63${cleanPhone.slice(-10)}`);

    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data: existingUser, error: checkError } = await query.maybeSingle();

    if (checkError) {
      console.error('[Customer Check Phone] Error:', checkError);
      return res.status(500).json({ success: false, error: 'Error checking phone availability.' });
    }

    return res.json({
      success: true,
      exists: Boolean(existingUser)
    });
  } catch (err) {
    console.error('[Customer Check Phone] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

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

    const { full_name, email, contact_number, password, birthday } = req.body;

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

    if (!birthday) {
      return res.status(400).json({ success: false, error: 'Date of birth is required.' });
    }

    const birthDate = new Date(birthday);
    if (isNaN(birthDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Please enter a valid date of birth.' });
    }

    // Age validation: Republic Act No. 11900 requires buyers to be at least 18 years old
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      return res.status(403).json({
        success: false,
        error: 'You must be at least 18 years of age to register and purchase vapor products under Republic Act No. 11900.'
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return res.status(400).json({
        success: false,
        error: 'Password must include an uppercase letter, lowercase letter, number, and special character.'
      });
    }

    // Check if email already exists in users table (case-insensitive)
    const { data: existingUser, error: checkError } = await client
      .from('users')
      .select('id, email, is_verified, roles')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (checkError) {
      console.error('[Customer Register] Check existing error:', checkError);
      return res.status(500).json({ success: false, error: 'Failed to verify email availability.' });
    }

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'This email already exists. Please sign in.'
      });
    }

    // Check if contact number already exists in users table
    const { data: existingPhoneUser, error: phoneCheckError } = await client
      .from('users')
      .select('id, contact_number')
      .or(`contact_number.eq.${digitsOnly},contact_number.eq.0${digitsOnly.slice(-10)},contact_number.eq.+63${digitsOnly.slice(-10)}`)
      .maybeSingle();

    if (phoneCheckError) {
      console.error('[Customer Register] Check existing phone error:', phoneCheckError);
    } else if (existingPhoneUser) {
      return res.status(400).json({
        success: false,
        error: 'This mobile number already exists. Please use a different number or sign in.'
      });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const birthDateFormatted = birthDate.toISOString().split('T')[0];

    // Create new user record
    const newUsername = `${cleanEmail.split('@')[0]}_${Date.now().toString().slice(-4)}`;
    const insertPayload = {
      username: newUsername,
      email: cleanEmail,
      password: hashedPassword,
      full_name: full_name.trim(),
      contact_number: digitsOnly,
      birthday: birthDateFormatted,
      roles: 'customer',
      is_verified: false
    };

    let { data: newUser, error: insertError } = await client
      .from('users')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError && insertError.message && insertError.message.includes('birthday')) {
      delete insertPayload.birthday;
      const retry = await client.from('users').insert(insertPayload).select('id').single();
      newUser = retry.data;
      insertError = retry.error;
    }

    if (insertError) {
      console.error('[Customer Register] Insert error:', insertError);
      return res.status(500).json({ success: false, error: insertError.message || 'Failed to create account.' });
    }
    const userId = newUser.id;

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
      .select('id, user_id, email, expires_at, verified')
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
    const targetEmail = matchedOtp.email || cleanEmail;

    // Mark OTP as verified
    await client
      .from('customer_verification_codes')
      .update({ verified: true })
      .eq('id', matchedOtp.id);

    // Mark user as verified and update email to the verified email
    const { data: updatedUser, error: userUpdateError } = await client
      .from('users')
      .update({
        email: targetEmail,
        is_verified: true,
        email_verified_at: new Date().toISOString()
      })
      .eq('id', matchedOtp.user_id)
      .select('id, email, full_name, contact_number, birthday, roles')
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

    let targetUserId = null;
    let targetName = 'Customer';

    // 1. If user is currently authenticated (e.g. changing email)
    const token = req.cookies.customer_token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.id) {
          targetUserId = decoded.id;
          targetName = decoded.full_name || 'Customer';
        }
      } catch (_) {}
    }

    // 2. If not authenticated, lookup in users table or pending verification codes
    if (!targetUserId) {
      const { data: user } = await client
        .from('users')
        .select('id, email, full_name, is_verified')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (user) {
        if (user.is_verified) {
          return res.status(400).json({ success: false, error: 'This account is already verified. You can log in.' });
        }
        targetUserId = user.id;
        targetName = user.full_name || 'Customer';
      } else {
        // Check for pending email change OTP
        const { data: pendingOtp } = await client
          .from('customer_verification_codes')
          .select('user_id, email')
          .ilike('email', cleanEmail)
          .eq('verified', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingOtp) {
          targetUserId = pendingOtp.user_id;
          const { data: u } = await client.from('users').select('full_name').eq('id', pendingOtp.user_id).maybeSingle();
          if (u) targetName = u.full_name || 'Customer';
        }
      }
    }

    if (!targetUserId) {
      return res.status(404).json({ success: false, error: 'No account or pending verification found with this email address.' });
    }

    const otpCode = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: insertError } = await client
      .from('customer_verification_codes')
      .insert({
        user_id: targetUserId,
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
        generateVerificationEmail(otpCode, targetName)
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
      } catch (e) { }

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
 * Check current customer authentication state with fresh database data
 */
router.get('/api/customer/me', async (req, res) => {
  const token = req.cookies?.customer_token;
  if (!token) {
    return res.json({ authenticated: false });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const client = dbClient();

    // Query fresh profile data from DB
    const { data: user, error } = await client
      .from('users')
      .select('id, email, full_name, contact_number, birthday')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
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
        id: user.id,
        email: user.email,
        full_name: user.full_name || '',
        contact_number: user.contact_number || '',
        birthday: user.birthday || null
      }
    });
  } catch (err) {
    res.clearCookie('customer_token');
    return res.json({ authenticated: false });
  }
});

/**
 * PUT /api/customer/profile
 * Update customer profile (name, mobile number, email)
 */
router.put('/api/customer/profile', async (req, res) => {
  const token = req.cookies?.customer_token;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Please sign in to update your profile.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    res.clearCookie('customer_token');
    return res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' });
  }

  const { full_name, contact_number, email } = req.body;
  const client = dbClient();

  // Validate full_name
  if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Please enter a valid full name (at least 2 characters).' });
  }

  // Validate contact_number (Philippine mobile e.g. 09XXXXXXXXX or +639...)
  const phonePattern = /^(09|\+639)\d{9}$/;
  if (!contact_number || !phonePattern.test(contact_number.trim())) {
    return res.status(400).json({ success: false, error: 'Please enter a valid 11-digit mobile number (e.g. 09123456789).' });
  }

  // Validate email
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailPattern.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = contact_number.trim();
  const normalizedName = full_name.trim();

  try {
    // Check if phone number is already associated with another account
    const phoneDigits = normalizedPhone.replace(/\D/g, '');
    const { data: existingPhone, error: phoneErr } = await client
      .from('users')
      .select('id')
      .or(`contact_number.eq.${phoneDigits},contact_number.eq.0${phoneDigits.slice(-10)},contact_number.eq.+63${phoneDigits.slice(-10)}`)
      .neq('id', decoded.id)
      .maybeSingle();

    if (phoneErr) {
      console.error('[Customer Update Profile] Check phone error:', phoneErr);
    } else if (existingPhone) {
      return res.status(400).json({ success: false, error: 'This mobile number is already associated with another account.' });
    }

    const isEmailChanging = normalizedEmail !== (decoded.email || '').toLowerCase();

    if (isEmailChanging) {
      // Check if changing email and new email already belongs to someone else
      const { data: existingUser, error: checkErr } = await client
        .from('users')
        .select('id')
        .ilike('email', normalizedEmail)
        .neq('id', decoded.id)
        .maybeSingle();

      if (checkErr) {
        console.error('[Customer Update Profile] Check email error:', checkErr);
      } else if (existingUser) {
        return res.status(400).json({ success: false, error: 'This email is already associated with another account.' });
      }

      // Update full_name and contact_number now, BUT DO NOT update users.email yet!
      // New email is ONLY updated in users table AFTER the 6-digit OTP code is verified.
      const { error: updateErr } = await client
        .from('users')
        .update({
          full_name: normalizedName,
          contact_number: normalizedPhone
        })
        .eq('id', decoded.id);

      if (updateErr) {
        console.error('[Customer Update Profile] DB update error:', updateErr);
        return res.status(500).json({ success: false, error: 'Failed to update profile details.' });
      }

      // Keep active customer session cookie so the account remains safely logged in!

      // Generate 6-digit OTP code for the new email address
      const otpCode = generateCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      // Store in customer_verification_codes linked to decoded.id and normalizedEmail
      const { error: otpError } = await client
        .from('customer_verification_codes')
        .insert({
          user_id: decoded.id,
          email: normalizedEmail,
          otp_code: otpCode,
          expires_at: expiresAt,
          verified: false
        });

      if (otpError) {
        console.error('[Customer Update Profile] OTP insert error:', otpError);
      }

      // Dispatch verification email to the new email address
      try {
        await sendMail(
          normalizedEmail,
          "Verify Your New Email - Tita's Vape Shop",
          generateVerificationEmail(otpCode, normalizedName)
        );
      } catch (mailErr) {
        console.error('[Customer Update Profile] Email dispatch error:', mailErr);
      }

      return res.json({
        success: true,
        email_changed: true,
        pending_verification: true,
        email: normalizedEmail,
        message: `A 6-digit verification code has been sent to ${normalizedEmail}. Please enter the code to confirm changing your email.`
      });
    }

    // Email unchanged: update name & contact number only
    const { data: updatedUser, error: updateErr } = await client
      .from('users')
      .update({
        full_name: normalizedName,
        contact_number: normalizedPhone
      })
      .eq('id', decoded.id)
      .select('id, email, full_name, contact_number, birthday')
      .single();

    if (updateErr || !updatedUser) {
      console.error('[Customer Update Profile] DB update error:', updateErr);
      return res.status(500).json({ success: false, error: 'Failed to update profile details.' });
    }

    // Sign new JWT token with updated profile
    const customerPayload = {
      id: updatedUser.id,
      email: updatedUser.email,
      full_name: updatedUser.full_name || '',
      contact_number: updatedUser.contact_number || '',
      birthday: updatedUser.birthday || null,
      role: 'customer'
    };

    const newToken = jwt.sign(customerPayload, JWT_SECRET, { expiresIn: '30d' });
    res.cookie('customer_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      email_changed: false,
      message: 'Profile updated successfully!',
      user: customerPayload
    });
  } catch (err) {
    console.error('[Customer Update Profile] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while updating profile.' });
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
