function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    console.log('Authentication failed for path:', req.path);
    if (!req.session) console.log('No session object found');
    else if (!req.session.user) console.log('No user in session');

    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(401).json({ error: 'Unauthorized: Please log in' });
    }
    res.redirect('/');
}

function hasRole(roles) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const userRoles = req.session.user.roles || [];
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
