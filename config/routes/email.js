const express = require('express');
const router = express.Router();

// We'll use nodemailer for sending emails via Gmail SMTP
// You'll need to install: npm install nodemailer
const nodemailer = require('nodemailer');
const { isAuthenticated } = require('../middleware/authMiddleware');

// Protect email routes
router.use(isAuthenticated);

/**
 * POST /api/email/send-receipt
 * Send a sales receipt via email using Gmail SMTP
 */
router.post('/api/email/send-receipt', async (req, res) => {
  try {
    const { customerEmail, customerName, items, total, cash, change, saleDate } = req.body;

    if (!customerEmail) {
      return res.status(400).json({ error: 'Customer email is required' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items in the sale' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Generate receipt HTML
    const receiptHtml = generateReceiptHtml({
      customerName: customerName || 'Valued Customer',
      items,
      total,
      cash,
      change,
      saleDate: saleDate || new Date().toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    });

    // Send email
    const mailOptions = {
      from: `"Tita Vape Shop" <${process.env.SMTP_USER}>`,
      to: customerEmail,
      subject: 'Your Receipt from Tita Vape Shop',
      html: receiptHtml
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: 'Receipt sent successfully' });
  } catch (error) {
    console.error('Error in sendReceipt:', error);
    res.status(500).json({ error: 'Failed to send receipt email', details: error.message });
  }
});

/**
 * Generate HTML for the receipt email
 */
function generateReceiptHtml({ customerName, items, total, cash, change, saleDate }) {
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.qty}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">₱${item.price.toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">₱${(item.qty * item.price).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Receipt - Tita Vape Shop</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #00d4aa, #00b894); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Tita Vape Shop</h1>
                  <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Sales Receipt</p>
                </td>
              </tr>
              
              <!-- Customer Info -->
              <tr>
                <td style="padding: 30px 30px 20px;">
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">Customer:</p>
                  <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">${escapeHtml(customerName)}</p>
                  <p style="margin: 12px 0 0; color: #6b7280; font-size: 13px;">Date: ${saleDate}</p>
                </td>
              </tr>
              
              <!-- Items Table -->
              <tr>
                <td style="padding: 0 30px 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                    <thead>
                      <tr style="background-color: #f9fafb;">
                        <th style="padding: 12px; text-align: left; color: #374151; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Item</th>
                        <th style="padding: 12px; text-align: center; color: #374151; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Qty</th>
                        <th style="padding: 12px; text-align: right; color: #374151; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Price</th>
                        <th style="padding: 12px; text-align: right; color: #374151; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsHtml}
                    </tbody>
                  </table>
                </td>
              </tr>
              
              <!-- Totals -->
              <tr>
                <td style="padding: 0 30px 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding: 8px 0; text-align: right; color: #6b7280; font-size: 15px;">Total:</td>
                      <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 20px; font-weight: 700; width: 150px;">₱${total.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; text-align: right; color: #6b7280; font-size: 14px;">Cash:</td>
                      <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 16px; font-weight: 600;">₱${cash.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; text-align: right; color: #6b7280; font-size: 14px;">Change:</td>
                      <td style="padding: 8px 0; text-align: right; color: #00d4aa; font-size: 16px; font-weight: 600;">₱${change.toFixed(2)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #6b7280; font-size: 13px;">Thank you for your purchase!</p>
                  <p style="margin: 8px 0 0; color: #9ca3af; font-size: 12px;">This is an automated receipt from Tita Vape Shop</p>
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
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

module.exports = router;
