const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session support
app.use(session({
    secret: process.env.SESSION_SECRET || 'ticket_tap_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

const authRoutes = require('./routes/authRoutes');
const movieRoutes = require('./routes/movieRoutes');
const showRoutes = require('./routes/showRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const { requireAuth, requireAdmin } = require('./middleware/auth');

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/shows', showRoutes);
app.use('/api/bookings', bookingRoutes);

// Page Route Guards
app.use('/admin', requireAdmin);
app.use('/admin.html', requireAdmin);

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../public')));

// Basic API Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        app: 'Ticket Tap API',
        timestamp: new Date().toISOString()
    });
});

module.exports = app;
