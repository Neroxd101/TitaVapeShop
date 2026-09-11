const cors = require('cors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

function setupMiddleware(app) {
  // Enable CORS
  app.use(cors());

  // Parse JSON bodies with increased limit for image uploads (50MB)
  app.use(express.json({ limit: '50mb' }));
  
  // Parse URL-encoded bodies with increased limit (50MB)
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Cookie parser for JWT
  app.use(cookieParser());

  // Serve static files from public folder
  app.use(express.static(path.join(__dirname, '../../public')));
}

module.exports = setupMiddleware;
