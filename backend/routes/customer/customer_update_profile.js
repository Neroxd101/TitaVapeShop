const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../../database/supabase');
const { generateCode, generateVerificationEmail, sendMail } = require('./customer_mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const dbClient = () => supabaseAdmin || supabase;

/**
 * PUT /api/customer/profile
 * Update customer profile (full_name, contact_number, email)
 * Calls RPC customer_update_profile with database fallback
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
    // 1. Attempt customer_update_profile RPC
    try {
      const { data: rpcResult, error: rpcError } = await client.rpc('customer_update_profile', {
        p_customer_id: decoded.id,
        p_full_name: normalizedName,
        p_contact_number: normalizedPhone,
        p_email: normalizedEmail
      });

      if (!rpcError && rpcResult && rpcResult.success) {
        if (rpcResult.email_changed) {
          // Send verification email to new address
          try {
            await sendMail(
              rpcResult.email,
              "Verify Your New Email - Tita's Vape Shop",
              generateVerificationEmail(rpcResult.otp_code, rpcResult.full_name)
            );
          } catch (mailErr) {
            console.error('[Customer Update Profile] Email dispatch error:', mailErr);
          }

          return res.json({
            success: true,
            email_changed: true,
            pending_verification: true,
            email: rpcResult.email,
            message: rpcResult.message || `A 6-digit verification code has been sent to ${rpcResult.email}.`
          });
        } else if (rpcResult.customer) {
          const customerPayload = rpcResult.customer;
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
        }
      } else if (rpcResult && rpcResult.error) {
        return res.status(400).json({ success: false, error: rpcResult.error });
      }
    } catch (_) {}

    // 2. Direct fallback if RPC is not yet applied
    const phoneDigits = normalizedPhone.replace(/\D/g, '');
    const { data: existingPhone, error: phoneErr } = await client
      .from('customers')
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
      const { data: existingCustomer, error: checkErr } = await client
        .from('customers')
        .select('id')
        .ilike('email', normalizedEmail)
        .neq('id', decoded.id)
        .maybeSingle();

      if (checkErr) {
        console.error('[Customer Update Profile] Check email error:', checkErr);
      } else if (existingCustomer) {
        return res.status(400).json({ success: false, error: 'This email is already associated with another account.' });
      }

      // Update full_name and contact_number now in customers, but NOT email yet!
      const { error: updateErr } = await client
        .from('customers')
        .update({
          full_name: normalizedName,
          contact_number: normalizedPhone
        })
        .eq('id', decoded.id);

      if (updateErr) {
        console.error('[Customer Update Profile] DB update error:', updateErr);
        return res.status(500).json({ success: false, error: 'Failed to update profile details.' });
      }

      // Generate 6-digit OTP code for the new email address
      const otpCode = generateCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error: otpError } = await client
        .from('customer_verification_codes')
        .insert({
          customer_id: decoded.id,
          email: normalizedEmail,
          otp_code: otpCode,
          expires_at: expiresAt,
          verified: false
        });

      if (otpError) {
        console.error('[Customer Update Profile] OTP insert error:', otpError);
      }

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

    // Email unchanged: update name & contact number only in customers table
    const { data: updatedCustomer, error: updateErr } = await client
      .from('customers')
      .update({
        full_name: normalizedName,
        contact_number: normalizedPhone
      })
      .eq('id', decoded.id)
      .select('id, email, full_name, contact_number, birthday')
      .single();

    if (updateErr || !updatedCustomer) {
      console.error('[Customer Update Profile] DB update error:', updateErr);
      return res.status(500).json({ success: false, error: 'Failed to update profile details.' });
    }

    const customerPayload = {
      id: updatedCustomer.id,
      email: updatedCustomer.email,
      full_name: updatedCustomer.full_name || '',
      contact_number: updatedCustomer.contact_number || '',
      birthday: updatedCustomer.birthday || null,
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

module.exports = router;
