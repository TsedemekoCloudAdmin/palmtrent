const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getMessages,
  sendMessage,
  markRead
} = require('../controllers/chatController');

router.use(protect);

router.get('/bookings/:bookingId/messages', getMessages);
router.post('/bookings/:bookingId/messages', sendMessage);
router.post('/bookings/:bookingId/read', markRead);

module.exports = router;
