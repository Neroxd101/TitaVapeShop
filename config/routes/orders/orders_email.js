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
                subject = `Order Confirmation - Tita Vape Shop`;
                htmlContent = generateOrderCreatedEmail(customerName, orderId, orderData);
                break;
            case 'confirmed':
                subject = `Order Confirmed - Tita Vape Shop`;
                htmlContent = generateOrderConfirmedEmail(customerName, orderId, orderData);
                break;
            case 'completed':
                subject = `Order Completed - Tita Vape Shop`;
                htmlContent = generateOrderCompletedEmail(customerName, orderId, orderData);
                break;
            default:
                return { success: false, error: 'Invalid status' };
        }

        const mailOptions = {
            from: `"Tita Vape Shop" <${process.env.SMTP_USER}>`,
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
            <td style="background-color: #f9fafb; padding: 30px 30px; text-align: center; border-top: 1px solid #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <!-- Logo -->
                <div style="font-size: 20px; font-weight: 700; color: #00b894; margin-bottom: 6px; letter-spacing: 0.5px;">TITA VAPE SHOP</div>
                
                <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px;">We appreciate your business!</p>
                
                <!-- Store Info Table -->
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 12px; color: #6b7280; line-height: 1.6; border-top: 1px dashed #e5e7eb; padding-top: 16px; text-align: left;">
                    <tr>
                        <td style="padding-bottom: 4px;">
                            📍 <strong>Location:</strong> Tita Vape Shop Main Branch, Manila, Philippines
                        </td>
                        <td align="right" style="padding-bottom: 4px;">
                            📞 <strong>Contact:</strong> +63 912 345 6789
                        </td>
                    </tr>
                    <tr>
                        <td>
                            🕒 <strong>Store Hours:</strong> Open Daily: 10:00 AM - 10:00 PM
                        </td>
                        <td align="right">
                            📧 <strong>Email:</strong> vshoptita@gmail.com
                        </td>
                    </tr>
                </table>
                
                <div style="margin-top: 20px; font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 12px;">
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
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: middle; width: 60px;">
                    ${displayImg 
                        ? `<img src="${displayImg}" alt="${escapeHtml(item.name)}" width="50" height="50" style="object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; display: block; margin: 0 auto;">`
                        : `<div style="width: 50px; height: 50px; border-radius: 6px; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #9ca3af; margin: 0 auto; border: 1px solid #e5e7eb; line-height: 50px; text-align: center;">📦</div>`
                    }
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: middle;">${escapeHtml(item.name)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: middle;">${item.quantity}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; vertical-align: middle;">₱${parseFloat(item.price).toFixed(2)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; vertical-align: middle;">₱${(item.quantity * parseFloat(item.price)).toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    const orderTypeLabel = orderData.order_type === 'pickup' ? 'Pickup' : 'Delivery (3rd Party)';
    const qrNote = orderData.order_type === 'pickup' 
        ? '<p style="margin: 16px 0 0; color: #059669; font-size: 14px; font-weight: 600;">📱 Please show your QR code when picking up your order.</p>'
        : '';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Confirmation - Tita Vape Shop</title>
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
                                    <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Order Confirmation</p>
                                </td>
                            </tr>
                            
                            <!-- Order Info -->
                            <tr>
                                <td style="padding: 30px 30px 20px;">
                                    <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">Hello ${escapeHtml(customerName)},</p>
                                    <p style="margin: 16px 0 0; color: #111827; font-size: 16px; line-height: 1.6;">
                                        Thank you for your order! We have received your order and it is currently being processed.
                                    </p>
                                    <div style="margin: 24px 0; padding: 16px; background-color: #f0fdf4; border-left: 4px solid #00d4aa; border-radius: 4px;">
                                        <p style="margin: 0 0 8px; color: #111827; font-size: 14px; font-weight: 600;">Order ID: <span style="color: #00d4aa;">${orderId}</span></p>
                                        <p style="margin: 4px 0 0; color: #6b7280; font-size: 13px;">Order Type: ${orderTypeLabel}</p>
                                        <p style="margin: 4px 0 0; color: #6b7280; font-size: 13px;">Status: <span style="color: #f59e0b; font-weight: 600;">Pending</span></p>
                                    </div>
                                    ${qrNote}
                                </td>
                            </tr>
                            
                            <!-- Items Table -->
                            <tr>
                                <td style="padding: 0 30px 30px;">
                                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                                        <thead>
                                            <tr style="background-color: #f9fafb;">
                                                <th style="padding: 12px; text-align: center; color: #374151; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e5e7eb; width: 60px;">Image</th>
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
                            
                            <!-- Total -->
                            <tr>
                                <td style="padding: 0 30px 30px;">
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td style="padding: 8px 0; text-align: right; color: #6b7280; font-size: 15px;">Total Amount:</td>
                                            <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 20px; font-weight: 700; width: 150px;">₱${parseFloat(orderData.total_amount).toFixed(2)}</td>
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
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: middle; width: 60px;">
                    ${displayImg 
                        ? `<img src="${displayImg}" alt="${escapeHtml(item.name)}" width="50" height="50" style="object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; display: block; margin: 0 auto;">`
                        : `<div style="width: 50px; height: 50px; border-radius: 6px; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #9ca3af; margin: 0 auto; border: 1px solid #e5e7eb; line-height: 50px; text-align: center;">📦</div>`
                    }
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: middle;">${escapeHtml(item.name)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: middle;">${item.quantity}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; vertical-align: middle;">₱${parseFloat(item.price).toFixed(2)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; vertical-align: middle;">₱${(item.quantity * parseFloat(item.price)).toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    const orderTypeLabel = orderData.order_type === 'pickup' ? 'Pickup' : 'Delivery (3rd Party)';
    const nextStep = orderData.order_type === 'pickup' 
        ? '<p style="margin: 16px 0 0; color: #111827; font-size: 15px; line-height: 1.6;">Your order is ready for pickup! Please bring your QR code when you come to collect your order.</p>'
        : '<p style="margin: 16px 0 0; color: #111827; font-size: 15px; line-height: 1.6;">We will contact you soon through your provided contact number or social media to arrange delivery.</p>';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Confirmed - Tita Vape Shop</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 40px 30px; text-align: center;">
                                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Tita Vape Shop</h1>
                                    <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Order Confirmed</p>
                                </td>
                            </tr>
                            
                            <!-- Order Info -->
                            <tr>
                                <td style="padding: 30px 30px 20px;">
                                    <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">Hello ${escapeHtml(customerName)},</p>
                                    <p style="margin: 16px 0 0; color: #111827; font-size: 16px; line-height: 1.6;">
                                        Great news! Your order has been confirmed and is now being prepared.
                                    </p>
                                    <div style="margin: 24px 0; padding: 16px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                                        <p style="margin: 0 0 8px; color: #111827; font-size: 14px; font-weight: 600;">Order ID: <span style="color: #3b82f6;">${orderId}</span></p>
                                        <p style="margin: 4px 0 0; color: #6b7280; font-size: 13px;">Order Type: ${orderTypeLabel}</p>
                                        <p style="margin: 4px 0 0; color: #6b7280; font-size: 13px;">Status: <span style="color: #3b82f6; font-weight: 600;">Confirmed</span></p>
                                    </div>
                                    ${nextStep}
                                </td>
                            </tr>
                            
                            <!-- Items Table -->
                            <tr>
                                <td style="padding: 0 30px 30px;">
                                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                                        <thead>
                                            <tr style="background-color: #f9fafb;">
                                                <th style="padding: 12px; text-align: center; color: #374151; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e5e7eb; width: 60px;">Image</th>
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
                            
                            <!-- Total -->
                            <tr>
                                <td style="padding: 0 30px 30px;">
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td style="padding: 8px 0; text-align: right; color: #6b7280; font-size: 15px;">Total Amount:</td>
                                            <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 20px; font-weight: 700; width: 150px;">₱${parseFloat(orderData.total_amount).toFixed(2)}</td>
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
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: middle; width: 60px;">
                    ${displayImg 
                        ? `<img src="${displayImg}" alt="${escapeHtml(item.name)}" width="50" height="50" style="object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; display: block; margin: 0 auto;">`
                        : `<div style="width: 50px; height: 50px; border-radius: 6px; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #9ca3af; margin: 0 auto; border: 1px solid #e5e7eb; line-height: 50px; text-align: center;">📦</div>`
                    }
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: middle;">${escapeHtml(item.name)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: middle;">${item.quantity}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; vertical-align: middle;">₱${parseFloat(item.price).toFixed(2)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; vertical-align: middle;">₱${(item.quantity * parseFloat(item.price)).toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Completed - Tita Vape Shop</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #10b981, #059669); padding: 40px 30px; text-align: center;">
                                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Tita Vape Shop</h1>
                                    <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Order Completed</p>
                                </td>
                            </tr>
                            
                            <!-- Order Info -->
                            <tr>
                                <td style="padding: 30px 30px 20px;">
                                    <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">Hello ${escapeHtml(customerName)},</p>
                                    <p style="margin: 16px 0 0; color: #111827; font-size: 16px; line-height: 1.6;">
                                        Your order has been completed successfully! Thank you for your purchase.
                                    </p>
                                    <div style="margin: 24px 0; padding: 16px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
                                        <p style="margin: 0 0 8px; color: #111827; font-size: 14px; font-weight: 600;">Order ID: <span style="color: #10b981;">${orderId}</span></p>
                                        <p style="margin: 4px 0 0; color: #6b7280; font-size: 13px;">Status: <span style="color: #10b981; font-weight: 600;">Completed</span></p>
                                    </div>
                                    <p style="margin: 16px 0 0; color: #111827; font-size: 15px; line-height: 1.6;">
                                        We hope you enjoy your purchase! If you have any questions or concerns, please don't hesitate to contact us.
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Items Table -->
                            <tr>
                                <td style="padding: 0 30px 30px;">
                                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                                        <thead>
                                            <tr style="background-color: #f9fafb;">
                                                <th style="padding: 12px; text-align: center; color: #374151; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e5e7eb; width: 60px;">Image</th>
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
                            
                            <!-- Total -->
                            <tr>
                                <td style="padding: 0 30px 30px;">
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td style="padding: 8px 0; text-align: right; color: #6b7280; font-size: 15px;">Total Amount:</td>
                                            <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 20px; font-weight: 700; width: 150px;">₱${parseFloat(orderData.total_amount).toFixed(2)}</td>
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
