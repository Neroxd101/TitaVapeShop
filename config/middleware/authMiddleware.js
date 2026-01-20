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
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const userRoles = req.user.roles || [];
        const hasRequiredRole = roles.some(role => userRoles.includes(role));

        if (hasRequiredRole) {
            return next();
        }

        res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    };
}

module.exports = {
    isAuthenticated,
    hasRole
};
