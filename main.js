const express = require('express');
require('dotenv').config();

const setupMiddleware = require('./config/middleware/middlewareSetup');
const loginRoutes = require('./config/routes/login');
const dashboardRoutes = require('./config/routes/dashboard');
const inventoryLoadRoutes = require('./config/routes/inventory/inventory_get_all');
const inventoryCreateRoutes = require('./config/routes/inventory/inventory_create_item');
const inventoryUpdateRoutes = require('./config/routes/inventory/inventory_update_item');
const inventoryDeleteRoutes = require('./config/routes/inventory/inventory_delete_item');
const inventoryHistoryRoutes = require('./config/routes/inventory/inventory_get_sales_history');
const salesLoadRoutes = require('./config/routes/sales/serve_sales');
const salesCreateRoutes = require('./config/routes/sales/sales_process');
const salesEmailRoutes = require('./config/routes/sales/email_send_receipt');
const googleAuthRoutes = require('./config/routes/google-auth');
const uploadRoutes = require('./config/routes/upload');
const transactionsServeRoutes = require('./config/routes/transactions/transactions_controller');
const transactionsLogRoutes = require('./config/routes/transactions/transactions_log');
const transactionsListRoutes = require('./config/routes/transactions/transactions_get_all');
const transactionsStatsRoutes = require('./config/routes/transactions/transactions_get_stats');
const transactionsReportRoutes = require('./config/routes/transactions/transactions_get_report');
const analyticsServeRoutes = require('./config/routes/analytics/analytics_controller');
const analyticsApiRoutes = require('./config/routes/analytics/analytics_api');
const settingsRoutes = require('./config/routes/settings');
const catalogRoutes = require('./config/routes/catalog');

const app = express();

// Setup middleware
setupMiddleware(app);

// Routes
// All routes now define their full paths explicitly within their respective files
app.use('/', loginRoutes);
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
app.use('/', analyticsApiRoutes);
app.use('/', settingsRoutes);
app.use('/', catalogRoutes);
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
