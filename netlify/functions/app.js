const serverless = require('serverless-http');
const app = require('../../main');

exports.handler = serverless(app, {
  basePath: '/.netlify/functions/app',
  // Preserve images and fonts served by the existing static middleware.
  binary: ['image/*', 'font/*', 'application/font-sfnt', 'application/vnd.ms-fontobject', 'application/octet-stream'],
});
