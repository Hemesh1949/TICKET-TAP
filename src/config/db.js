const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database/ticket_tap.db');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite database instance
const db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? null : null
});

// Configure database pragmas for data integrity and speed
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
}

module.exports = {
    db,
    initSchema,
    dbPath
};
