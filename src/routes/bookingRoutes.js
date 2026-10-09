const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { requireAuth, requireCustomer } = require('../middleware/auth');

// Public/Customer summary endpoint
router.get('/summary', bookingController.getCheckoutSummary);

// Apply coupon code (FR-13)
router.post('/apply-coupon', bookingController.applyCoupon);

// Process checkout and simulated payment (FR-14, FR-15, FR-16, FR-17)
router.post('/checkout', requireCustomer, bookingController.processCheckout);

// Get E-ticket & booking by ID or booking number (FR-16, FR-17)
router.get('/:identifier', bookingController.getBookingDetails);

module.exports = router;
