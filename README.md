# 🎟️ Ticket Tap – Movie Ticket Booking Web Application

Ticket Tap is a full-stack movie ticket booking web application built with **Node.js**, **Express**, **SQLite** (`better-sqlite3`), and vanilla **HTML/CSS/JavaScript**.

---

## 📁 Project Structure

```text
TICKET TAP/
├── database/
│   ├── schema.sql           # Database schema definition (Section 6 of SRS)
│   ├── seed.js              # Database seeder with sample movies, theatres, shows, etc.
│   └── ticket_tap.db        # SQLite database file (created on init/seed)
├── public/
│   ├── css/                 # Stylesheets (vanilla CSS)
│   ├── js/                  # Client-side JavaScript
│   └── images/              # Static media assets & posters
├── src/
│   ├── config/
│   │   └── db.js            # SQLite database connection & configuration
│   ├── controllers/         # Request handling & business logic
│   ├── middleware/          # Authentication & validation middleware
│   ├── routes/              # API and page routes
│   ├── utils/               # Helper functions & utilities
│   └── app.js               # Express application configuration
├── .env.example             # Template for environment variables
├── .env                     # Local environment configuration
├── .gitignore               # Git ignored files & directories
├── package.json             # Project dependencies & scripts
├── README.md                # Project documentation & setup instructions
├── server.js                # Main HTTP server entry point
└── SRS.md                   # Software Requirements Specification (IEEE 830)
```

---

## 🗄️ Database Architecture (SRS Section 6)

The application utilizes an SQLite relational database with the following 11 core tables:

1. **`users`**: User accounts with role-based access (`customer`, `admin`) and bcrypt-hashed passwords.
2. **`movies`**: Movies catalog (*Now Showing* and *Upcoming*) with language, genre, synopsis, ratings, and media links.
3. **`theatres`**: Cinema halls with location, city, and screen count.
4. **`screens`**: Individual auditoriums per theatre (e.g. IMAX, Dolby Atmos).
5. **`seats`**: Physical seating layout per screen with category classification (`Regular`, `Premium`).
6. **`shows`**: Movie screenings scheduled by screen, date, and showtime with dynamic tier pricing.
7. **`show_seats`**: Real-time seat status per show (`available`, `locked`, `booked`) supporting atomic 5-minute locking.
8. **`coupons`**: Promotional discount codes (`percentage` or `fixed` value).
9. **`bookings`**: Customer booking records with pricing breakdown, coupon application, and e-ticket QR data.
10. **`booking_seats`**: Mapping of booked seats to specific bookings.
11. **`payments`**: Simulated payment gateway records (`Card`, `UPI`, `Net Banking`).

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (v9 or higher)

### 2. Installation
Clone or navigate to the project directory, then install the dependencies:
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` (already configured with default settings):
```bash
cp .env.example .env
```
Default `.env` configuration:
```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=ticket_tap_secret_key_2026
DB_PATH=./database/ticket_tap.db
```

### 4. Initialize and Seed the Database
Populate the SQLite database with sample data (12 movies, 3 theatres with 9 screens, 450 seats, 24 shows, coupons, and test accounts):
```bash
npm run seed
```

### 5. Start the Server

#### Development Mode (with file watcher):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

Open your browser and navigate to:
```text
http://localhost:3000
```
API health check endpoint:
```text
http://localhost:3000/api/health
```

---

## 👥 Sample Seed Accounts

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@tickettap.com` | `Admin@123` |
| **Customer** | `john.doe@example.com` | `User@123` |
| **Customer** | `priya.sharma@example.com` | `User@123` |
| **Customer** | `alex.kumar@example.com` | `User@123` |

### Sample Coupons:
- `WELCOME50` – 50% discount up to ₹100 (min spend ₹200)
- `TAP10` – 10% discount up to ₹50 (min spend ₹150)
- `FLAT100` – ₹100 flat discount (min spend ₹400)
- `BLOCKBUSTER` – 20% discount up to ₹150 (min spend ₹300)

---

- `npm start`: Starts the Express server.
- `npm run dev`: Starts the Express server with `--watch` mode for automatic reloads.
- `npm run seed`: Initializes the SQLite schema and seeds the sample dataset.
- `npm run db:reset`: Cleans and re-seeds the SQLite database.
- `npm test`: Runs the automated test suite for authentication and access control (FR-1, FR-2, FR-3).

---

## 🔐 Implemented Features (FR-1 to FR-3)

- **FR-1: User Registration (`/register.html`)**
  - Full name, unique email validation, 10-digit mobile validation, and bcrypt password hashing (min 6 characters).
  - Live password strength calculation and matching validation.
  - Automatic session creation upon registration.
- **FR-2: Login & Role-Based Access (`/login.html`, `/admin.html`)**
  - Session-based authentication with bcrypt password verification.
  - Role-based middleware (`requireAuth`, `requireCustomer`, `requireAdmin`).
  - Booking flows restricted to customers and administrative pages restricted to admins.
  - One-click demo login buttons for quick testing.
- **FR-3: Password Reset (`/forgot-password.html`, `/reset-password.html`)**
  - Simulated email notification sandbox preview.
  - Cryptographically secure 64-character reset token with 15-minute expiration stored in `password_resets` table.
  - Token verification and real-time password update.

- **FR-4: Movie Browsing & Catalog (`/index.html` or `/`)**
  - Displays *Now Showing* and *Upcoming* movie catalogs with high-res posters, IMDb rating badges, certificates (U, U/A, A), audio languages, genres, and durations.
  - Interactive status switcher tabs with live title counts.

- **FR-5: Live Search & Multi-Filters (`/index.html`)**
  - Real-time search by movie title, starring cast, or director with debounce.
  - Dropdown filter by audio language (English, Tamil, Telugu, Hindi, Kannada, Malayalam).
  - Dropdown filter by genre (Action, Sci-Fi, Drama, Thriller, Adventure, etc.).
  - Scrollable date chip filters for movies with active screenings on selected dates.
  - 1-click "Reset Filters" action.

- **FR-6: Movie Details & Show Selection (`/movie.html?id=:id`)**
  - Hero banner with poster, synopsis, starring cast, director, duration, and certificate.
  - Embedded official trailer modal player with YouTube playback.
  - Multi-day date selector bar with screenings grouped by cinema theatre and screen formats (e.g. IMAX 3D, Dolby Atmos, Gold Class).
  - Showtime buttons with tier pricing details.

- **FR-7: Shows by Movie & Date Listing (`/movie.html`)**
  - Displays cinema complexes with location, screen formats, and available showtimes for chosen dates.

- **FR-8 & FR-11: Seating Layout & Tiered Pricing (`/booking.html?showId=:id`)**
  - Interactive cinema seating layout with curved screen graphic and standard color codes:
    - 🟢 **Green**: Available seats
    - 🔵 **Blue**: Selected seats
    - ⚪/⬛ **Grey**: Booked or locked seats
  - Category classification with distinct pricing: 👑 **Premium Class** (front/VIP rows) and 🎟️ **Regular Class**.
  - Enforces a strict cap of up to 6 seats per transaction.

- **FR-9 & FR-10: 5-Minute Seat Hold & Atomic Concurrency Protection (`/api/shows/:id/lock`)**
  - Only authenticated customer accounts can lock seats.
  - Locks selected seats atomically for 5 minutes with a live countdown timer.
  - Automatic expiration & release of held seats if checkout is not completed within 5 minutes.
  - SQLite database transactions prevent race conditions and guarantee zero double-bookings.

- **FR-12 & FR-13: Order Summary & Coupon Discounts (`/payment.html`)**
  - Detailed summary of movie, cinema, show timing, seats breakdown, 18% GST tax, and total.
  - Interactive coupon validation supporting percentage (e.g. `WELCOME50`, `TAP10`, `BLOCKBUSTER`) and fixed discounts (`FLAT100`) with minimum spend and discount caps.

- **FR-14 & FR-15: Simulated Payment Gateway (`/payment.html`)**
  - Simulated payment modes: Card, UPI, and Net Banking.
  - 1-Click Sandbox Simulation:
    - 🟢 **Simulate Success**: Atomically confirms booking, marks seats as `booked`, generates e-ticket reference, and creates payment ledger entry.
    - 🔴 **Simulate Failure**: Handles transaction decline, immediately releases held seats back to the cinema inventory, and offers a retry flow.

- **FR-16 & FR-17: E-Ticket Generation & PDF Download (`/ticket.html?bookingId=:id`)**
  - Cinema e-ticket with authentic notch cutouts, booking reference number, cinema hall, show details, seat labels, and transaction information.
  - High-res embedded QR code generated for entry verification.
  - 📥 **Download Ticket (PDF / Print)**: Formatted print stylesheet (`@media print`) for clean ticket printing or saving as PDF.
  - Console-logged simulated confirmation email notifications.




