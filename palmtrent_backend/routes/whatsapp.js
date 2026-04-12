// routes/whatsapp.js
// WhatsApp Business API Routes

const express = require('express');
const router = express.Router();
const {
  verifyWebhook,
  handleWebhook
} = require('../controllers/whatsappController');

// GET /api/v1/whatsapp/webhook - Verify webhook (Facebook verification)
router.get('/webhook', verifyWebhook);

// POST /api/v1/whatsapp/webhook - Handle incoming messages
router.post('/webhook', handleWebhook);

module.exports = router;
