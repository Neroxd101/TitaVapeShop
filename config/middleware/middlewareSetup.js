const cors = require('cors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

function setupMiddleware(app) {
  // Enable CORS
  app.use(cors());

  // Parse JSON bodies
  app.use(express.json());

  // Cookie parser for JWT
  app.use(cookieParser());

  // Trust proxy (required for some hosting environments like Vercel/Heroku)
  app.set('trust proxy', 1);

  // Serve static files from public folder
  app.use(express.static(path.join(__dirname, '../../public')));
}

module.exports = setupMiddleware;
