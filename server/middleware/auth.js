const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'NO_TOKEN_PROVIDED' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload; // attach user info to request
        next();
    } catch (err) {
        return res.status(403).json({ error: 'INVALID_TOKEN' });
    }
}

module.exports = authenticateToken;