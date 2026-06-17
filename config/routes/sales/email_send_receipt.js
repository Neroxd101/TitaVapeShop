const express = require('express');
const router = express.Router();

// We'll use nodemailer for sending emails via Gmail SMTP
// You'll need to install: npm install nodemailer
const nodemailer = require('nodemailer');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Protect email routes
/**
 * POST /sales/email_send_receipt
 * Send a sales receipt via email using Gmail SMTP
 */
router.post('/sales/email_send_receipt', isAuthenticated, hasRole(['admin', 'staff']), async (req, res) => {
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
      <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; color: #ffffff;">${escapeHtml(item.name)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: center; color: #ffffff;">${item.qty}</td>
      <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: right; color: #8b8b9e;">₱${item.price.toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: right; font-weight: 600; color: #ffffff;">₱${(item.qty * item.price).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Receipt - Tita Vape Shop</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0a0f; color: #ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #12121a; border: 1px solid #2a2a3a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #00d4aa, #1a1a24); padding: 40px 30px; text-align: center; border-bottom: 1px solid #2a2a3a;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 1px; font-family: 'Outfit', sans-serif;">TITA VAPE SHOP</h1>
                  <p style="margin: 8px 0 0; color: #8b8b9e; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">Sales Receipt</p>
                </td>
              </tr>
              
              <!-- Customer Info -->
              <tr>
                <td style="padding: 30px 30px 20px;">
                  <p style="margin: 0 0 8px; color: #8b8b9e; font-size: 14px;">Customer:</p>
                  <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 600; font-family: 'Outfit', sans-serif;">${escapeHtml(customerName)}</p>
                  <p style="margin: 12px 0 0; color: #8b8b9e; font-size: 13px;">Date: ${saleDate}</p>
                </td>
              </tr>
              
              <!-- Items Table -->
              <tr>
                <td style="padding: 0 30px 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                    <thead>
                      <tr style="background-color: #1a1a24;">
                        <th style="padding: 12px; text-align: left; color: #ffffff; font-size: 13px; font-weight: 600; border-bottom: 2px solid #2a2a3a;">Item</th>
                        <th style="padding: 12px; text-align: center; color: #ffffff; font-size: 13px; font-weight: 600; border-bottom: 2px solid #2a2a3a;">Qty</th>
                        <th style="padding: 12px; text-align: right; color: #ffffff; font-size: 13px; font-weight: 600; border-bottom: 2px solid #2a2a3a;">Price</th>
                        <th style="padding: 12px; text-align: right; color: #ffffff; font-size: 13px; font-weight: 600; border-bottom: 2px solid #2a2a3a;">Subtotal</th>
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
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #2a2a3a; padding-top: 20px;">
                    <tr>
                      <td style="padding: 8px 0; text-align: right; color: #8b8b9e; font-size: 15px;">Total:</td>
                      <td style="padding: 8px 0; text-align: right; color: #ffffff; font-size: 20px; font-weight: 700; width: 150px; font-family: 'Outfit', sans-serif;">₱${total.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; text-align: right; color: #8b8b9e; font-size: 14px;">Cash:</td>
                      <td style="padding: 8px 0; text-align: right; color: #ffffff; font-size: 16px; font-weight: 600;">₱${cash.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; text-align: right; color: #8b8b9e; font-size: 14px;">Change:</td>
                      <td style="padding: 8px 0; text-align: right; color: #00d4aa; font-size: 16px; font-weight: 700;">₱${change.toFixed(2)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #1a1a24; padding: 24px 30px; text-align: center; border-top: 1px solid #2a2a3a;">
                  <p style="margin: 0; color: #00d4aa; font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">Thank you for your purchase!</p>
                  <p style="margin: 8px 0 0; color: #8b8b9e; font-size: 12px;">This is an automated receipt from Tita Vape Shop</p>
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
