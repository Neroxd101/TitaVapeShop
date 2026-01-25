const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'tita-vape-shop-jwt-secret';

function isAuthenticated(req, res, next) {
    const token = req.cookies?.token;

    if (!token) {
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

        // Normalize user roles - handle array, string, and Postgres array formats
        let userRoles = req.user.roles || [];

        if (typeof userRoles === 'string') {
            if (userRoles.startsWith('{') && userRoles.endsWith('}')) {
                // Postgres array format: {admin,staff}
                userRoles = userRoles.slice(1, -1).split(',').map(r => r.trim().replace(/^"|"$/g, ''));
            } else {
                try {
                    userRoles = JSON.parse(userRoles);
                } catch (e) {
                    userRoles = [userRoles];
                }
            }
        }

        if (!Array.isArray(userRoles)) {
            userRoles = userRoles ? [userRoles] : [];
        }

        const hasRequiredRole = roles.some(role => userRoles.includes(role));

        if (hasRequiredRole) {
            return next();
        }

        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }
        return res.redirect('/?error=' + encodeURIComponent('Insufficient permissions'));
    };
}

module.exports = {
    isAuthenticated,
    hasRole
};
