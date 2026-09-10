const express = require('express');
require('dotenv').config();

const setupMiddleware = require('./config/middleware/middlewareSetup');

// Auth routes
const adminLoginRoutes = require('./config/routes/admin/login/login');
const googleAuthRoutes = require('./config/routes/admin/admin/setting/google_auth');
const passwordResetRoutes = require('./config/routes/admin/login/password_reset');
// Customer routes (1-to-1 matching Supabase RPC names)
const customerCheckEmailRoutes = require('./config/routes/customer/customer_check_email');
const customerCheckPhoneRoutes = require('./config/routes/customer/customer_check_phone');
const customerRegisterRoutes = require('./config/routes/customer/customer_register');
const customerVerifyOtpRoutes = require('./config/routes/customer/customer_verify_otp');
const customerGenerateOtpRoutes = require('./config/routes/customer/customer_generate_otp');
const customerLoginRoutes = require('./config/routes/customer/customer_login');
const customerUpdateProfileRoutes = require('./config/routes/customer/customer_update_profile');
const customerCreateOrderRoutes = require('./config/routes/customer/customer_create_order');
const customerGetOrdersRoutes = require('./config/routes/customer/customer_get_orders');
const customerCancelOrderRoutes = require('./config/routes/customer/customer_cancel_order');
const customerTrackOrderRoutes = require('./config/routes/customer/customer_track_order');
const customerResetPasswordRoutes = require('./config/routes/customer/customer_reset_password');
const customerChangePasswordRoutes = require('./config/routes/customer/customer_change_password');

// Setting routes
const userProfileRoutes = require('./config/routes/admin/admin/setting/user_profile');
const settingsRoutes = require('./config/routes/admin/admin/setting/settings');

// Catalog routes
const catalogGetProductsRoutes = require('./config/routes/catalog/catalog_get_products');
const catalogImageProxyRoutes = require('./config/routes/catalog/catalog_image_proxy');
const catalogRoutes = require('./config/routes/catalog/catalog');

// Dashboard routes
const dashboardRoutes = require('./config/routes/admin/admin/dashboard/dashboard');

// Upload routes
const uploadRoutes = require('./config/routes/upload/upload');
const keepAliveRoutes = require('./config/routes/KeepAlive');

// Inventory routes
const inventoryLoadRoutes = require('./config/routes/admin/admin/inventory/inventory_get_all');
const inventoryCreateRoutes = require('./config/routes/admin/admin/inventory/inventory_create_item');
const inventoryUpdateRoutes = require('./config/routes/admin/admin/inventory/inventory_update_item');
const inventoryDeleteRoutes = require('./config/routes/admin/admin/inventory/inventory_delete_item');
const inventoryHistoryRoutes = require('./config/routes/admin/admin/inventory/inventory_get_sales_history');

// POS (Sales) routes
const salesLoadRoutes = require('./config/routes/admin/admin/pos/serve_pos');
const salesCreateRoutes = require('./config/routes/admin/admin/pos/pos_process');
const salesEmailRoutes = require('./config/routes/admin/admin/pos/email_send_receipt');

// Activity Log (Transactions) routes
const transactionsServeRoutes = require('./config/routes/admin/admin/activity-log/activity_log_controller');
const transactionsLogRoutes = require('./config/routes/admin/admin/activity-log/transactions_log');
const transactionsListRoutes = require('./config/routes/admin/admin/activity-log/transactions_get_all');
const transactionsStatsRoutes = require('./config/routes/admin/admin/activity-log/transactions_get_stats');
const transactionsReportRoutes = require('./config/routes/admin/admin/activity-log/transactions_get_report');

// Analytics routes
const analyticsServeRoutes = require('./config/routes/admin/admin/analytics/analytics_controller');
const analyticsDashboardRoutes = require('./config/routes/admin/admin/analytics/analytics_dashboard');
const analyticsTotalProfitRoutes = require('./config/routes/admin/admin/analytics/analytics_total_profit');
const analyticsTotalOrdersRoutes = require('./config/routes/admin/admin/analytics/analytics_total_orders');
const analyticsItemsSoldRoutes = require('./config/routes/admin/admin/analytics/analytics_items_sold');
const analyticsGrossSalesRoutes = require('./config/routes/admin/admin/analytics/analytics_gross_sales');
const analyticsRevenueTrendRoutes = require('./config/routes/admin/admin/analytics/analytics_revenue_trend');
const analyticsTopProductsRoutes = require('./config/routes/admin/admin/analytics/analytics_top_products');
const analyticsCategoryStatsRoutes = require('./config/routes/admin/admin/analytics/analytics_category_stats');

// Orders routes
const ordersControllerRoutes = require('./config/routes/admin/admin/orders/orders_controller');
const ordersGetAllRoutes = require('./config/routes/admin/admin/orders/orders_get_all');
const ordersUpdateStatusRoutes = require('./config/routes/admin/admin/orders/orders_update_status');

// Staff routes
const staffPosRoutes = require('./config/routes/admin/staff/pos/serve_pos');
const staffOrdersRoutes = require('./config/routes/admin/staff/orders/serve_orders');

const app = express();

// Setup middleware (includes static file serving)
setupMiddleware(app);

// Routes
// All routes now define their full paths explicitly within their respective files

// Customer routes (1-to-1 matching Supabase RPC names)
app.use('/', customerCheckEmailRoutes);
app.use('/', customerCheckPhoneRoutes);
app.use('/', customerRegisterRoutes);
app.use('/', customerVerifyOtpRoutes);
app.use('/', customerGenerateOtpRoutes);
app.use('/', customerLoginRoutes);
app.use('/', customerUpdateProfileRoutes);
app.use('/', customerCreateOrderRoutes);
app.use('/', customerGetOrdersRoutes);
app.use('/', customerCancelOrderRoutes);
app.use('/', customerTrackOrderRoutes);
app.use('/', customerResetPasswordRoutes);
app.use('/', customerChangePasswordRoutes);
app.use('/', catalogGetProductsRoutes); // Public product listing
app.use('/', catalogImageProxyRoutes); // Public product image proxy
app.use('/', catalogRoutes); // Public catalog for customers
app.use('/', passwordResetRoutes); // Password reset (public)
app.use('/keep-alive', keepAliveRoutes); // Public keep-alive endpoint (token-protected)
app.use('/', userProfileRoutes); // User profile management (authenticated)

// Admin / Staff Auth routes
app.use('/', adminLoginRoutes);
// Register orders routes early to avoid conflicts with other routes
app.use('/', ordersControllerRoutes);
app.use('/', ordersGetAllRoutes);
app.use('/', ordersUpdateStatusRoutes);
app.use('/', dashboardRoutes);
app.use('/', inventoryLoadRoutes);
app.use('/', inventoryCreateRoutes);
app.use('/', inventoryUpdateRoutes);
app.use('/', inventoryDeleteRoutes);
app.use('/', inventoryHistoryRoutes);
app.use('/', salesLoadRoutes);
app.use('/', salesCreateRoutes);
app.use('/', salesEmailRoutes);
app.use('/', googleAuthRoutes);
app.use('/', uploadRoutes);
app.use('/', transactionsServeRoutes);
app.use('/', transactionsLogRoutes);
app.use('/', transactionsListRoutes);
app.use('/', transactionsStatsRoutes);
app.use('/', transactionsReportRoutes);
app.use('/', analyticsServeRoutes);
app.use('/', analyticsDashboardRoutes);
app.use('/', analyticsTotalProfitRoutes);
app.use('/', analyticsTotalOrdersRoutes);
app.use('/', analyticsItemsSoldRoutes);
app.use('/', analyticsGrossSalesRoutes);
app.use('/', analyticsRevenueTrendRoutes);
app.use('/', analyticsTopProductsRoutes);
app.use('/', analyticsCategoryStatsRoutes);
app.use('/', settingsRoutes);
// Staff routes
app.use('/', staffPosRoutes);
app.use('/', staffOrdersRoutes);

// For local development
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Export for Vercel
module.exports = app;
