// db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10, // Adjust as needed
    queueLimit: 0
});

// Optional: Test connection on startup
pool.getConnection()
    .then(connection => {
        console.log('Successfully connected to the MySQL database.');
        connection.release(); // Release the connection back to the pool
    })
    .catch(err => {
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('!!! Error connecting to the MySQL database !!!');
        console.error('!!! Please check your .env file settings   !!!');
        console.error('!!! and ensure MySQL server is running.    !!!');
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('Error Details:', err.message);
        process.exit(1); // Exit if DB connection fails fatally
    });

module.exports = pool;