const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: {
            code: 'UNAUTHENTICATED',
            message: 'No token provided'
        }});
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload; // attach user info to request
        next();
    } catch (err) {
        return res.status(401).json({ error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired token'
        }});
    }
}

module.exports = authenticateToken;