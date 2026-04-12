// services/whatsappService.js
// WhatsApp Business API Integration Service

const axios = require('axios');

class WhatsAppService {
  constructor() {
    this.baseUrl = 'https://graph.facebook.com/v18.0';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    // Session state for conversational flows
    this.sessions = new Map();

    // Session timeout (30 minutes)
    this.sessionTimeout = 30 * 60 * 1000;
  }

  // Get or create session for a user
  getSession(phoneNumber) {
    const session = this.sessions.get(phoneNumber);
    if (session && Date.now() - session.lastActivity < this.sessionTimeout) {
      session.lastActivity = Date.now();
      return session;
    }
    return this.createSession(phoneNumber);
  }

  // Create new session
  createSession(phoneNumber) {
    const session = {
      phoneNumber,
      state: 'IDLE',
      context: {},
      lastActivity: Date.now(),
      createdAt: Date.now()
    };
    this.sessions.set(phoneNumber, session);
    return session;
  }

  // Update session state
  updateSession(phoneNumber, state, context = {}) {
    const session = this.getSession(phoneNumber);
    session.state = state;
    session.context = { ...session.context, ...context };
    session.lastActivity = Date.now();
    this.sessions.set(phoneNumber, session);
    return session;
  }

  // Clear session
  clearSession(phoneNumber) {
    this.sessions.delete(phoneNumber);
  }

  // Send text message
  async sendTextMessage(to, text) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.formatPhoneNumber(to),
          type: 'text',
          text: { body: text }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return { success: true, messageId: response.data.messages?.[0]?.id };
    } catch (error) {
      console.error('WhatsApp send text error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Send interactive buttons message
  async sendButtonsMessage(to, bodyText, buttons) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.formatPhoneNumber(to),
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: bodyText },
            action: {
              buttons: buttons.map((btn, index) => ({
                type: 'reply',
                reply: {
                  id: btn.id || `btn_${index}`,
                  title: btn.title.substring(0, 20) // Max 20 chars
                }
              }))
            }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return { success: true, messageId: response.data.messages?.[0]?.id };
    } catch (error) {
      console.error('WhatsApp send buttons error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Send interactive list message
  async sendListMessage(to, bodyText, buttonText, sections) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.formatPhoneNumber(to),
          type: 'interactive',
          interactive: {
            type: 'list',
            body: { text: bodyText },
            action: {
              button: buttonText.substring(0, 20),
              sections: sections.map(section => ({
                title: section.title,
                rows: section.rows.map(row => ({
                  id: row.id,
                  title: row.title.substring(0, 24),
                  description: row.description?.substring(0, 72)
                }))
              }))
            }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return { success: true, messageId: response.data.messages?.[0]?.id };
    } catch (error) {
      console.error('WhatsApp send list error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Send location request message
  async sendLocationRequest(to, bodyText) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.formatPhoneNumber(to),
          type: 'interactive',
          interactive: {
            type: 'location_request_message',
            body: { text: bodyText },
            action: { name: 'send_location' }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return { success: true, messageId: response.data.messages?.[0]?.id };
    } catch (error) {
      console.error('WhatsApp location request error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Send template message
  async sendTemplateMessage(to, templateName, languageCode = 'en', components = []) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.formatPhoneNumber(to),
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return { success: true, messageId: response.data.messages?.[0]?.id };
    } catch (error) {
      console.error('WhatsApp send template error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Send image message
  async sendImageMessage(to, imageUrl, caption = '') {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.formatPhoneNumber(to),
          type: 'image',
          image: {
            link: imageUrl,
            caption
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return { success: true, messageId: response.data.messages?.[0]?.id };
    } catch (error) {
      console.error('WhatsApp send image error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Send document message
  async sendDocumentMessage(to, documentUrl, filename, caption = '') {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.formatPhoneNumber(to),
          type: 'document',
          document: {
            link: documentUrl,
            filename,
            caption
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return { success: true, messageId: response.data.messages?.[0]?.id };
    } catch (error) {
      console.error('WhatsApp send document error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Send location message
  async sendLocationMessage(to, latitude, longitude, name, address) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.formatPhoneNumber(to),
          type: 'location',
          location: {
            latitude,
            longitude,
            name,
            address
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return { success: true, messageId: response.data.messages?.[0]?.id };
    } catch (error) {
      console.error('WhatsApp send location error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Mark message as read
  async markAsRead(messageId) {
    try {
      await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return { success: true };
    } catch (error) {
      console.error('WhatsApp mark read error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Download media from WhatsApp
  async downloadMedia(mediaId) {
    try {
      // First get the media URL
      const mediaResponse = await axios.get(
        `${this.baseUrl}/${mediaId}`,
        {
          headers: { 'Authorization': `Bearer ${this.accessToken}` }
        }
      );

      // Then download the media
      const downloadResponse = await axios.get(mediaResponse.data.url, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` },
        responseType: 'arraybuffer'
      });

      return {
        success: true,
        data: downloadResponse.data,
        mimeType: mediaResponse.data.mime_type
      };
    } catch (error) {
      console.error('WhatsApp download media error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Format phone number to international format
  formatPhoneNumber(phone) {
    // Remove any non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Handle Zimbabwe numbers
    if (cleaned.startsWith('0')) {
      cleaned = '263' + cleaned.substring(1);
    }
    if (!cleaned.startsWith('263') && cleaned.length === 9) {
      cleaned = '263' + cleaned;
    }

    return cleaned;
  }

  // Verify webhook
  verifyWebhook(mode, token, challenge) {
    if (mode === 'subscribe' && token === this.verifyToken) {
      return challenge;
    }
    return null;
  }

  // Parse incoming webhook message
  parseWebhookMessage(body) {
    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value?.messages) {
        return null;
      }

      const message = value.messages[0];
      const contact = value.contacts?.[0];

      const parsed = {
        messageId: message.id,
        timestamp: new Date(parseInt(message.timestamp) * 1000),
        from: message.from,
        contactName: contact?.profile?.name || 'Unknown',
        type: message.type
      };

      // Parse message content based on type
      switch (message.type) {
        case 'text':
          parsed.text = message.text.body;
          break;
        case 'interactive':
          if (message.interactive.type === 'button_reply') {
            parsed.buttonReply = {
              id: message.interactive.button_reply.id,
              title: message.interactive.button_reply.title
            };
          } else if (message.interactive.type === 'list_reply') {
            parsed.listReply = {
              id: message.interactive.list_reply.id,
              title: message.interactive.list_reply.title,
              description: message.interactive.list_reply.description
            };
          }
          break;
        case 'location':
          parsed.location = {
            latitude: message.location.latitude,
            longitude: message.location.longitude,
            name: message.location.name,
            address: message.location.address
          };
          break;
        case 'image':
          parsed.image = {
            id: message.image.id,
            caption: message.image.caption,
            mimeType: message.image.mime_type
          };
          break;
        case 'document':
          parsed.document = {
            id: message.document.id,
            filename: message.document.filename,
            mimeType: message.document.mime_type
          };
          break;
      }

      return parsed;
    } catch (error) {
      console.error('Parse webhook error:', error);
      return null;
    }
  }

  // ============ NOTIFICATION TEMPLATES ============

  // Send booking confirmation to shipper
  async sendBookingConfirmation(to, booking) {
    const message = `*Booking Confirmed!* ✅

📦 *Booking ID:* ${booking.bookingNumber}
📍 *From:* ${booking.route.pickup.address}
📍 *To:* ${booking.route.delivery.address}
📦 *Cargo:* ${booking.cargo.type} (${booking.cargo.weight} kg)
💰 *Total:* $${booking.pricing.total.toFixed(2)}

Your booking is now being matched with available transporters. We'll notify you once a transporter accepts.

Track your shipment anytime by visiting our app.`;

    return this.sendTextMessage(to, message);
  }

  // Send new job alert to transporter
  async sendNewJobAlert(to, booking) {
    const bodyText = `*New Job Available!* 🚚

📍 *Pickup:* ${booking.route.pickup.address}
📍 *Delivery:* ${booking.route.delivery.address}
📦 *Cargo:* ${booking.cargo.type} (${booking.cargo.weight} kg)
💰 *Earnings:* $${(booking.pricing.total * 0.85).toFixed(2)}
📅 *Pickup Date:* ${new Date(booking.route.pickup.scheduledDate).toLocaleDateString()}

Are you interested in this job?`;

    const buttons = [
      { id: `accept_${booking._id}`, title: 'Accept Job' },
      { id: `decline_${booking._id}`, title: 'Decline' },
      { id: `details_${booking._id}`, title: 'View Details' }
    ];

    return this.sendButtonsMessage(to, bodyText, buttons);
  }

  // Send transporter assigned notification to shipper
  async sendTransporterAssigned(to, booking, transporter) {
    const message = `*Transporter Assigned!* 🚚

Your booking *${booking.bookingNumber}* has been matched with a transporter.

👤 *Driver:* ${transporter.fullName}
📞 *Phone:* ${transporter.phone}
🚗 *Vehicle:* ${booking.assignedVehicle?.make} ${booking.assignedVehicle?.model}
📋 *Plate:* ${booking.assignedVehicle?.plateNumber}

The transporter will arrive at the pickup location on ${new Date(booking.route.pickup.scheduledDate).toLocaleDateString()}.

You can track your shipment in real-time through our app.`;

    return this.sendTextMessage(to, message);
  }

  // Send pickup started notification
  async sendPickupStarted(to, booking) {
    const message = `*Pickup Started!* 📦

Your shipment *${booking.bookingNumber}* has been picked up.

📍 *Current Location:* ${booking.route.pickup.address}
🎯 *Destination:* ${booking.route.delivery.address}
⏱️ *Estimated Arrival:* ${booking.route.estimatedDuration || 'Calculating...'}

Track your shipment in real-time through our app.`;

    return this.sendTextMessage(to, message);
  }

  // Send delivery completed notification
  async sendDeliveryCompleted(to, booking) {
    const message = `*Delivery Completed!* ✅

Your shipment *${booking.bookingNumber}* has been successfully delivered.

📍 *Delivered To:* ${booking.route.delivery.address}
📅 *Delivery Time:* ${new Date().toLocaleString()}

Thank you for using Palmtrent! Please rate your experience in the app.

💰 Payment will be released to the transporter within 24 hours.`;

    const buttons = [
      { id: `rate_${booking._id}`, title: 'Rate Service' },
      { id: 'book_again', title: 'Book Again' }
    ];

    return this.sendButtonsMessage(to, message, buttons);
  }

  // Send payment released notification to transporter
  async sendPaymentReleased(to, booking, amount) {
    const message = `*Payment Released!* 💰

Your payment for booking *${booking.bookingNumber}* has been released.

💵 *Amount:* $${amount.toFixed(2)}
📱 *Method:* Mobile Money

The funds should reflect in your account within 24 hours.

Thank you for delivering with Palmtrent! 🚚`;

    return this.sendTextMessage(to, message);
  }

  // Send SOS alert
  async sendSOSAlert(to, emergency) {
    const message = `⚠️ *EMERGENCY ALERT* ⚠️

An SOS has been triggered for booking *${emergency.bookingNumber}*.

📍 *Location:* ${emergency.location?.address || 'Unknown'}
🚨 *Type:* ${emergency.type}
👤 *Reported By:* ${emergency.reportedBy}
📞 *Contact:* ${emergency.contactNumber}

Emergency services have been notified. Please stay safe.`;

    return this.sendTextMessage(to, message);
  }
}

module.exports = new WhatsAppService();
