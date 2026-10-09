const { db } = require('../config/db');

// 1. Get list of movies with search and filters (FR-4, FR-5)
exports.getMovies = (req, res) => {
    try {
        const { status, search, language, genre, date, sort } = req.query;

        let query = `
            SELECT DISTINCT 
                m.id, m.title, m.synopsis, m.cast, m.director, m.duration_mins,
                m.language, m.genre, m.certificate, m.rating, m.poster_url,
                m.banner_url, m.trailer_url, m.status, m.release_date
            FROM movies m
        `;

        const params = [];
        const conditions = [];

        // Filter by show date
        if (date) {
            query += ` JOIN shows s ON s.movie_id = m.id AND s.show_date = ? `;
            params.push(date);
        }

        // Filter by Status (now_showing / upcoming)
        if (status && status !== 'all') {
            conditions.push('m.status = ?');
            params.push(status);
        }

        // Search by Title, Cast, or Director
        if (search && search.trim() !== '') {
            conditions.push('(LOWER(m.title) LIKE ? OR LOWER(m.cast) LIKE ? OR LOWER(m.director) LIKE ?)');
            const searchPattern = `%${search.trim().toLowerCase()}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        // Filter by Language
        if (language && language !== 'all') {
            conditions.push('LOWER(m.language) = LOWER(?)');
            params.push(language);
        }

        // Filter by Genre
        if (genre && genre !== 'all') {
            conditions.push('LOWER(m.genre) LIKE LOWER(?)');
            params.push(`%${genre}%`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        // Sorting
        if (sort === 'release_date') {
            query += ' ORDER BY m.release_date DESC';
        } else if (sort === 'title') {
            query += ' ORDER BY m.title ASC';
        } else {
            query += ' ORDER BY m.rating DESC, m.release_date DESC';
        }

        const stmt = db.prepare(query);
        const movies = stmt.all(...params);

        return res.json({
            success: true,
            count: movies.length,
            movies
        });

    } catch (error) {
        console.error('Error fetching movies:', error);
        return res.status(500).json({ error: 'Failed to fetch movies.' });
    }
};

// 2. Get distinct filter options (languages, genres, show dates)
exports.getFilterOptions = (req, res) => {
    try {
        // Distinct Languages
        const langRows = db.prepare('SELECT DISTINCT language FROM movies WHERE language IS NOT NULL ORDER BY language').all();
        const languages = langRows.map(r => r.language);

        // All Genres
        const genreRows = db.prepare('SELECT genre FROM movies WHERE genre IS NOT NULL').all();
        const genreSet = new Set();
        genreRows.forEach(r => {
            r.genre.split(/[\/,]/).forEach(g => {
                const trimmed = g.trim();
                if (trimmed) genreSet.add(trimmed);
            });
        });
        const genres = Array.from(genreSet).sort();

        // Distinct available upcoming show dates
        const dateRows = db.prepare(`
            SELECT DISTINCT show_date 
            FROM shows 
            WHERE show_date >= date('now') 
            ORDER BY show_date ASC 
            LIMIT 7
        `).all();
        const dates = dateRows.map(r => r.show_date);

        return res.json({
            success: true,
            languages,
            genres,
            dates
        });

    } catch (error) {
        console.error('Error fetching filter options:', error);
        return res.status(500).json({ error: 'Failed to fetch filter options.' });
    }
};

// 3. Get single movie details with available shows and timings (FR-6)
exports.getMovieDetails = (req, res) => {
    try {
        const { id } = req.params;

        const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(id);

        if (!movie) {
            return res.status(404).json({ error: 'Movie not found.' });
        }

        // Available dates with shows for this movie
        const dateRows = db.prepare(`
            SELECT DISTINCT show_date
            FROM shows
            WHERE movie_id = ? AND show_date >= date('now')
            ORDER BY show_date ASC
        `).all(id);
        const availableDates = dateRows.map(r => r.show_date);

        // Fetch all upcoming shows for this movie
        const showRows = db.prepare(`
            SELECT 
                s.id AS show_id,
                s.show_date,
                s.show_time,
                s.base_price_regular,
                s.base_price_premium,
                sc.id AS screen_id,
                sc.screen_number,
                sc.screen_name,
                sc.total_seats,
                t.id AS theatre_id,
                t.name AS theatre_name,
                t.city AS theatre_city,
                t.location AS theatre_location
            FROM shows s
            JOIN screens sc ON s.screen_id = sc.id
            JOIN theatres t ON sc.theatre_id = t.id
            WHERE s.movie_id = ? AND s.show_date >= date('now')
            ORDER BY s.show_date ASC, t.name ASC, s.show_time ASC
        `).all(id);

        // Group shows by Date -> Theatre
        const showsByDate = {};
        for (const show of showRows) {
            if (!showsByDate[show.show_date]) {
                showsByDate[show.show_date] = {};
            }
            if (!showsByDate[show.show_date][show.theatre_id]) {
                showsByDate[show.show_date][show.theatre_id] = {
                    theatre_id: show.theatre_id,
                    theatre_name: show.theatre_name,
                    theatre_city: show.theatre_city,
                    theatre_location: show.theatre_location,
                    shows: []
                };
            }
            showsByDate[show.show_date][show.theatre_id].shows.push({
                show_id: show.show_id,
                screen_id: show.screen_id,
                screen_name: show.screen_name,
                show_time: show.show_time,
                base_price_regular: show.base_price_regular,
                base_price_premium: show.base_price_premium
            });
        }

        return res.json({
            success: true,
            movie,
            availableDates,
            showsByDate
        });

    } catch (error) {
        console.error('Error fetching movie details:', error);
        return res.status(500).json({ error: 'Failed to fetch movie details.' });
    }
};
