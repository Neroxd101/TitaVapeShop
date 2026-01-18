const cors = require('cors');
const express = require('express');
const path = require('path');

function setupMiddleware(app) {
  // Enable CORS
  app.use(cors());
  
  // Parse JSON bodies
  app.use(express.json());
  
  // Serve static files from public folder
  app.use(express.static(path.join(__dirname, '../../public')));
}

module.exports = setupMiddleware;
