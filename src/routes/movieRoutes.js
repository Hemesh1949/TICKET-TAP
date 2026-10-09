const express = require('express');
const router = express.Router();
const movieController = require('../controllers/movieController');

// Movies Public API endpoints
router.get('/filters', movieController.getFilterOptions);
router.get('/', movieController.getMovies);
router.get('/:id', movieController.getMovieDetails);

module.exports = router;
