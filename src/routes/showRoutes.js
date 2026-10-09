const express = require('express');
const router = express.Router();
const showController = require('../controllers/showController');
const { requireAuth, requireCustomer } = require('../middleware/auth');

// Show seat layout and info
router.get('/:showId', showController.getShowSeatLayout);

// Live seat status polling
router.get('/:showId/status', showController.getLiveSeatStatus);

// Lock seats (Customer only - FR-9, FR-10)
router.post('/:showId/lock', requireCustomer, showController.lockSeats);

// Release locked seats
router.post('/:showId/release', requireCustomer, showController.releaseSeats);

module.exports = router;
