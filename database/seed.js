const bcrypt = require('bcryptjs');
const { db, initSchema } = require('../src/config/db');

function seedDatabase() {
    console.log('🔄 Initializing database schema...');
    initSchema();

    console.log('🧹 Clearing existing data...');
    // Clear existing data in reverse foreign key order
    const tables = [
        'password_resets',
        'payments',
        'booking_seats',
        'bookings',
        'coupons',
        'show_seats',
        'shows',
        'seats',
        'screens',
        'theatres',
        'movies',
        'users'
    ];

    db.exec('PRAGMA foreign_keys = OFF;');
    for (const table of tables) {
        db.exec(`DELETE FROM ${table};`);
        db.exec(`DELETE FROM sqlite_sequence WHERE name='${table}';`);
    }
    db.exec('PRAGMA foreign_keys = ON;');

    console.log('🌱 Seeding users...');
    const salt = bcrypt.genSaltSync(10);
    const adminPassword = bcrypt.hashSync('Admin@123', salt);
    const userPassword = bcrypt.hashSync('User@123', salt);

    const insertUser = db.prepare(`
        INSERT INTO users (name, email, mobile, password, role)
        VALUES (?, ?, ?, ?, ?)
    `);

    insertUser.run('Admin User', 'admin@tickettap.com', '9876543210', adminPassword, 'admin');
    insertUser.run('John Doe', 'john.doe@example.com', '9876543211', userPassword, 'customer');
    insertUser.run('Priya Sharma', 'priya.sharma@example.com', '9876543212', userPassword, 'customer');
    insertUser.run('Alex Kumar', 'alex.kumar@example.com', '9876543213', userPassword, 'customer');

    console.log('🌱 Seeding movies (12 titles - Now Showing & Upcoming)...');
    const insertMovie = db.prepare(`
        INSERT INTO movies (
            title, synopsis, cast, director, duration_mins, language, genre,
            certificate, rating, poster_url, banner_url, trailer_url, status, release_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const moviesData = [
        {
            title: 'Interstellar: Beyond Time',
            synopsis: 'When Earth becomes uninhabitable in the future, a farmer and ex-NASA pilot, Joseph Cooper, is tasked to pilot a spacecraft along with a team of researchers to find a new planet for humans.',
            cast: 'Matthew McConaughey, Anne Hathaway, Jessica Chastain',
            director: 'Christopher Nolan',
            duration_mins: 169,
            language: 'English',
            genre: 'Sci-Fi / Adventure / Drama',
            certificate: 'U/A',
            rating: 8.9,
            poster_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&q=80',
            banner_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80',
            trailer_url: 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
            status: 'now_showing',
            release_date: '2026-01-15'
        },
        {
            title: 'The Dark Knight: Legacy',
            synopsis: 'When a menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.',
            cast: 'Christian Bale, Heath Ledger, Aaron Eckhart',
            director: 'Christopher Nolan',
            duration_mins: 152,
            language: 'English',
            genre: 'Action / Crime / Drama',
            certificate: 'U/A',
            rating: 9.0,
            poster_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&q=80',
            banner_url: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=1200&q=80',
            trailer_url: 'https://www.youtube.com/watch?v=EXeTwQWrcwY',
            status: 'now_showing',
            release_date: '2026-02-01'
        },
        {
            title: 'Dune: Part Two',
            synopsis: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.',
            cast: 'Timothée Chalamet, Zendaya, Rebecca Ferguson',
            director: 'Denis Villeneuve',
            duration_mins: 166,
            language: 'English',
            genre: 'Sci-Fi / Adventure',
            certificate: 'U/A',
            rating: 8.7,
            poster_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&q=80',
            banner_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&q=80',
            trailer_url: 'https://www.youtube.com/watch?v=Way9Dexny3w',
            status: 'now_showing',
            release_date: '2026-02-14'
        },
        {
            title: 'Leo: Bloody Sweet',
            synopsis: 'A mild-mannered cafe owner becomes a local hero through an act of violence, triggering repercussions with a dangerous drug cartel.',
            cast: 'Vijay, Trisha Krishnan, Sanjay Dutt',
            director: 'Lokesh Kanagaraj',
            duration_mins: 164,
            language: 'Tamil',
            genre: 'Action / Thriller / Crime',
            certificate: 'A',
            rating: 8.4,
            poster_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&q=80',
            banner_url: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&q=80',
            trailer_url: 'https://www.youtube.com/watch?v=Po3jStA650E',
            status: 'now_showing',
            release_date: '2026-02-20'
        },
        {
            title: 'Kantara: A Legend Returns',
            synopsis: 'A tale of human spirit, divine folklore, and the bond between humanity and nature set against the mystical forests of coastal Karnataka.',
            cast: 'Rishab Shetty, Sapthami Gowda, Kishore',
            director: 'Rishab Shetty',
            duration_mins: 155,
            language: 'Kannada',
            genre: 'Mythological / Action / Drama',
            certificate: 'U/A',
            rating: 9.1,
            poster_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80',
            banner_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=80',
            trailer_url: 'https://www.youtube.com/watch?v=8mrVmf24_dI',
            status: 'now_showing',
            release_date: '2026-03-01'
        },
        {
            title: 'Jawan: Final Stand',
            synopsis: 'A high-octane emotional action thriller outlining the journey of a man who is set out to rectify the wrongs in society.',
            cast: 'Shah Rukh Khan, Nayanthara, Vijay Sethupathi',
            director: 'Atlee',
            duration_mins: 169,
            language: 'Hindi',
            genre: 'Action / Drama / Thriller',
            certificate: 'U/A',
            rating: 8.2,
            poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&q=80',
            banner_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&q=80',
            trailer_url: 'https://www.youtube.com/watch?v=MWOlnZSnXWE',
            status: 'now_showing',
            release_date: '2026-03-05'
        },
        {
            title: 'Oppenheimer',
            synopsis: 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb during World War II.',
            cast: 'Cillian Murphy, Emily Blunt, Matt Damon, Robert Downey Jr.',
            director: 'Christopher Nolan',
            duration_mins: 180,
            language: 'English',
            genre: 'Biography / Drama / History',
            certificate: 'A',
            rating: 8.9,
            poster_url: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=600&q=80',
            banner_url: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=1200&q=80',
            trailer_url: 'https://www.youtube.com/watch?v=uYPbbksJxIg',
            status: 'now_showing',
            release_date: '2026-03-10'
        },
        {
            title: 'Manjummel Boys',
            synopsis: 'A group of friends from a small town embark on a vacation to Kodaikanal, where an unexpected mishap tests their courage and brotherhood.',
            cast: 'Soubin Shahir, Sreenath Bhasi, Balu Varghese',
            director: 'Chidambaram',
            duration_mins: 135,
            language: 'Malayalam',
            genre: 'Adventure / Thriller / Drama',
            certificate: 'U',
            rating: 8.6,
            poster_url: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600&q=80',
            banner_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80',
            trailer_url: 'https://www.youtube.com/watch?v=gar6gJ1GvD8',
            status: 'now_showing',
            release_date: '2026-03-15'
        },
        {
            title: 'Salaar: Part 1 - Ceasefire',
            synopsis: 'A gang leader makes a promise to a dying friend and takes on other criminal gangs in the lawless city-state of Khansaar.',
            cast: 'Prabhas, Prithviraj Sukumaran, Shruti Haasan',
            director: 'Prashanth Neel',
            duration_mins: 175,
            language: 'Telugu',
            genre: 'Action / Crime / Drama',
            certificate: 'A',
            rating: 8.0,
            poster_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&q=80',
            banner_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&q=80',
            trailer_url: 'https://www.youtube.com/watch?v=4GPvYMKtrtI',
            status: 'now_showing',
            release_date: '2026-03-20'
        },
        {
            title: 'Spider-Man: Beyond the Spider-Verse',
            synopsis: 'Miles Morales traverses the multiverse to protect the fabric of reality itself alongside Gwen Stacy and an elite squad of Spider-Heroes.',
            cast: 'Shameik Moore, Hailee Steinfeld, Oscar Isaac',
            director: 'Joaquim Dos Santos, Kemp Powers',
            duration_mins: 140,
            language: 'English',
            genre: 'Animation / Action / Sci-Fi',
            certificate: 'U',
            rating: 9.3,
            poster_url: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=600&q=80',
            banner_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&q=80',
            trailer_url: 'https://www.youtube.com/watch?v=cqGjhVJWtEg',
            status: 'upcoming',
            release_date: '2026-11-20'
        },
        {
            title: 'Avatar: Fire and Ash',
            synopsis: 'Jake Sully and Neytiri encounter a hostile volcanic clan of Na\'vi known as the Ash People on the breathtaking moon of Pandora.',
            cast: 'Sam Worthington, Zoe Saldaña, Sigourney Weaver',
            director: 'James Cameron',
            duration_mins: 192,
            language: 'English',
            genre: 'Sci-Fi / Adventure / Fantasy',
            certificate: 'U/A',
            rating: 8.8,
            poster_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80',
            banner_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=80',
            trailer_url: 'https://www.youtube.com/watch?v=d9MyW72ELq0',
            status: 'upcoming',
            release_date: '2026-12-18'
        },
        {
            title: 'The Matrix: Reborn',
            synopsis: 'Return to a world of two realities: one, everyday life; the other, what lies behind it. Neo must choose to follow the white rabbit once more.',
            cast: 'Keanu Reeves, Carrie-Anne Moss, Yahya Abdul-Mateen II',
            director: 'Lana Wachowski',
            duration_mins: 148,
            language: 'English',
            genre: 'Sci-Fi / Action',
            certificate: 'U/A',
            rating: 8.1,
            poster_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&q=80',
            banner_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80',
            trailer_url: 'https://www.youtube.com/watch?v=9ix7TUGVYIo',
            status: 'upcoming',
            release_date: '2026-12-25'
        }
    ];

    for (const m of moviesData) {
        insertMovie.run(
            m.title, m.synopsis, m.cast, m.director, m.duration_mins,
            m.language, m.genre, m.certificate, m.rating,
            m.poster_url, m.banner_url, m.trailer_url, m.status, m.release_date
        );
    }

    console.log('🌱 Seeding theatres, screens, and physical seats...');
    const insertTheatre = db.prepare(`
        INSERT INTO theatres (name, city, location, total_screens)
        VALUES (?, ?, ?, ?)
    `);

    const insertScreen = db.prepare(`
        INSERT INTO screens (theatre_id, screen_number, screen_name, total_seats)
        VALUES (?, ?, ?, ?)
    `);

    const insertSeat = db.prepare(`
        INSERT INTO seats (screen_id, seat_row, seat_number, category)
        VALUES (?, ?, ?, ?)
    `);

    const theatresData = [
        {
            name: 'PVR ICON: Infinity Mall',
            city: 'Mumbai',
            location: 'Link Road, Andheri West, Mumbai',
            screens: [
                { number: 1, name: 'Audi 1 (IMAX 3D)', rows: ['A', 'B', 'C', 'D', 'E', 'F'], seatsPerRow: 10, premiumRows: ['A', 'B'] },
                { number: 2, name: 'Audi 2 (Dolby Atmos)', rows: ['A', 'B', 'C', 'D', 'E'], seatsPerRow: 10, premiumRows: ['A', 'B'] },
                { number: 3, name: 'Audi 3 (Gold Class VIP)', rows: ['A', 'B', 'C', 'D'], seatsPerRow: 8, premiumRows: ['A', 'B', 'C', 'D'] }
            ]
        },
        {
            name: 'INOX Megaplex: Forum Mall',
            city: 'Bengaluru',
            location: 'Hosur Road, Koramangala, Bengaluru',
            screens: [
                { number: 1, name: 'Screen 1 (Laser 4K)', rows: ['A', 'B', 'C', 'D', 'E', 'F'], seatsPerRow: 10, premiumRows: ['A', 'B'] },
                { number: 2, name: 'Screen 2 (Insignia Luxe)', rows: ['A', 'B', 'C', 'D', 'E'], seatsPerRow: 8, premiumRows: ['A', 'B'] },
                { number: 3, name: 'Screen 3 (MX4D Experience)', rows: ['A', 'B', 'C', 'D', 'E'], seatsPerRow: 10, premiumRows: ['A', 'B'] }
            ]
        },
        {
            name: 'SPI Cinemas: Palazzo',
            city: 'Chennai',
            location: 'Nexus Vijaya Mall, Vadapalani, Chennai',
            screens: [
                { number: 1, name: 'Palazzo Grand (Dolby Atmos)', rows: ['A', 'B', 'C', 'D', 'E', 'F'], seatsPerRow: 10, premiumRows: ['A', 'B'] },
                { number: 2, name: 'Escape Studio', rows: ['A', 'B', 'C', 'D', 'E'], seatsPerRow: 10, premiumRows: ['A', 'B'] },
                { number: 3, name: 'Symphony Laser', rows: ['A', 'B', 'C', 'D', 'E', 'F'], seatsPerRow: 8, premiumRows: ['A', 'B'] }
            ]
        }
    ];

    const screenMap = []; // Stores generated screen ids with their seat list

    for (const t of theatresData) {
        const theatreRes = insertTheatre.run(t.name, t.city, t.location, t.screens.length);
        const theatreId = theatreRes.lastInsertRowid;

        for (const s of t.screens) {
            const totalSeats = s.rows.length * s.seatsPerRow;
            const screenRes = insertScreen.run(theatreId, s.number, s.name, totalSeats);
            const screenId = screenRes.lastInsertRowid;

            const screenSeats = [];
            for (const row of s.rows) {
                const category = s.premiumRows.includes(row) ? 'Premium' : 'Regular';
                for (let num = 1; num <= s.seatsPerRow; num++) {
                    const seatRes = insertSeat.run(screenId, row, num, category);
                    screenSeats.push({
                        id: seatRes.lastInsertRowid,
                        row,
                        number: num,
                        category
                    });
                }
            }

            screenMap.push({
                screenId,
                theatreId,
                screenName: s.name,
                seats: screenSeats
            });
        }
    }

    console.log('🌱 Seeding shows (24 shows across now showing movies)...');
    const insertShow = db.prepare(`
        INSERT INTO shows (
            movie_id, screen_id, show_date, show_time, base_price_regular, base_price_premium
        ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertShowSeat = db.prepare(`
        INSERT INTO show_seats (show_id, seat_id, status, price)
        VALUES (?, ?, ?, ?)
    `);

    // Helper to format dates YYYY-MM-DD
    const today = new Date();
    const getDateStr = (offsetDays) => {
        const d = new Date(today);
        d.setDate(d.getDate() + offsetDays);
        return d.toISOString().split('T')[0];
    };

    const dateToday = getDateStr(0);
    const dateTomorrow = getDateStr(1);
    const dateDayAfter = getDateStr(2);

    // List of 24 shows covering different movies, screens, dates, and times
    const showsData = [
        // Day 1 (Today)
        { movieId: 1, screenIdx: 0, date: dateToday, time: '10:00', regPrice: 200, premPrice: 350 },
        { movieId: 1, screenIdx: 0, date: dateToday, time: '14:30', regPrice: 220, premPrice: 380 },
        { movieId: 1, screenIdx: 0, date: dateToday, time: '19:00', regPrice: 250, premPrice: 420 },
        { movieId: 2, screenIdx: 1, date: dateToday, time: '11:15', regPrice: 180, premPrice: 300 },
        { movieId: 2, screenIdx: 1, date: dateToday, time: '16:00', regPrice: 200, premPrice: 320 },
        { movieId: 3, screenIdx: 2, date: dateToday, time: '13:00', regPrice: 350, premPrice: 500 },
        { movieId: 3, screenIdx: 2, date: dateToday, time: '18:15', regPrice: 380, premPrice: 550 },
        { movieId: 4, screenIdx: 3, date: dateToday, time: '10:30', regPrice: 190, premPrice: 320 },
        { movieId: 4, screenIdx: 3, date: dateToday, time: '15:45', regPrice: 210, premPrice: 350 },
        { movieId: 5, screenIdx: 4, date: dateToday, time: '12:00', regPrice: 220, premPrice: 360 },
        { movieId: 6, screenIdx: 5, date: dateToday, time: '14:00', regPrice: 200, premPrice: 340 },
        { movieId: 7, screenIdx: 6, date: dateToday, time: '18:30', regPrice: 240, premPrice: 400 },

        // Day 2 (Tomorrow)
        { movieId: 1, screenIdx: 0, date: dateTomorrow, time: '10:30', regPrice: 200, premPrice: 350 },
        { movieId: 2, screenIdx: 1, date: dateTomorrow, time: '15:00', regPrice: 180, premPrice: 300 },
        { movieId: 3, screenIdx: 2, date: dateTomorrow, time: '19:30', regPrice: 380, premPrice: 550 },
        { movieId: 4, screenIdx: 3, date: dateTomorrow, time: '11:00', regPrice: 190, premPrice: 320 },
        { movieId: 5, screenIdx: 4, date: dateTomorrow, time: '16:30', regPrice: 220, premPrice: 360 },
        { movieId: 6, screenIdx: 5, date: dateTomorrow, time: '20:00', regPrice: 200, premPrice: 340 },
        { movieId: 8, screenIdx: 6, date: dateTomorrow, time: '13:15', regPrice: 170, premPrice: 280 },
        { movieId: 9, screenIdx: 7, date: dateTomorrow, time: '17:45', regPrice: 210, premPrice: 350 },

        // Day 3 (Day After Tomorrow)
        { movieId: 1, screenIdx: 0, date: dateDayAfter, time: '18:00', regPrice: 250, premPrice: 420 },
        { movieId: 3, screenIdx: 2, date: dateDayAfter, time: '14:00', regPrice: 350, premPrice: 500 },
        { movieId: 7, screenIdx: 6, date: dateDayAfter, time: '19:15', regPrice: 240, premPrice: 400 },
        { movieId: 8, screenIdx: 8, date: dateDayAfter, time: '21:00', regPrice: 180, premPrice: 300 }
    ];

    const showIds = [];

    for (const sh of showsData) {
        const screenObj = screenMap[sh.screenIdx % screenMap.length];
        const showRes = insertShow.run(
            sh.movieId,
            screenObj.screenId,
            sh.date,
            sh.time,
            sh.regPrice,
            sh.premPrice
        );
        const showId = showRes.lastInsertRowid;
        showIds.push({ showId, screenObj, regPrice: sh.regPrice, premPrice: sh.premPrice });

        // Generate ShowSeats for this show
        for (const seat of screenObj.seats) {
            const price = seat.category === 'Premium' ? sh.premPrice : sh.regPrice;
            insertShowSeat.run(showId, seat.id, 'available', price);
        }
    }

    console.log('🌱 Seeding coupons...');
    const insertCoupon = db.prepare(`
        INSERT INTO coupons (
            code, discount_type, discount_value, min_booking_amount, max_discount,
            valid_from, valid_until, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertCoupon.run('WELCOME50', 'percentage', 50, 200, 100, '2026-01-01', '2026-12-31', 1);
    insertCoupon.run('TAP10', 'percentage', 10, 150, 50, '2026-01-01', '2026-12-31', 1);
    insertCoupon.run('FLAT100', 'fixed', 100, 400, 100, '2026-01-01', '2026-12-31', 1);
    insertCoupon.run('BLOCKBUSTER', 'percentage', 20, 300, 150, '2026-01-01', '2026-12-31', 1);

    console.log('🌱 Seeding sample booking, booked seats, and payment for testing...');
    // Seed a sample booking for John Doe (user_id = 2) on Show 1
    const firstShow = showIds[0];
    const seatsToBook = firstShow.screenObj.seats.slice(0, 2); // Book 2 seats (e.g. A1, A2)

    // Mark show_seats as booked
    const updateShowSeat = db.prepare(`
        UPDATE show_seats SET status = 'booked' WHERE show_id = ? AND seat_id = ?
    `);
    const getShowSeat = db.prepare(`
        SELECT id, price FROM show_seats WHERE show_id = ? AND seat_id = ?
    `);

    let totalAmount = 0;
    const bookedSeatDetails = [];

    for (const s of seatsToBook) {
        updateShowSeat.run(firstShow.showId, s.id);
        const ss = getShowSeat.get(firstShow.showId, s.id);
        totalAmount += ss.price;
        bookedSeatDetails.push({ showSeatId: ss.id, seatId: s.id, price: ss.price });
    }

    const discountAmount = 50.0;
    const taxAmount = Number(((totalAmount - discountAmount) * 0.18).toFixed(2));
    const finalAmount = totalAmount - discountAmount + taxAmount;
    const bookingNumber = 'TT-20261008-7A8B';

    const insertBooking = db.prepare(`
        INSERT INTO bookings (
            booking_number, user_id, show_id, total_amount, discount_amount,
            tax_amount, final_amount, status, coupon_id, qr_code_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const bookingRes = insertBooking.run(
        bookingNumber,
        2, // John Doe
        firstShow.showId,
        totalAmount,
        discountAmount,
        taxAmount,
        finalAmount,
        'confirmed',
        1, // WELCOME50
        JSON.stringify({ bookingNumber, seats: ['A1', 'A2'], showId: firstShow.showId })
    );

    const bookingId = bookingRes.lastInsertRowid;

    const insertBookingSeat = db.prepare(`
        INSERT INTO booking_seats (booking_id, show_seat_id, seat_id, price)
        VALUES (?, ?, ?, ?)
    `);

    for (const bsd of bookedSeatDetails) {
        insertBookingSeat.run(bookingId, bsd.showSeatId, bsd.seatId, bsd.price);
    }

    const insertPayment = db.prepare(`
        INSERT INTO payments (
            booking_id, user_id, payment_method, transaction_id, amount, status
        ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertPayment.run(
        bookingId,
        2,
        'UPI',
        'TXN_UPI_9823478912',
        finalAmount,
        'success'
    );

    console.log('✅ Database successfully seeded!');
    console.log(`📊 Summary:`);
    console.log(`   - Users: 4 (1 Admin, 3 Customers)`);
    console.log(`   - Movies: ${moviesData.length} (Now Showing & Upcoming)`);
    console.log(`   - Theatres: ${theatresData.length}`);
    console.log(`   - Screens: ${screenMap.length}`);
    console.log(`   - Shows: ${showsData.length}`);
    console.log(`   - Coupons: 4`);
    console.log(`   - Sample Booking: 1 (with payment & booked seats)`);
}

// Run seeder if executed directly
if (require.main === module) {
    seedDatabase();
}

module.exports = seedDatabase;
