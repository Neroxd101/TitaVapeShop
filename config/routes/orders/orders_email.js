/**
 * Order Email Service
 * Sends email notifications for order status updates
 */

const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { supabase, supabaseAdmin } = require('../../database/supabase');

/**
 * Send order notification email
 * @param {string} customerEmail - Customer email address
 * @param {string} customerName - Customer name
 * @param {string} orderId - Order ID
 * @param {string} status - Order status (pending, confirmed, completed)
 * @param {object} orderData - Order data (items, total_amount, order_type)
 */
async function sendOrderEmail(customerEmail, customerName, orderId, status, orderData) {
    if (!customerEmail) {
        return { success: false, error: 'No email provided' };
    }

    try {
        // Ensure tracking URL with token is present
        if (!orderData.trackingUrl) {
            const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
            let token = orderData.orderToken;
            if (!token && process.env.JWT_SECRET) {
                try {
                    const jwt = require('jsonwebtoken');
                    token = jwt.sign(
                        { orderId: orderId, customerName: customerName },
                        process.env.JWT_SECRET,
                        { expiresIn: '30d' }
                    );
                } catch (e) {}
            }
            orderData.trackingUrl = token
                ? `${appUrl}/order-status?token=${token}`
                : `${appUrl}/order-status?id=${orderId}`;
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // Fetch product images from database to display in the email
        const client = supabaseAdmin || supabase;
        try {
            const productIds = orderData.items.map(item => item.id).filter(id => id);
            if (productIds.length > 0 && client) {
                const { data: dbItems } = await client
                    .from('inventory')
                    .select('id, images')
                    .in('id', productIds);
                
                const imageMap = {};
                if (dbItems) {
                    dbItems.forEach(dbItem => {
                        let firstImg = null;
                        if (Array.isArray(dbItem.images) && dbItem.images.length > 0) {
                            firstImg = dbItem.images[0];
                        } else if (typeof dbItem.images === 'string') {
                            try {
                                const parsed = JSON.parse(dbItem.images);
                                if (Array.isArray(parsed) && parsed.length > 0) {
                                    firstImg = parsed[0];
                                }
                            } catch (e) {}
                        }
                        imageMap[dbItem.id] = firstImg;
                    });
                }

                orderData.items.forEach(item => {
                    item.imageUrl = imageMap[item.id] || null;
                });
            }
        } catch (err) {
            console.error('[Order Email] Error resolving product images:', err);
        }

        let subject, htmlContent;

        switch (status) {
            case 'pending':
                subject = `Order Confirmation - Tita\'s Vape Shop`;
                htmlContent = generateOrderCreatedEmail(customerName, orderId, orderData);
                break;
            case 'confirmed':
                subject = `Order Confirmed - Tita\'s Vape Shop`;
                htmlContent = generateOrderConfirmedEmail(customerName, orderId, orderData);
                break;
            case 'completed':
                subject = `Order Completed - Tita\'s Vape Shop`;
                htmlContent = generateOrderCompletedEmail(customerName, orderId, orderData);
                break;
            default:
                return { success: false, error: 'Invalid status' };
        }

        const mailOptions = {
            from: `"Tita\'s Vape Shop" <${process.env.SMTP_USER}>`,
            to: customerEmail,
            subject: subject,
            html: htmlContent
        };

        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('[Order Email] Error sending email:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Format number to Philippine Peso with comma separators and 2 decimal places
 */
function formatPeso(amount) {
    const num = parseFloat(amount) || 0;
    return num.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Resolve Google Drive direct viewable image URLs
 */
function getGoogleDriveThumbnail(url) {
    if (!url) return null;
    const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
        return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    return url;
}

/**
 * Generates the common footer with store information
 */
function generateEmailFooter() {
    const formattedTime = new Date().toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    return `
        <!-- Footer -->
        <tr>
            <td style="background-color: #1a1a24; padding: 30px 30px; text-align: center; border-top: 1px solid #2a2a3a; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #8b8b9e;">
                <!-- Logo -->
                <div style="font-size: 20px; font-weight: 700; color: #00d4aa; margin-bottom: 6px; letter-spacing: 0.5px; font-family: 'Outfit', sans-serif;">TITA\'S VAPE SHOP</div>
                
                <p style="margin: 0 0 16px; color: #8b8b9e; font-size: 13px;">We appreciate your business!</p>
                
                <!-- Store Info Table -->
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 12px; color: #8b8b9e; line-height: 1.6; border-top: 1px dashed #2a2a3a; padding-top: 16px; text-align: left;">
                    <tr>
                        <td style="padding-bottom: 4px; color: #8b8b9e;">
                            📍 <strong>Location:</strong> Tita\'s Vape Shop Main Branch, Manila, Philippines
                        </td>
                        <td align="right" style="padding-bottom: 4px; color: #8b8b9e;">
                            📞 <strong>Contact:</strong> +63 912 345 6789
                        </td>
                    </tr>
                    <tr>
                        <td style="color: #8b8b9e;">
                            🕒 <strong>Store Hours:</strong> Open Daily: 10:00 AM - 10:00 PM
                        </td>
                        <td align="right" style="color: #8b8b9e;">
                            📧 <strong>Email:</strong> vshoptita@gmail.com
                        </td>
                    </tr>
                </table>
                
                <div style="margin-top: 20px; font-size: 11px; color: #8b8b9e; border-top: 1px solid #2a2a3a; padding-top: 12px;">
                    Generated on: ${formattedTime} (PHT)
                </div>
            </td>
        </tr>
    `;
}

/**
 * Generate HTML for order created email
 */
function generateOrderCreatedEmail(customerName, orderId, orderData) {
    const itemsHtml = orderData.items.map(item => {
        const displayImg = getGoogleDriveThumbnail(item.imageUrl);
        return `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: center; vertical-align: middle; width: 60px;">
                    ${displayImg 
                        ? `<img src="${displayImg}" alt="${escapeHtml(item.name)}" width="50" height="50" style="object-fit: cover; border-radius: 6px; border: 1px solid #2a2a3a; display: block; margin: 0 auto;">`
                        : `<div style="width: 50px; height: 50px; border-radius: 6px; background-color: #1a1a24; border: 1px solid #2a2a3a; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #8b8b9e; margin: 0 auto; line-height: 50px; text-align: center;">📦</div>`
                    }
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; color: #ffffff; vertical-align: middle;">${escapeHtml(item.name)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: center; color: #ffffff; vertical-align: middle;">${item.quantity}</td>
                <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: right; color: #8b8b9e; vertical-align: middle;">₱${formatPeso(item.price)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: right; font-weight: 600; color: #ffffff; vertical-align: middle;">₱${formatPeso(item.quantity * parseFloat(item.price))}</td>
            </tr>
        `;
    }).join('');

    const orderTypeLabel = orderData.order_type === 'pickup' ? 'Pickup' : 'Delivery (3rd Party)';
    const qrNote = orderData.order_type === 'pickup' 
        ? '<p style="margin: 16px 0 0; color: #00d4aa; font-size: 14px; font-weight: 600;">📱 Please show your QR code when picking up your order.</p>'
        : '';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Confirmation - Tita\'s Vape Shop</title>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0f; color: #ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #12121a; border: 1px solid #2a2a3a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #00d4aa, #1a1a24); padding: 40px 30px; text-align: center; border-bottom: 1px solid #2a2a3a;">
                                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 1px; font-family: 'Outfit', sans-serif;">TITA\'S VAPE SHOP</h1>
                                    <p style="margin: 8px 0 0; color: #8b8b9e; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">Order Confirmation</p>
                                </td>
                            </tr>
                            
                            <!-- Order Info -->
                            <tr>
                                <td style="padding: 30px 30px 20px;">
                                    <p style="margin: 0 0 8px; color: #8b8b9e; font-size: 14px;">Hello ${escapeHtml(customerName)},</p>
                                    <p style="margin: 16px 0 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
                                        Thank you for your order! We have received your order and it is currently being processed.
                                    </p>
                                    <div style="margin: 24px 0; padding: 16px; background-color: #1a1a24; border-left: 4px solid #00d4aa; border-radius: 4px; border-top: 1px solid #2a2a3a; border-right: 1px solid #2a2a3a; border-bottom: 1px solid #2a2a3a;">
                                        <p style="margin: 0 0 8px; color: #ffffff; font-size: 14px; font-weight: 600;">Order ID: <span style="color: #00d4aa;">${orderId}</span></p>
                                        <p style="margin: 4px 0 0; color: #8b8b9e; font-size: 13px;">Order Type: ${orderTypeLabel}</p>
                                        <p style="margin: 4px 0 0; color: #8b8b9e; font-size: 13px;">Status: <span style="color: #ff9f43; font-weight: 600;">Pending</span></p>
                                    </div>
                                    ${qrNote}
                                    <div style="margin: 24px 0 8px; text-align: center;">
                                        <a href="${orderData.trackingUrl}" style="background-color: #00d4aa; color: #0a0a0f; padding: 13px 26px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; font-family: 'Outfit', sans-serif;">
                                            ${orderData.order_type === 'pickup' ? '📱 View Order & Pickup QR Code' : '📦 Track Your Order'}
                                        </a>
                                    </div>
                                </td>
                            </tr>
                            
                            <!-- Items Table -->
                            <tr>
                                <td style="padding: 0 30px 30px;">
                                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #2a2a3a;">
                                        <thead>
                                            <tr style="background-color: #1a1a24;">
                                                <th style="padding: 12px; text-align: center; color: #ffffff; font-size: 13px; font-weight: 600; border-bottom: 2px solid #2a2a3a; width: 60px;">Image</th>
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
                            
                            <!-- Total -->
                            <tr>
                                <td style="padding: 0 30px 30px;">
                                    <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #2a2a3a; padding-top: 20px;">
                                        <tr>
                                            <td style="padding: 8px 0; text-align: right; color: #8b8b9e; font-size: 15px;">Total Amount:</td>
                                            <td style="padding: 8px 0; text-align: right; color: #ffffff; font-size: 20px; font-weight: 700; width: 150px; font-family: 'Outfit', sans-serif;">₱${formatPeso(orderData.total_amount)}</td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                            ${generateEmailFooter()}
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
}

/**
 * Generate HTML for order confirmed email
 */
function generateOrderConfirmedEmail(customerName, orderId, orderData) {
    const itemsHtml = orderData.items.map(item => {
        const displayImg = getGoogleDriveThumbnail(item.imageUrl);
        return `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: center; vertical-align: middle; width: 60px;">
                    ${displayImg 
                        ? `<img src="${displayImg}" alt="${escapeHtml(item.name)}" width="50" height="50" style="object-fit: cover; border-radius: 6px; border: 1px solid #2a2a3a; display: block; margin: 0 auto;">`
                        : `<div style="width: 50px; height: 50px; border-radius: 6px; background-color: #1a1a24; border: 1px solid #2a2a3a; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #8b8b9e; margin: 0 auto; line-height: 50px; text-align: center;">📦</div>`
                    }
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; color: #ffffff; vertical-align: middle;">${escapeHtml(item.name)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: center; color: #ffffff; vertical-align: middle;">${item.quantity}</td>
                <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: right; color: #8b8b9e; vertical-align: middle;">₱${formatPeso(item.price)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: right; font-weight: 600; color: #ffffff; vertical-align: middle;">₱${formatPeso(item.quantity * parseFloat(item.price))}</td>
            </tr>
        `;
    }).join('');

    const orderTypeLabel = orderData.order_type === 'pickup' ? 'Pickup' : 'Delivery (3rd Party)';
    const nextStep = orderData.order_type === 'pickup' 
        ? '<p style="margin: 16px 0 0; color: #00d4aa; font-size: 15px; font-weight: 600; line-height: 1.6;">Your order is ready for pickup! Please bring your QR code when you come to collect your order.</p>'
        : '<p style="margin: 16px 0 0; color: #ffffff; font-size: 15px; line-height: 1.6;">We will contact you soon through your provided contact number or social media to arrange delivery.</p>';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Confirmed - Tita\'s Vape Shop</title>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0f; color: #ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #12121a; border: 1px solid #2a2a3a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #3b82f6, #1a1a24); padding: 40px 30px; text-align: center; border-bottom: 1px solid #2a2a3a;">
                                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 1px; font-family: 'Outfit', sans-serif;">TITA\'S VAPE SHOP</h1>
                                    <p style="margin: 8px 0 0; color: #8b8b9e; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">Order Confirmed</p>
                                </td>
                            </tr>
                            
                            <!-- Order Info -->
                            <tr>
                                <td style="padding: 30px 30px 20px;">
                                    <p style="margin: 0 0 8px; color: #8b8b9e; font-size: 14px;">Hello ${escapeHtml(customerName)},</p>
                                    <p style="margin: 16px 0 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
                                        Great news! Your order has been confirmed and is now being prepared.
                                    </p>
                                    <div style="margin: 24px 0; padding: 16px; background-color: #1a1a24; border-left: 4px solid #3b82f6; border-radius: 4px; border-top: 1px solid #2a2a3a; border-right: 1px solid #2a2a3a; border-bottom: 1px solid #2a2a3a;">
                                        <p style="margin: 0 0 8px; color: #ffffff; font-size: 14px; font-weight: 600;">Order ID: <span style="color: #3b82f6;">${orderId}</span></p>
                                        <p style="margin: 4px 0 0; color: #8b8b9e; font-size: 13px;">Order Type: ${orderTypeLabel}</p>
                                        <p style="margin: 4px 0 0; color: #8b8b9e; font-size: 13px;">Status: <span style="color: #3b82f6; font-weight: 600;">Confirmed</span></p>
                                    </div>
                                    ${nextStep}
                                    <div style="margin: 24px 0 8px; text-align: center;">
                                        <a href="${orderData.trackingUrl}" style="background-color: #3b82f6; color: #ffffff; padding: 13px 26px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; font-family: 'Outfit', sans-serif;">
                                            ${orderData.order_type === 'pickup' ? '📱 Show Pickup QR Code' : '📦 View Live Status'}
                                        </a>
                                    </div>
                                </td>
                            </tr>
                            
                            <!-- Items Table -->
                            <tr>
                                <td style="padding: 0 30px 30px;">
                                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #2a2a3a;">
                                        <thead>
                                            <tr style="background-color: #1a1a24;">
                                                <th style="padding: 12px; text-align: center; color: #ffffff; font-size: 13px; font-weight: 600; border-bottom: 2px solid #2a2a3a; width: 60px;">Image</th>
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
                            
                            <!-- Total -->
                            <tr>
                                <td style="padding: 0 30px 30px;">
                                    <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #2a2a3a; padding-top: 20px;">
                                        <tr>
                                            <td style="padding: 8px 0; text-align: right; color: #8b8b9e; font-size: 15px;">Total Amount:</td>
                                            <td style="padding: 8px 0; text-align: right; color: #ffffff; font-size: 20px; font-weight: 700; width: 150px; font-family: 'Outfit', sans-serif;">₱${formatPeso(orderData.total_amount)}</td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                            ${generateEmailFooter()}
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
}

/**
 * Generate HTML for order completed email
 */
function generateOrderCompletedEmail(customerName, orderId, orderData) {
    const itemsHtml = orderData.items.map(item => {
        const displayImg = getGoogleDriveThumbnail(item.imageUrl);
        return `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: center; vertical-align: middle; width: 60px;">
                    ${displayImg 
                        ? `<img src="${displayImg}" alt="${escapeHtml(item.name)}" width="50" height="50" style="object-fit: cover; border-radius: 6px; border: 1px solid #2a2a3a; display: block; margin: 0 auto;">`
                        : `<div style="width: 50px; height: 50px; border-radius: 6px; background-color: #1a1a24; border: 1px solid #2a2a3a; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #8b8b9e; margin: 0 auto; line-height: 50px; text-align: center;">📦</div>`
                    }
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; color: #ffffff; vertical-align: middle;">${escapeHtml(item.name)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: center; color: #ffffff; vertical-align: middle;">${item.quantity}</td>
                <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: right; color: #8b8b9e; vertical-align: middle;">₱${formatPeso(item.price)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: right; font-weight: 600; color: #ffffff; vertical-align: middle;">₱${formatPeso(item.quantity * parseFloat(item.price))}</td>
            </tr>
        `;
    }).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Completed - Tita\'s Vape Shop</title>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0f; color: #ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #12121a; border: 1px solid #2a2a3a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #00d4aa, #1a1a24); padding: 40px 30px; text-align: center; border-bottom: 1px solid #2a2a3a;">
                                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 1px; font-family: 'Outfit', sans-serif;">TITA\'S VAPE SHOP</h1>
                                    <p style="margin: 8px 0 0; color: #8b8b9e; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">Order Completed</p>
                                </td>
                            </tr>
                            
                            <!-- Order Info -->
                            <tr>
                                <td style="padding: 30px 30px 20px;">
                                    <p style="margin: 0 0 8px; color: #8b8b9e; font-size: 14px;">Hello ${escapeHtml(customerName)},</p>
                                    <p style="margin: 16px 0 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
                                        Your order has been completed successfully! Thank you for your purchase.
                                    </p>
                                    <div style="margin: 24px 0; padding: 16px; background-color: #1a1a24; border-left: 4px solid #00d4aa; border-radius: 4px; border-top: 1px solid #2a2a3a; border-right: 1px solid #2a2a3a; border-bottom: 1px solid #2a2a3a;">
                                        <p style="margin: 0 0 8px; color: #ffffff; font-size: 14px; font-weight: 600;">Order ID: <span style="color: #00d4aa;">${orderId}</span></p>
                                        <p style="margin: 4px 0 0; color: #8b8b9e; font-size: 13px;">Status: <span style="color: #00d4aa; font-weight: 600;">Completed</span></p>
                                    </div>
                                    <p style="margin: 16px 0 0; color: #8b8b9e; font-size: 15px; line-height: 1.6;">
                                        We hope you enjoy your purchase! If you have any questions or concerns, please don't hesitate to contact us.
                                    </p>
                                    <div style="margin: 24px 0 8px; text-align: center;">
                                        <a href="${orderData.trackingUrl}" style="background-color: #00d4aa; color: #0a0a0f; padding: 13px 26px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; font-family: 'Outfit', sans-serif;">
                                            View Order Receipt
                                        </a>
                                    </div>
                                </td>
                            </tr>
                            
                            <!-- Items Table -->
                            <tr>
                                <td style="padding: 0 30px 30px;">
                                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #2a2a3a;">
                                        <thead>
                                            <tr style="background-color: #1a1a24;">
                                                <th style="padding: 12px; text-align: center; color: #ffffff; font-size: 13px; font-weight: 600; border-bottom: 2px solid #2a2a3a; width: 60px;">Image</th>
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
                            
                            <!-- Total -->
                            <tr>
                                <td style="padding: 0 30px 30px;">
                                    <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #2a2a3a; padding-top: 20px;">
                                        <tr>
                                            <td style="padding: 8px 0; text-align: right; color: #8b8b9e; font-size: 15px;">Total Amount:</td>
                                            <td style="padding: 8px 0; text-align: right; color: #ffffff; font-size: 20px; font-weight: 700; width: 150px; font-family: 'Outfit', sans-serif;">₱${formatPeso(orderData.total_amount)}</td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                            ${generateEmailFooter()}
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
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

module.exports = { sendOrderEmail, router };
