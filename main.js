const express = require('express');
require('dotenv').config();

const setupMiddleware = require('./config/middleware/middlewareSetup');

// Auth routes
const loginRoutes = require('./config/routes/auth/login');
const googleAuthRoutes = require('./config/routes/auth/google-auth');
const passwordResetRoutes = require('./config/routes/auth/password-reset');
// Customer routes (1-to-1 matching Supabase RPC names)
const customerCheckEmailRoutes = require('./config/routes/customer/customer_check_email');
const customerCheckPhoneRoutes = require('./config/routes/customer/customer_check_phone');
const customerRegisterRoutes = require('./config/routes/customer/customer_register');
const customerVerifyOtpRoutes = require('./config/routes/customer/customer_verify_otp');
const customerGenerateOtpRoutes = require('./config/routes/customer/customer_generate_otp');
const customerLoginRoutes = require('./config/routes/customer/customer_login');
const customerUpdateProfileRoutes = require('./config/routes/customer/customer_update_profile');

// User routes
const userProfileRoutes = require('./config/routes/users/user-profile');
const settingsRoutes = require('./config/routes/users/settings');

// Catalog routes
const catalogRoutes = require('./config/routes/catalog/catalog');

// Dashboard routes
const dashboardRoutes = require('./config/routes/dashboard/dashboard');

// Upload routes
const uploadRoutes = require('./config/routes/upload/upload');
const keepAliveRoutes = require('./config/routes/KeepAlive');

// Inventory routes
const inventoryLoadRoutes = require('./config/routes/inventory/inventory_get_all');
const inventoryCreateRoutes = require('./config/routes/inventory/inventory_create_item');
const inventoryUpdateRoutes = require('./config/routes/inventory/inventory_update_item');
const inventoryDeleteRoutes = require('./config/routes/inventory/inventory_delete_item');
const inventoryHistoryRoutes = require('./config/routes/inventory/inventory_get_sales_history');

// Sales routes
const salesLoadRoutes = require('./config/routes/sales/serve_sales');
const salesCreateRoutes = require('./config/routes/sales/sales_process');
const salesEmailRoutes = require('./config/routes/sales/email_send_receipt');

// Transactions routes
const transactionsServeRoutes = require('./config/routes/transactions/transactions_controller');
const transactionsLogRoutes = require('./config/routes/transactions/transactions_log');
const transactionsListRoutes = require('./config/routes/transactions/transactions_get_all');
const transactionsStatsRoutes = require('./config/routes/transactions/transactions_get_stats');
const transactionsReportRoutes = require('./config/routes/transactions/transactions_get_report');

// Analytics routes
const analyticsServeRoutes = require('./config/routes/analytics/analytics_controller');
const analyticsDashboardRoutes = require('./config/routes/analytics/analytics_dashboard');
const analyticsTotalProfitRoutes = require('./config/routes/analytics/analytics_total_profit');
const analyticsTotalOrdersRoutes = require('./config/routes/analytics/analytics_total_orders');
const analyticsItemsSoldRoutes = require('./config/routes/analytics/analytics_items_sold');
const analyticsGrossSalesRoutes = require('./config/routes/analytics/analytics_gross_sales');
const analyticsRevenueTrendRoutes = require('./config/routes/analytics/analytics_revenue_trend');
const analyticsTopProductsRoutes = require('./config/routes/analytics/analytics_top_products');
const analyticsCategoryStatsRoutes = require('./config/routes/analytics/analytics_category_stats');

// Orders routes
const ordersControllerRoutes = require('./config/routes/orders/orders_controller');
const ordersGetAllRoutes = require('./config/routes/orders/orders_get_all');
const ordersUpdateStatusRoutes = require('./config/routes/orders/orders_update_status');

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
app.use('/', catalogRoutes); // Public catalog for customers
app.use('/', passwordResetRoutes); // Password reset (public)
app.use('/keep-alive', keepAliveRoutes); // Public keep-alive endpoint (token-protected)
app.use('/', userProfileRoutes); // User profile management (authenticated)

// Protected routes (authentication required)
app.use('/', loginRoutes);
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
// app.use('/', salesApiRoutes); // Removed

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
