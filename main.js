const express = require('express');
require('dotenv').config();

const setupMiddleware = require('./config/middleware/middlewareSetup');
const loginRoutes = require('./config/routes/login');
const dashboardRoutes = require('./config/routes/dashboard');
const inventoryLoadRoutes = require('./config/routes/inventory/load-items');
const inventoryCreateRoutes = require('./config/routes/inventory/create-item');
const inventoryUpdateRoutes = require('./config/routes/inventory/update-item');
const inventoryDeleteRoutes = require('./config/routes/inventory/delete-item');
const salesLoadRoutes = require('./config/routes/sales/load-sales');
const salesCreateRoutes = require('./config/routes/sales/create-sale');
const salesEmailRoutes = require('./config/routes/sales/email-send-receipt');
const googleAuthRoutes = require('./config/routes/google-auth');
const uploadRoutes = require('./config/routes/upload');
const transactionsServeRoutes = require('./config/routes/transactions/serve-transactions');
const transactionsLogRoutes = require('./config/routes/transactions/log-transaction');
const transactionsListRoutes = require('./config/routes/transactions/list-transactions');
const transactionsStatsRoutes = require('./config/routes/transactions/get-stats');
const transactionsReportRoutes = require('./config/routes/transactions/get-sales-report');
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
