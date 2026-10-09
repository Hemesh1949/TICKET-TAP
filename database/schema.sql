-- ==========================================================
-- Ticket Tap Database Schema (SQLite)
-- Defined according to Section 6 of the SRS
-- ==========================================================

PRAGMA foreign_keys = ON;

-- 1. Users Table (Customer and Admin accounts)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    mobile TEXT NOT NULL,
    password TEXT NOT NULL, -- bcrypt hashed
    role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer', 'admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Movies Table (Now Showing & Upcoming movies)
CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    synopsis TEXT NOT NULL,
    cast TEXT NOT NULL,
    director TEXT NOT NULL,
    duration_mins INTEGER NOT NULL,
    language TEXT NOT NULL,
    genre TEXT NOT NULL,
    certificate TEXT NOT NULL CHECK(certificate IN ('U', 'U/A', 'A', 'R', 'PG-13')),
    rating REAL DEFAULT 0.0 CHECK(rating >= 0.0 AND rating <= 10.0),
    poster_url TEXT NOT NULL,
    banner_url TEXT,
    trailer_url TEXT,
    status TEXT NOT NULL DEFAULT 'now_showing' CHECK(status IN ('now_showing', 'upcoming')),
    release_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Theatres Table
CREATE TABLE IF NOT EXISTS theatres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    location TEXT NOT NULL,
    total_screens INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Screens Table (Each theatre hosts multiple screens)
CREATE TABLE IF NOT EXISTS screens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    theatre_id INTEGER NOT NULL REFERENCES theatres(id) ON DELETE CASCADE,
    screen_number INTEGER NOT NULL,
    screen_name TEXT NOT NULL,
    total_seats INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(theatre_id, screen_number)
);

-- 5. Seats Table (Physical layout per screen with Regular / Premium categories)
CREATE TABLE IF NOT EXISTS seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    screen_id INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    seat_row TEXT NOT NULL,
    seat_number INTEGER NOT NULL,
    category TEXT NOT NULL DEFAULT 'Regular' CHECK(category IN ('Regular', 'Premium')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(screen_id, seat_row, seat_number)
);

-- 6. Shows Table (Movie screenings with date, time, screen, pricing)
CREATE TABLE IF NOT EXISTS shows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    screen_id INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    show_date TEXT NOT NULL, -- Format: YYYY-MM-DD
    show_time TEXT NOT NULL, -- Format: HH:MM (24h)
    base_price_regular REAL NOT NULL DEFAULT 150.00,
    base_price_premium REAL NOT NULL DEFAULT 250.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. ShowSeats Table (Real-time seat status for each show: available, locked, or booked)
CREATE TABLE IF NOT EXISTS show_seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    seat_id INTEGER NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'locked', 'booked')),
    price REAL NOT NULL,
    locked_until DATETIME,
    locked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(show_id, seat_id)
);

-- 8. Coupons Table (Discounts and promotions)
CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed')),
    discount_value REAL NOT NULL,
    min_booking_amount REAL DEFAULT 0.0,
    max_discount REAL,
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Bookings Table (Customer booking transactions)
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_number TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    total_amount REAL NOT NULL,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    final_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'cancelled')),
    coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL,
    qr_code_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. BookingSeats Table (Associates booked seats with a booking)
CREATE TABLE IF NOT EXISTS booking_seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    show_seat_id INTEGER NOT NULL REFERENCES show_seats(id) ON DELETE CASCADE,
    seat_id INTEGER NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
    price REAL NOT NULL
);

-- 11. Payments Table (Simulated payment records)
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('Card', 'UPI', 'Net Banking')),
    transaction_id TEXT UNIQUE NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'success' CHECK(status IN ('success', 'failed', 'refunded')),
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Password Resets Table (Simulated password reset tokens)
CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used INTEGER NOT NULL DEFAULT 0 CHECK(used IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high-performance lookups
CREATE INDEX IF NOT EXISTS idx_movies_status_date ON movies(status, release_date);
CREATE INDEX IF NOT EXISTS idx_shows_movie_date ON shows(movie_id, show_date);
CREATE INDEX IF NOT EXISTS idx_shows_screen_date ON shows(screen_id, show_date);
CREATE INDEX IF NOT EXISTS idx_show_seats_show_status ON show_seats(show_id, status);
CREATE INDEX IF NOT EXISTS idx_show_seats_lock ON show_seats(status, locked_until);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_show ON bookings(show_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);

