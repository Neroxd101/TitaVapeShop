const nodemailer = require('nodemailer');
const { supabaseAdmin } = require('../database/supabase');

/**
 * Checks if updated products have fallen below the low stock threshold
 * and sends an email notification to the configured administrator if so.
 * 
 * @param {Array<{id: string, name: string, deducted: number}>} itemsToCheck - Array of items to evaluate.
 */
async function checkAndSendLowStockAlerts(itemsToCheck) {
  try {
    if (!supabaseAdmin) {
      console.warn('[Low Stock Alert] Database admin client not configured. Skipping alert check.');
      return;
    }

    if (!itemsToCheck || !Array.isArray(itemsToCheck) || itemsToCheck.length === 0) {
      return;
    }

    // Step 1: Fetch Notification Settings
    let threshold = 10;
    let notificationsEnabled = true;
    let recipientEmail = process.env.SMTP_USER;

    try {
      const { data: settings, error: settingsError } = await supabaseAdmin
        .from('settings')
        .select('key, value');

      if (settingsError) {
        console.warn('[Low Stock Alert] Could not read settings table (migration may not be run yet). Using default settings.');
      } else if (settings) {
        const thresholdSetting = settings.find(s => s.key === 'low_stock_threshold');
        const enabledSetting = settings.find(s => s.key === 'low_stock_notifications_enabled');
        const emailSetting = settings.find(s => s.key === 'low_stock_notification_email');

        if (thresholdSetting && thresholdSetting.value !== null) {
          threshold = parseInt(thresholdSetting.value, 10);
        }
        if (enabledSetting && enabledSetting.value !== null) {
          notificationsEnabled = enabledSetting.value === true || enabledSetting.value === 'true';
        }
        if (emailSetting && emailSetting.value !== null && emailSetting.value !== '') {
          recipientEmail = String(emailSetting.value);
        }
      }
    } catch (dbErr) {
      console.error('[Low Stock Alert] Error fetching configuration from database:', dbErr);
    }

    // If notifications are explicitly disabled, exit early
    if (!notificationsEnabled) {
      return;
    }

    if (!recipientEmail) {
      console.warn('[Low Stock Alert] Recipient email is not configured. Skipping email.');
      return;
    }

    // Step 2: Query the current stock level for the items (including images)
    const ids = itemsToCheck.map(item => item.id);
    const { data: dbItems, error: dbError } = await supabaseAdmin
      .from('inventory')
      .select('id, name, category, quantity, images')
      .in('id', ids);

    if (dbError) {
      console.error('[Low Stock Alert] Error querying inventory for alert check:', dbError);
      return;
    }

    if (!dbItems || dbItems.length === 0) {
      return;
    }

    const lowStockAlerts = [];

    // Step 3: Evaluate each item against the threshold
    for (const dbItem of dbItems) {
      const inputItem = itemsToCheck.find(i => i.id === dbItem.id);
      const deducted = inputItem ? parseInt(inputItem.deducted, 10) || 0 : 0;
      
      const newQty = dbItem.quantity;
      const oldQty = newQty + deducted;

      // Alert triggers when:
      // 1. If deducted is specified: it just crossed the threshold (oldQty > threshold && newQty <= threshold)
      // 2. If deducted is not specified (e.g. manual reset): current quantity is below threshold (newQty <= threshold)
      const crossedThreshold = deducted > 0 ? (oldQty > threshold && newQty <= threshold) : (newQty <= threshold);

      if (crossedThreshold) {
        // Parse and extract the first product image URL
        let firstImageUrl = null;
        const images = dbItem.images;
        if (Array.isArray(images) && images.length > 0) {
          firstImageUrl = images[0];
        } else if (typeof images === 'string') {
          try {
            const parsed = JSON.parse(images);
            if (Array.isArray(parsed) && parsed.length > 0) {
              firstImageUrl = parsed[0];
            }
          } catch (e) {
            // ignore JSON parse errors
          }
        }

        lowStockAlerts.push({
          id: dbItem.id,
          name: dbItem.name || 'Unknown Item',
          category: dbItem.category || 'hardware',
          quantity: newQty,
          previousQuantity: oldQty,
          deducted: deducted,
          imageUrl: firstImageUrl
        });
      }
    }

    // If no items are low stock (or did not cross the threshold), exit
    if (lowStockAlerts.length === 0) {
      return;
    }

    // Step 4: Create email transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Step 5: Generate low stock email HTML
    const emailHtml = generateLowStockEmailHtml(lowStockAlerts, threshold);

    // Step 6: Send email
    const mailOptions = {
      from: `"Tita Vape Shop Alert" <${process.env.SMTP_USER}>`,
      to: recipientEmail,
      subject: `⚠️ Low Stock Alert: ${lowStockAlerts.length} product(s) running low`,
      html: emailHtml
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Low Stock Alert] Low stock notification email sent to ${recipientEmail} for ${lowStockAlerts.length} item(s).`);

  } catch (error) {
    console.error('[Low Stock Alert] Critical error checking / sending alert:', error);
  }
}

/**
 * Generates email HTML template for low stock warning
 */
function generateLowStockEmailHtml(items, threshold) {
  const getGoogleDriveThumbnail = (url) => {
    if (!url) return null;
    const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    return url;
  };

  const itemsHtml = items.map(item => {
    const displayImg = getGoogleDriveThumbnail(item.imageUrl);
    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: middle; width: 60px;">
          ${displayImg 
            ? `<img src="${displayImg}" alt="${escapeHtml(item.name)}" width="50" height="50" style="object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; display: block; margin: 0 auto;">`
            : `<div style="width: 50px; height: 50px; border-radius: 6px; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #9ca3af; margin: 0 auto; border: 1px solid #e5e7eb; line-height: 50px; text-align: center;">📦</div>`
          }
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500; color: #111827; vertical-align: middle;">${escapeHtml(item.name)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563; text-transform: capitalize; vertical-align: middle;">${escapeHtml(item.category)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600; color: #dc2626; background-color: #fef2f2; vertical-align: middle;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563; vertical-align: middle;">${item.deducted > 0 ? `-${item.deducted}` : 'Manual'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280; vertical-align: middle;">${item.previousQuantity}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Low Stock Alert - Tita Vape Shop</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08); overflow: hidden;">
              <!-- Header with premium warning gradient -->
              <tr>
                <td style="background: linear-gradient(135deg, #ff9f43, #ff5252); padding: 40px 30px; text-align: center;">
                  <span style="font-size: 40px; margin-bottom: 10px; display: inline-block;">⚠️</span>
                  <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">Low Stock Warning</h1>
                  <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">System Inventory Alert</p>
                </td>
              </tr>
              
              <!-- Explanatory message -->
              <tr>
                <td style="padding: 30px 30px 20px;">
                  <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">
                    The following product(s) have fallen below your configured low stock threshold of <strong>${threshold}</strong> units. Please review and restock them soon to prevent stockouts.
                  </p>
                </td>
              </tr>
              
              <!-- Low Stock Items Table -->
              <tr>
                <td style="padding: 0 30px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #e5e7eb;">
                    <thead>
                      <tr style="background-color: #f9fafb;">
                        <th style="padding: 12px; text-align: center; color: #374151; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e5e7eb; width: 60px;">Image</th>
                        <th style="padding: 12px; text-align: left; color: #374151; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Product Name</th>
                        <th style="padding: 12px; text-align: center; color: #374151; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Category</th>
                        <th style="padding: 12px; text-align: center; color: #dc2626; font-size: 13px; font-weight: 700; border-bottom: 2px solid #e5e7eb; background-color: #fef2f2;">Current Stock</th>
                        <th style="padding: 12px; text-align: center; color: #374151; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Change</th>
                        <th style="padding: 12px; text-align: center; color: #374151; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Prev Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsHtml}
                    </tbody>
                  </table>
                </td>
              </tr>
              
              <!-- Action Button -->
              <tr>
                <td align="center" style="padding: 10px 30px 30px;">
                  <a href="${process.env.APP_URL || 'http://localhost:3000'}/inventory" style="background-color: #ff5252; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px rgba(255, 82, 82, 0.2); transition: background-color 0.2s;">
                    Go to Inventory Panel
                  </a>
                </td>
              </tr>
              
              <!-- Footer info -->
              <tr>
                <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #6b7280; font-size: 12px;">This is an automated notification from your Tita Vape Shop POS system.</p>
                  <p style="margin: 4px 0 0; color: #9ca3af; font-size: 11px;">You can customize threshold limits and recipients in Settings.</p>
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
 * Escapes text for safe HTML output
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

module.exports = {
  checkAndSendLowStockAlerts
};
