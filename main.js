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
const { isAuthenticated, hasRole } = require('./config/middleware/authMiddleware');

const app = express();

// Setup middleware
setupMiddleware(app);

// Routes
app.use('/', loginRoutes);               // Handles GET /, POST /api/login, and POST /api/logout
app.use('/dashboard', isAuthenticated, dashboardRoutes);  // GET /dashboard
app.use('/inventory', isAuthenticated, hasRole(['admin', 'staff']), inventoryRoutes);  // Inventory management
app.use('/sales', isAuthenticated, hasRole(['admin', 'staff']), salesRoutes);          // Sales / POS page
app.use('/auth/google', googleAuthRoutes); // Google OAuth routes
app.use('/api/upload', isAuthenticated, uploadRoutes);    // Image upload to Google Drive
app.use('/api/email', isAuthenticated, emailRoutes);      // Email service for receipts
app.use('/transactions', isAuthenticated, hasRole(['admin']), transactionsRoutes); // Transaction view
app.use('/api/transactions', isAuthenticated, transactionsRoutes); // Transaction logging and reports
app.use('/api/sales', isAuthenticated, salesApiRoutes);   // Sales API (Checkout, etc.)

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
