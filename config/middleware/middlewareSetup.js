const cors = require('cors');
const express = require('express');
const path = require('path');
const session = require('express-session');

function setupMiddleware(app) {
  // Enable CORS
  app.use(cors());

  // Parse JSON bodies
  app.use(express.json());

  // Trust proxy (required for some hosting environments like Vercel/Heroku)
  app.set('trust proxy', 1);

  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || 'tita-vape-shop-secret',
    resave: true,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Serve static files from public folder
  app.use(express.static(path.join(__dirname, '../../public')));
}

module.exports = setupMiddleware;
