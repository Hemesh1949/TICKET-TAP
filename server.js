require('dotenv').config();
const app = require('./src/app');
const { initSchema } = require('./src/config/db');

const PORT = process.env.PORT || 3000;

// Initialize database schema if not present
try {
    initSchema();
    console.log('✅ SQLite Database schema verified.');
} catch (error) {
    console.error('❌ Failed to initialize database schema:', error);
}

// Start Server
app.listen(PORT, () => {
    console.log(`🎬 Ticket Tap Server is running on http://localhost:${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});
