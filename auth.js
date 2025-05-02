// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db'); // Database connection pool
require('dotenv').config();

const router = express.Router();
const saltRounds = 10; // Cost factor for bcrypt hashing

// --- Registration ---
router.post('/register', async (req, res) => {
    const { email, password } = req.body;

    // Basic input validation
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }
    if (password.length < 6) {
         return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    let connection; // Define connection outside try block for release in finally
    try {
        connection = await pool.getConnection(); // Get connection from pool

        // Check if user already exists
        const [existingUsers] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: "Email address is already registered." }); // 409 Conflict
        }

        // Hash the password securely
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Start transaction
        await connection.beginTransaction();

        // Insert new user into 'users' table
        const [userResult] = await connection.query(
            'INSERT INTO users (email, password_hash) VALUES (?, ?)',
            [email, passwordHash]
        );
        const newUserId = userResult.insertId;

        await connection.query(
            'INSERT INTO user_data (user_id, saved_profiles, saved_profiles_parent, last_visited_profile, virtual_profiles, virtual_profiles_data) VALUES (?, ?, ?, ?, ?, ?)',
            [newUserId, '{}', '{}', '', '{}', '{}'] // Store empty JSON objects as strings initially
        );

        // Commit transaction
        await connection.commit();

        console.log(`User registered successfully: ${email} (ID: ${newUserId})`);
        res.status(201).json({ message: "User registered successfully. You can now log in." }); // 201 Created

    } catch (error) {
        console.error("Registration Error:", error);
        // Rollback transaction if started and error occurred
        if (connection) await connection.rollback();
        res.status(500).json({ message: "An internal server error occurred during registration." });
    } finally {
        // Always release the connection back to the pool
        if (connection) connection.release();
    }
});

// --- Login ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        // Find user by email
        const [users] = await connection.query('SELECT id, email, password_hash FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            console.log(`Login attempt failed for email: ${email} (User not found)`);
            return res.status(401).json({ message: "Invalid email or password." }); // Unauthorized
        }

        const user = users[0];

        // Compare provided password with the stored hash
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordMatch) {
            console.log(`Login attempt failed for email: ${email} (Incorrect password)`);
            return res.status(401).json({ message: "Invalid email or password." }); // Unauthorized
        }

        // Generate JWT if password matches
        const jwtPayload = {
            id: user.id,
            email: user.email
        };
        const token = jwt.sign(
            jwtPayload,
            process.env.JWT_SECRET
            //{ expiresIn: '1h' }
        );

        console.log(`User logged in successfully: ${email} (ID: ${user.id})`);
        // Send the token and essential user info back to the client
        res.json({
            message: "Login successful!",
            token: token,
            user: { // Send only necessary non-sensitive info
                id: user.id,
                email: user.email
            }
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "An internal server error occurred during login." });
    } finally {
        if (connection) connection.release();
    }
});

const authenticateToken = require('../middleware/authMiddleware');
router.get('/status', authenticateToken, async (req, res) => {
    let connection;
    try {
         connection = await pool.getConnection();
         // Fetch user details to confirm the user still exists and get fresh data
         const [users] = await connection.query('SELECT id, email FROM users WHERE id = ?', [req.userId]);

         if (users.length === 0) {
             // This case is rare if the token was just verified, but good practice
             console.warn(`Auth Status Check: User ID ${req.userId} from valid token not found in DB.`);
             return res.status(404).json({ message: "User associated with token not found." });
         }
         // User confirmed to exist, token is valid
         res.json({
             isLoggedIn: true,
             user: {
                id: users[0].id,
                email: users[0].email
             }
         });
    } catch (error) {
         console.error("Auth Status Check Error:", error);
         res.status(500).json({ message: "Internal server error checking authentication status." });
    } finally {
         if (connection) connection.release();
    }
});

module.exports = router;