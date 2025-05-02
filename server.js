// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userDataRoutes = require('./routes/userData');

const app = express();
const port = process.env.PORT || 3001;


const corsOptions = {
     origin: '*',
     // origin: 'http://your-frontend-domain.com', // Example for production
     methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
     credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/user', userDataRoutes);

app.get('/', (req, res) => {
    res.send('Navigation App Backend is running!');
});

app.use((req, res, next) => {
     res.status(404).json({ message: `Endpoint not found: ${req.method} ${req.originalUrl}` });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error("Unhandled Server Error:", err.stack || err);
    // Avoid sending detailed stack trace in production
    const statusCode = err.status || 500;
    const message = process.env.NODE_ENV === 'production' ? 'An internal server error occurred.' : (err.message || 'Internal Server Error');
    res.status(statusCode).json({ message });
});

// --- Start the Server ---
app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});