const express = require('express');
require('dotenv').config();

const setupMiddleware = require('./config/middleware/middlewareSetup');
const loginRoutes = require('./config/routes/login');
const dashboardRoutes = require('./config/routes/dashboard');
const inventoryRoutes = require('./config/routes/inventory');
const googleAuthRoutes = require('./config/routes/google-auth');
const uploadRoutes = require('./config/routes/upload');

const app = express();

// Setup middleware
setupMiddleware(app);

// Routes
app.use('/', loginRoutes);               // GET / and POST / for login
app.use('/api/login', loginRoutes);      // POST /api/login
app.use('/dashboard', dashboardRoutes);  // GET /dashboard
app.use('/inventory', inventoryRoutes);  // GET /inventory, /inventory/api
app.use('/auth/google', googleAuthRoutes); // Google OAuth routes
app.use('/api/upload', uploadRoutes);    // Image upload to Google Drive

// For local development
if (process.env.NODE_ENV !== 'production') {
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
