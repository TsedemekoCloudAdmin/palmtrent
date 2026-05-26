const express = require('express');
const router = express.Router();
const {
  createTicket,
  getMyTickets,
  getTicket,
  addReply,
  updateTicket
} = require('../controllers/supportController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/tickets', createTicket);
router.get('/tickets', getMyTickets);
router.get('/tickets/:id', getTicket);
router.post('/tickets/:id/replies', addReply);
router.put('/tickets/:id', updateTicket);

module.exports = router;
