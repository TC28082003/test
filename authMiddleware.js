// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

    if (token == null) {
        console.log('Auth Middleware: No token provided.');
        return res.status(401).json({ message: 'Authentication token required.' }); // Unauthorized
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, userPayload) => {
        if (err) {
            console.error('Auth Middleware: JWT Verification Error:', err.message);
            // Differentiate between expired and invalid tokens
            if (err.name === 'TokenExpiredError') {
                 return res.status(401).json({ message: 'Authentication token expired.' }); // Unauthorized (Expired)
            } else {
                 return res.status(403).json({ message: 'Invalid authentication token.' }); // Forbidden (Malformed/Invalid Signature)
            }
        }

        // IMPORTANT: userPayload contains what you put in jwt.sign() during login
        if (!userPayload || !userPayload.id) {
             console.error('Auth Middleware: JWT payload missing user ID.');
             return res.status(403).json({ message: 'Invalid token payload.'}); // Forbidden
        }

        // Attach user ID to the request object for subsequent handlers
        req.userId = userPayload.id;
        console.log(`Auth Middleware: Token verified for user ID: ${req.userId}`);
        next(); // Proceed to the next middleware or route handler
    });
};

module.exports = authenticateToken;