const cors = require('cors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const sensitiveRateLimiter = require('./rateLimiter');
const securityHeaders = require('./securityHeaders');

function getAllowedOrigins() {
  const configured = [
    process.env.APP_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',')
  ]
    .map(origin => (origin || '').trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (process.env.NODE_ENV !== 'production') {
    configured.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }

  return new Set(configured);
}

function setupMiddleware(app) {
  const allowedOrigins = getAllowedOrigins();

  // Netlify supplies the real client address through one trusted proxy hop.
  // Other deployments can opt in with TRUST_PROXY=1 (or another hop count).
  if (process.env.NETLIFY === 'true' || process.env.TRUST_PROXY) {
    const configuredTrust = process.env.TRUST_PROXY;
    const trustProxy = configuredTrust && /^\d+$/.test(configuredTrust)
      ? Number(configuredTrust)
      : 1;
    app.set('trust proxy', trustProxy);
  }

  // Reject abusive traffic before parsing its request body.
  app.use(sensitiveRateLimiter);
  app.use(securityHeaders);

  // Browser requests without an Origin are same-origin or non-browser clients.
  // Cross-origin browser requests must match an explicitly trusted URL.
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) {
        return callback(null, true);
      }
      return callback(new Error('Origin is not allowed by CORS'));
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept']
  }));

  // CORS controls who may read responses. This separate check prevents a
  // foreign website from submitting cookie-authenticated state changes.
  app.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

    const origin = req.get('origin');
    const fetchSite = req.get('sec-fetch-site');
    if (fetchSite === 'cross-site' ||
        (origin && !allowedOrigins.has(origin.replace(/\/$/, '')))) {
      return res.status(403).json({ success: false, error: 'Cross-site request blocked' });
    }

    return next();
  });

  const normalJsonParser = express.json({ limit: '1mb' });
  const uploadJsonParser = express.json({ limit: '12mb' });

  // Base64 image uploads need a larger body than ordinary API requests.
  app.use((req, res, next) => {
    const parser = req.path.startsWith('/api/upload') ? uploadJsonParser : normalJsonParser;
    return parser(req, res, next);
  });

  app.use(express.urlencoded({ extended: true, limit: '256kb', parameterLimit: 100 }));

  app.use((error, req, res, next) => {
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ success: false, error: 'Request is too large' });
    }
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return res.status(400).json({ success: false, error: 'Invalid JSON request' });
    }
    if (error?.message === 'Origin is not allowed by CORS') {
      return res.status(403).json({ success: false, error: 'Origin is not allowed' });
    }
    return next(error);
  });

  // Cookie parser for JWT
  app.use(cookieParser());

  // Serve static files from frontend folder
  app.use(express.static(path.join(__dirname, '../../frontend')));
  // Serve static QR code assets
  app.use('/qr', express.static(path.join(__dirname, '../../qr')));
}

module.exports = setupMiddleware;
