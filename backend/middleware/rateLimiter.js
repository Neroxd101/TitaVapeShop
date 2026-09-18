const buckets = new Map();

const RULES = [
  {
    name: 'login',
    paths: ['/login', '/api/login', '/api/admin/login', '/api/customer/login'],
    windowMs: 15 * 60 * 1000,
    max: 10
  },
  {
    name: 'otp-request',
    paths: [
      '/api/password-reset/request',
      '/api/customer/forgot-password',
      '/api/customer/resend-otp',
      '/api/customer/register'
    ],
    windowMs: 15 * 60 * 1000,
    max: 5
  },
  {
    name: 'otp-verify',
    paths: [
      '/api/password-reset/verify',
      '/api/password-reset/reset',
      '/api/customer/verify-email',
      '/api/customer/verify-reset-code',
      '/api/customer/reset-password'
    ],
    windowMs: 15 * 60 * 1000,
    max: 10
  },
  {
    name: 'account-check',
    paths: ['/api/customer/check-email', '/api/customer/check-phone'],
    windowMs: 15 * 60 * 1000,
    max: 30
  },
  {
    name: 'public-orders',
    paths: [
      '/api/customer/orders/track',
      '/api/orders/track',
      '/api/customer/orders/batch',
      '/api/orders/track-batch',
      '/api/customer/orders/create',
      '/api/orders/create'
    ],
    windowMs: 15 * 60 * 1000,
    max: 30
  }
];

let lastCleanup = Date.now();

function cleanupExpired(now) {
  if (now - lastCleanup < 60 * 1000) return;
  lastCleanup = now;

  for (const [key, record] of buckets) {
    if (record.resetAt <= now) buckets.delete(key);
  }
}

function sensitiveRateLimiter(req, res, next) {
  if (req.method !== 'POST' && req.method !== 'GET') return next();

  const rule = RULES.find(candidate => candidate.paths.includes(req.path));
  if (!rule) return next();

  const now = Date.now();
  cleanupExpired(now);

  const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
  const key = `${rule.name}:${clientIp}`;
  let record = buckets.get(key);

  if (!record || record.resetAt <= now) {
    record = { count: 0, resetAt: now + rule.windowMs };
  }

  record.count += 1;
  buckets.set(key, record);

  const remaining = Math.max(rule.max - record.count, 0);
  const retryAfterSeconds = Math.max(Math.ceil((record.resetAt - now) / 1000), 1);

  res.setHeader('RateLimit-Limit', String(rule.max));
  res.setHeader('RateLimit-Remaining', String(remaining));
  res.setHeader('RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));

  if (record.count > rule.max) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      retry_after_seconds: retryAfterSeconds
    });
  }

  return next();
}

module.exports = sensitiveRateLimiter;
