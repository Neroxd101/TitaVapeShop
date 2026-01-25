const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'tita-vape-shop-jwt-secret';

function isAuthenticated(req, res, next) {
    const token = req.cookies?.token;

    if (!token) {
        console.log('Authentication failed: No token found');
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(401).json({ error: 'Unauthorized: Please log in' });
        }
        return res.redirect('/');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Attach user info to request
        return next();
    } catch (err) {
        console.error('Authentication failed: Invalid token', err.message);
        res.clearCookie('token');
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(401).json({ error: 'Unauthorized: Session expired' });
        }
        res.redirect('/');
    }
}

function hasRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            return res.redirect('/');
        }

        // Normalize user roles - handle both array and string formats
        let userRoles = req.user.roles || [];

        // Handle various string formats
        if (typeof userRoles === 'string') {
            // Check for Postgres array format {admin,staff}
            if (userRoles.startsWith('{') && userRoles.endsWith('}')) {
                userRoles = userRoles
                    .slice(1, -1) // Remove { and }
                    .split(',')   // Split by comma
                    .map(r => r.trim().replace(/^"|"$/g, '')); // Remove usage quotes if any
            } else {
                try {
                    userRoles = JSON.parse(userRoles);
                } catch (e) {
                    // If parsing fails, treat as single role
                    userRoles = [userRoles];
                }
            }
        }

        // Ensure it's an array
        if (!Array.isArray(userRoles)) {
            userRoles = userRoles ? [userRoles] : [];
        }

        const hasRequiredRole = roles.some(role => userRoles.includes(role));

        // Debug logging
        console.log(`[Auth Check] User: ${req.user.username}, UserRoles: ${JSON.stringify(userRoles)}, Required: ${JSON.stringify(roles)}, Allowed: ${hasRequiredRole}, Path: ${req.path}`);

        if (hasRequiredRole) {
            return next();
        }

        // Do NOT clear cookie here. Just deny access.
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }
        // Redirect to login for browser requests with error
        return res.redirect('/?error=' + encodeURIComponent('Insufficient permissions'));
    };
}

module.exports = {
    isAuthenticated,
    hasRole
};
