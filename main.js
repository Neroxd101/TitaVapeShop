const express = require('express');
require('dotenv').config();

const setupMiddleware = require('./config/middleware/middlewareSetup');
const loginRoutes = require('./config/routes/login');
const dashboardRoutes = require('./config/routes/dashboard');
const inventoryRoutes = require('./config/routes/inventory');
const salesRoutes = require('./config/routes/sales');
const googleAuthRoutes = require('./config/routes/google-auth');
const uploadRoutes = require('./config/routes/upload');
const emailRoutes = require('./config/routes/email');
const transactionsRoutes = require('./config/routes/transactions');
const salesApiRoutes = require('./config/routes/sales-api');

const app = express();

// Setup middleware
setupMiddleware(app);

// Routes
// All routes now define their full paths explicitly within their respective files
app.use('/', loginRoutes);
app.use('/', dashboardRoutes);
app.use('/', inventoryRoutes);
app.use('/', salesRoutes);
app.use('/', googleAuthRoutes);
app.use('/', uploadRoutes);
app.use('/', emailRoutes);
app.use('/', transactionsRoutes);
app.use('/', salesApiRoutes);

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
