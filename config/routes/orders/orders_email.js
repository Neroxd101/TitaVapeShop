/**
 * Order Email Service
 * Sends email notifications for order status updates
 */

const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { supabase } = require('../../database/supabase');

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
        console.log('[Order Email] No email provided, skipping email send');
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
        console.log(`[Order Email] Email sent successfully to ${customerEmail} for order ${orderId} (${status})`);
        return { success: true };
    } catch (error) {
        console.error('[Order Email] Error sending email:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generate HTML for order created email
 */
function generateOrderCreatedEmail(customerName, orderId, orderData) {
    const itemsHtml = orderData.items.map(item => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">₱${parseFloat(item.price).toFixed(2)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">₱${(item.quantity * parseFloat(item.price)).toFixed(2)}</td>
        </tr>
    `).join('');

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
                            
                            <!-- Footer -->
                            <tr>
                                <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                                    <p style="margin: 0; color: #6b7280; font-size: 13px;">We will notify you once your order is confirmed and ready.</p>
                                    <p style="margin: 8px 0 0; color: #9ca3af; font-size: 12px;">Thank you for choosing Tita Vape Shop!</p>
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
 * Generate HTML for order confirmed email
 */
function generateOrderConfirmedEmail(customerName, orderId, orderData) {
    const itemsHtml = orderData.items.map(item => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">₱${parseFloat(item.price).toFixed(2)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">₱${(item.quantity * parseFloat(item.price)).toFixed(2)}</td>
        </tr>
    `).join('');

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
                            
                            <!-- Footer -->
                            <tr>
                                <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                                    <p style="margin: 0; color: #6b7280; font-size: 13px;">We'll notify you once your order is ready for ${orderData.order_type === 'pickup' ? 'pickup' : 'delivery'}.</p>
                                    <p style="margin: 8px 0 0; color: #9ca3af; font-size: 12px;">Thank you for choosing Tita Vape Shop!</p>
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
 * Generate HTML for order completed email
 */
function generateOrderCompletedEmail(customerName, orderId, orderData) {
    const itemsHtml = orderData.items.map(item => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">₱${parseFloat(item.price).toFixed(2)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">₱${(item.quantity * parseFloat(item.price)).toFixed(2)}</td>
        </tr>
    `).join('');

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
                            
                            <!-- Footer -->
                            <tr>
                                <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                                    <p style="margin: 0; color: #6b7280; font-size: 13px;">We appreciate your business!</p>
                                    <p style="margin: 8px 0 0; color: #9ca3af; font-size: 12px;">Thank you for choosing Tita Vape Shop. We hope to serve you again soon!</p>
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
