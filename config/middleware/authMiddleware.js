const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * isAuthenticated Middleware
 * Verifies that the user has a valid JWT token in their cookies
 * This middleware should be used on routes that require authentication
 * 
 * How it works:
 * 1. Extracts JWT token from cookies
 * 2. Verifies token signature and expiration
 * 3. Attaches decoded user info to req.user
 * 4. Allows request to proceed if valid, otherwise blocks it
 */
function isAuthenticated(req, res, next) {
    // Step 1: Get JWT token from HTTP-only cookie
    const token = req.cookies?.token;

    // Step 2: Check if token exists
    if (!token) {
        // Step 3: Handle different request types (API vs HTML)
        // API requests (AJAX/JSON) get JSON error response
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(401).json({ error: 'Unauthorized: Please log in' });
        }
        // HTML requests get redirected to login page
        return res.redirect('/login');
    }

    try {
        // Step 4: Verify JWT token signature and expiration
        // jwt.verify throws error if token is invalid or expired
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Step 5: Attach user info to request object for use in route handlers
        // This makes user data available in req.user throughout the request
        req.user = decoded;
        
        // Step 6: Allow request to proceed to the next middleware/route handler
        return next();
    } catch (err) {
        // Step 7: Handle invalid/expired token
        // Clear the invalid token from cookies
        res.clearCookie('token');
        
        // Step 8: Return appropriate error based on request type
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(401).json({ error: 'Unauthorized: Session expired' });
        }
        // Redirect HTML requests to login page
        res.redirect('/login');
    }
}

/**
 * hasRole Middleware Factory
 * Creates a middleware that checks if user has at least one of the required roles
 * This middleware should be used AFTER isAuthenticated middleware
 * 
 * @param {string[]} roles - Array of allowed roles (e.g., ['admin', 'staff'])
 * @returns {Function} Middleware function that checks user roles
 * 
 * How it works:
 * 1. Checks if req.user exists (user must be authenticated first)
 * 2. Verifies user has at least one of the required roles
 * 3. Allows request if authorized, otherwise returns 403 Forbidden
 */
function hasRole(roles) {
    return (req, res, next) => {
        // Step 1: Check if user is authenticated (req.user should exist from isAuthenticated middleware)
        if (!req.user) {
            // Step 2: Handle unauthenticated requests
            if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            return res.redirect('/login');
        }

        // Step 3: Check if user has at least one of the required roles
        // req.user.roles is a TEXT string (e.g., "admin,staff")
        // roles.some() returns true if ANY role in the array is found in userRoles
        // Example: roles=['admin'] and userRoles="admin,staff" → returns true
        const hasRequiredRole = roles.some(role => (req.user.roles || '').includes(role));

        // Step 4: If user has required role, allow request to proceed
        if (hasRequiredRole) {
            return next();
        }

        // Step 5: User doesn't have required role - deny access
        // 403 Forbidden means authenticated but not authorized
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }
        return res.redirect('/login?error=' + encodeURIComponent('Insufficient permissions'));
    };
}

module.exports = {
    isAuthenticated,
    hasRole
};
