// routes/userData.js
const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/authMiddleware'); // Apply middleware to protect routes

const router = express.Router();

// Helper function to safely parse JSON from DB (handles null/undefined/non-strings)
function safeJsonParse(dbValue, defaultValue = {}) {
     if (dbValue === null || dbValue === undefined) return defaultValue;
     if (typeof dbValue === 'object') return dbValue; // Already parsed (MySQL JSON type)
     if (typeof dbValue === 'string') {
         try {
             // Handle empty strings specifically before parsing
             return dbValue.trim() === '' ? defaultValue : JSON.parse(dbValue);
         } catch (e) {
             console.error("JSON parsing error for value:", dbValue, e);
             return defaultValue; // Return default on parsing error
         }
     }
     return defaultValue; // Fallback for unexpected types
}

// --- GET User Profile Data ---
router.get('/profile', authenticateToken, async (req, res) => {
    const userId = req.userId; // User ID comes from the verified token via middleware
    console.log(`Fetching profile data for user ID: ${userId}`);

    let connection;
    try {
        connection = await pool.getConnection();
        const [dataRows] = await connection.query('SELECT * FROM user_data WHERE user_id = ?', [userId]);

        if (dataRows.length === 0) {
            // This indicates a potential issue, as user_data should be created on registration
            console.warn(`No user_data record found for user ID: ${userId}. Returning empty default.`);
            // Return a default structure consistent with what the frontend expects
            return res.json({
                savedProfiles: {},
                savedprofilesparent: {},
                lastVisitedProfile: '',
                virtualProfiles: {},
                virtualProfilesData: {}
            });
        }

        const userData = dataRows[0];

        // Prepare the response object, parsing JSON fields safely
        const profileData = {
            savedProfiles: safeJsonParse(userData.saved_profiles, {}),
            savedprofilesparent: safeJsonParse(userData.saved_profiles_parent, {}),
            lastVisitedProfile: userData.last_visited_profile || '',
            virtualProfiles: safeJsonParse(userData.virtual_profiles, {}),
            virtualProfilesData: safeJsonParse(userData.virtual_profiles_data, {})
        };

        res.json(profileData);

    } catch (error) {
        console.error(`Error fetching profile data for user ${userId}:`, error);
        res.status(500).json({ message: "Internal server error fetching user profile data." });
    } finally {
        if (connection) connection.release();
    }
});

// --- PUT (Update) User Profile Data ---
router.put('/profile', authenticateToken, async (req, res) => {
    const userId = req.userId;
    console.log(`Updating profile data for user ID: ${userId}`);

    // Extract the expected data structure from the request body
    const {
        savedProfiles,
        savedprofilesparent,
        lastVisitedProfile,
        virtualProfiles,
        virtualProfilesData
     } = req.body;

     // Basic validation: Check if required top-level keys exist
     if (savedProfiles === undefined || savedprofilesparent === undefined ||
         lastVisitedProfile === undefined || virtualProfiles === undefined ||
         virtualProfilesData === undefined) {
        console.log(`Update failed for user ${userId}: Missing fields in request body.`);
        return res.status(400).json({ message: "Invalid request body: Missing required user data fields." });
     }

    let connection;
    try {
        connection = await pool.getConnection();

        const savedProfilesStr = JSON.stringify(savedProfiles || {});
        const savedProfilesParentStr = JSON.stringify(savedprofilesparent || {});
        const virtualProfilesStr = JSON.stringify(virtualProfiles || {});
        const virtualProfilesDataStr = JSON.stringify(virtualProfilesData || {});

        // Use INSERT ... ON DUPLICATE KEY UPDATE to handle both initial creation (backup) and updates
        const sql = `
            INSERT INTO user_data (
                user_id, saved_profiles, saved_profiles_parent,
                last_visited_profile, virtual_profiles, virtual_profiles_data
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                saved_profiles = VALUES(saved_profiles),
                saved_profiles_parent = VALUES(saved_profiles_parent),
                last_visited_profile = VALUES(last_visited_profile),
                virtual_profiles = VALUES(virtual_profiles),
                virtual_profiles_data = VALUES(virtual_profiles_data),
                updated_at = CURRENT_TIMESTAMP
        `;

        const values = [
            userId,
            savedProfilesStr,
            savedProfilesParentStr,
            lastVisitedProfile || '', // Ensure empty string, not null, if applicable
            virtualProfilesStr,
            virtualProfilesDataStr
        ];

        const [result] = await connection.query(sql, values);

        if (result.affectedRows > 0 || result.warningStatus === 0) { // Check affected rows or if insert/update occurred
            console.log(`User data updated successfully for user ${userId}.`);
             res.json({ message: "User data updated successfully." });
        } else {
             console.warn(`User data update for user ${userId} resulted in 0 affected rows. Data might be identical.`);
             res.json({ message: "User data updated (or was already up-to-date)." }); // Or potentially a different status code?
        }

    } catch (error) {
        console.error(`Error updating profile data for user ${userId}:`, error);
        res.status(500).json({ message: "Internal server error updating user profile data." });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;