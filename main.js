const express = require('express');
require('dotenv').config();

const setupMiddleware = require('./backend/middleware/middlewareSetup');

// Auth routes
const adminLoginRoutes = require('./backend/routes/admin/login/login');
const googleAuthRoutes = require('./backend/routes/admin/admin/setting/google_auth');
const passwordResetRoutes = require('./backend/routes/admin/login/password_reset');
// Customer routes (1-to-1 matching Supabase RPC names)
const customerCheckEmailRoutes = require('./backend/routes/customer/customer_check_email');
const customerCheckPhoneRoutes = require('./backend/routes/customer/customer_check_phone');
const customerRegisterRoutes = require('./backend/routes/customer/customer_register');
const customerVerifyOtpRoutes = require('./backend/routes/customer/customer_verify_otp');
const customerGenerateOtpRoutes = require('./backend/routes/customer/customer_generate_otp');
const customerLoginRoutes = require('./backend/routes/customer/customer_login');
const customerUpdateProfileRoutes = require('./backend/routes/customer/customer_update_profile');
const customerCreateOrderRoutes = require('./backend/routes/customer/customer_create_order');
const customerGetOrdersRoutes = require('./backend/routes/customer/customer_get_orders');
const customerCancelOrderRoutes = require('./backend/routes/customer/customer_cancel_order');
const customerTrackOrderRoutes = require('./backend/routes/customer/customer_track_order');
const customerResetPasswordRoutes = require('./backend/routes/customer/customer_reset_password');
const customerChangePasswordRoutes = require('./backend/routes/customer/customer_change_password');

// Setting routes
const userProfileRoutes = require('./backend/routes/admin/admin/setting/user_profile');
const settingsRoutes = require('./backend/routes/admin/admin/setting/settings');

// Catalog routes
const catalogGetProductsRoutes = require('./backend/routes/catalog/catalog_get_products');
const catalogImageProxyRoutes = require('./backend/routes/catalog/catalog_image_proxy');
const catalogRoutes = require('./backend/routes/catalog/catalog');

// Dashboard routes
const dashboardRoutes = require('./backend/routes/admin/admin/dashboard/dashboard');

// Upload routes
const uploadRoutes = require('./backend/routes/upload/upload');
const keepAliveRoutes = require('./backend/routes/KeepAlive');

// Inventory routes
const inventoryLoadRoutes = require('./backend/routes/admin/admin/inventory/inventory_get_all');
const inventoryCreateRoutes = require('./backend/routes/admin/admin/inventory/inventory_create_item');
const inventoryUpdateRoutes = require('./backend/routes/admin/admin/inventory/inventory_update_item');
const inventoryDeleteRoutes = require('./backend/routes/admin/admin/inventory/inventory_delete_item');
const inventoryHistoryRoutes = require('./backend/routes/admin/admin/inventory/inventory_get_sales_history');

// POS (Sales) routes
const posControllerRoutes = require('./backend/routes/admin/admin/pos/pos_controller');
const salesCreateRoutes = require('./backend/routes/admin/admin/pos/pos_process');
const salesEmailRoutes = require('./backend/routes/admin/admin/pos/email_send_receipt');

// Activity Log (Transactions) routes
const transactionsServeRoutes = require('./backend/routes/admin/admin/activity-log/activity_log_controller');
const transactionsLogRoutes = require('./backend/routes/admin/admin/activity-log/transactions_log');
const transactionsListRoutes = require('./backend/routes/admin/admin/activity-log/transactions_get_all');
const transactionsStatsRoutes = require('./backend/routes/admin/admin/activity-log/transactions_get_stats');
const transactionsReportRoutes = require('./backend/routes/admin/admin/activity-log/transactions_get_report');

// Analytics routes
const analyticsServeRoutes = require('./backend/routes/admin/admin/analytics/analytics_controller');
const analyticsDashboardRoutes = require('./backend/routes/admin/admin/analytics/analytics_dashboard');
const analyticsTotalProfitRoutes = require('./backend/routes/admin/admin/analytics/analytics_total_profit');
const analyticsTotalOrdersRoutes = require('./backend/routes/admin/admin/analytics/analytics_total_orders');
const analyticsItemsSoldRoutes = require('./backend/routes/admin/admin/analytics/analytics_items_sold');
const analyticsGrossSalesRoutes = require('./backend/routes/admin/admin/analytics/analytics_gross_sales');
const analyticsRevenueTrendRoutes = require('./backend/routes/admin/admin/analytics/analytics_revenue_trend');
const analyticsTopProductsRoutes = require('./backend/routes/admin/admin/analytics/analytics_top_products');
const analyticsCategoryStatsRoutes = require('./backend/routes/admin/admin/analytics/analytics_category_stats');

// Orders routes
const ordersControllerRoutes = require('./backend/routes/admin/admin/orders/orders_controller');
const ordersGetAllRoutes = require('./backend/routes/admin/admin/orders/orders_get_all');
const ordersUpdateStatusRoutes = require('./backend/routes/admin/admin/orders/orders_update_status');

// Staff routes
const staffPosRoutes = require('./backend/routes/admin/staff/pos/serve_pos');
const staffOrdersRoutes = require('./backend/routes/admin/staff/orders/serve_orders');

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
app.use('/', posControllerRoutes);
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
