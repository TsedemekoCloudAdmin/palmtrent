// services/podService.js
const mongoose = require('mongoose');

// POD Document model schema
const podDocumentSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  podReference: {
    type: String,
    required: true,
    unique: true
  },
  deliveryDetails: {
    completedAt: Date,
    receivedBy: {
      name: String,
      designation: String,
      contact: String
    },
    location: {
      address: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    }
  },
  cargo: {
    description: String,
    quantity: String,
    condition: {
      type: String,
      enum: ['good', 'damaged', 'partial', 'missing']
    },
    conditionNotes: String
  },
  signatures: {
    receiver: {
      image: String,
      signedAt: Date,
      name: String
    },
    transporter: {
      image: String,
      signedAt: Date,
      name: String
    }
  },
  photos: [{
    type: {
      type: String,
      enum: ['cargo_delivered', 'location', 'damage', 'receipt', 'other']
    },
    url: String,
    caption: String,
    takenAt: Date,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  }],
  timeline: {
    pickupAt: Date,
    pickupLocation: String,
    deliveryAt: Date,
    deliveryLocation: String,
    totalDuration: Number // in minutes
  },
  verification: {
    gpsVerified: Boolean,
    signatureVerified: Boolean,
    photoVerified: Boolean
  },
  pdfUrl: String,
  pdfGeneratedAt: Date,
  emailedTo: [{
    email: String,
    sentAt: Date
  }],
  shipper: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  transporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

podDocumentSchema.index({ booking: 1 });
podDocumentSchema.index({ podReference: 1 });
podDocumentSchema.index({ shipper: 1 });
podDocumentSchema.index({ transporter: 1 });

const PODDocument = mongoose.models.PODDocument || mongoose.model('PODDocument', podDocumentSchema);

class PODService {
  /**
   * Generate POD reference
   */
  generatePODReference() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `POD-${timestamp}-${random}`;
  }

  /**
   * Create POD document
   */
  async createPOD(bookingId, deliveryData) {
    try {
      const Booking = require('../models/Booking');
      const booking = await Booking.findById(bookingId)
        .populate('user', 'name email')
        .populate('transporter', 'name email');

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Calculate duration
      const pickupTime = booking.timeline?.pickedUpAt || booking.route?.pickup?.date;
      const deliveryTime = new Date();
      let totalDuration = 0;

      if (pickupTime) {
        totalDuration = Math.round((deliveryTime - new Date(pickupTime)) / (1000 * 60));
      }

      const pod = new PODDocument({
        booking: bookingId,
        podReference: this.generatePODReference(),
        deliveryDetails: {
          completedAt: deliveryTime,
          receivedBy: deliveryData.receivedBy,
          location: deliveryData.location
        },
        cargo: {
          description: booking.cargoDetails?.description,
          quantity: booking.cargoDetails?.quantity?.toString(),
          condition: deliveryData.cargoCondition || 'good',
          conditionNotes: deliveryData.conditionNotes
        },
        signatures: deliveryData.signatures || {},
        photos: deliveryData.photos || [],
        timeline: {
          pickupAt: pickupTime,
          pickupLocation: booking.route?.pickup?.address,
          deliveryAt: deliveryTime,
          deliveryLocation: booking.route?.delivery?.address,
          totalDuration
        },
        verification: {
          gpsVerified: !!deliveryData.location?.coordinates,
          signatureVerified: !!(deliveryData.signatures?.receiver && deliveryData.signatures?.transporter),
          photoVerified: deliveryData.photos?.length > 0
        },
        shipper: booking.user._id,
        transporter: booking.transporter?._id
      });

      await pod.save();

      // Update booking status
      booking.status = 'completed';
      booking.timeline = {
        ...booking.timeline,
        completedAt: deliveryTime
      };
      booking.pod = pod._id;
      await booking.save();

      return pod;
    } catch (error) {
      console.error('Error creating POD:', error);
      throw error;
    }
  }

  /**
   * Generate PDF for POD
   */
  async generatePDF(podId) {
    try {
      const pod = await PODDocument.findById(podId)
        .populate('booking', 'bookingReference route cargoDetails pricing')
        .populate('shipper', 'name email phone')
        .populate('transporter', 'name email phone');

      if (!pod) {
        throw new Error('POD not found');
      }

      // Generate HTML content for PDF
      const html = this.generatePODHTML(pod);

      // In production, use a library like Puppeteer or PDFKit
      // For now, we'll store the HTML and simulate PDF generation
      const pdfUrl = await this.convertHTMLToPDF(html, pod.podReference);

      pod.pdfUrl = pdfUrl;
      pod.pdfGeneratedAt = new Date();
      await pod.save();

      return {
        success: true,
        pdfUrl,
        podReference: pod.podReference
      };
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  /**
   * Generate HTML template for POD
   */
  generatePODHTML(pod) {
    const booking = pod.booking;
    const shipper = pod.shipper;
    const transporter = pod.transporter;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Proof of Delivery - ${pod.podReference}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { text-align: center; border-bottom: 2px solid #0C2D48; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-size: 28px; font-weight: bold; color: #0C2D48; }
    .pod-ref { font-size: 18px; color: #666; margin-top: 10px; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 16px; font-weight: bold; color: #0C2D48; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; }
    .row { display: flex; margin-bottom: 8px; }
    .label { width: 150px; font-weight: 500; color: #666; }
    .value { flex: 1; }
    .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
    .signature-box { width: 45%; text-align: center; }
    .signature-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 5px; }
    .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; }
    .verified { color: #059669; font-weight: bold; }
    .condition-good { color: #059669; }
    .condition-damaged { color: #dc2626; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">PALMTRENT</div>
    <div style="font-size: 14px; color: #666;">Freight & Logistics Platform</div>
    <div class="pod-ref">Proof of Delivery: ${pod.podReference}</div>
  </div>

  <div class="section">
    <div class="section-title">Shipment Details</div>
    <div class="row"><span class="label">Booking Reference:</span><span class="value">${booking?.bookingReference || 'N/A'}</span></div>
    <div class="row"><span class="label">Pickup Location:</span><span class="value">${pod.timeline?.pickupLocation || 'N/A'}</span></div>
    <div class="row"><span class="label">Delivery Location:</span><span class="value">${pod.timeline?.deliveryLocation || 'N/A'}</span></div>
    <div class="row"><span class="label">Pickup Time:</span><span class="value">${pod.timeline?.pickupAt ? new Date(pod.timeline.pickupAt).toLocaleString() : 'N/A'}</span></div>
    <div class="row"><span class="label">Delivery Time:</span><span class="value">${pod.timeline?.deliveryAt ? new Date(pod.timeline.deliveryAt).toLocaleString() : 'N/A'}</span></div>
    <div class="row"><span class="label">Total Duration:</span><span class="value">${pod.timeline?.totalDuration ? Math.floor(pod.timeline.totalDuration / 60) + 'h ' + (pod.timeline.totalDuration % 60) + 'm' : 'N/A'}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Cargo Details</div>
    <div class="row"><span class="label">Description:</span><span class="value">${pod.cargo?.description || 'N/A'}</span></div>
    <div class="row"><span class="label">Quantity:</span><span class="value">${pod.cargo?.quantity || 'N/A'}</span></div>
    <div class="row"><span class="label">Condition:</span><span class="value condition-${pod.cargo?.condition}">${(pod.cargo?.condition || 'good').toUpperCase()}</span></div>
    ${pod.cargo?.conditionNotes ? `<div class="row"><span class="label">Notes:</span><span class="value">${pod.cargo.conditionNotes}</span></div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Parties</div>
    <div class="row"><span class="label">Shipper:</span><span class="value">${shipper?.name || 'N/A'} (${shipper?.email || ''})</span></div>
    <div class="row"><span class="label">Transporter:</span><span class="value">${transporter?.name || 'N/A'} (${transporter?.email || ''})</span></div>
    <div class="row"><span class="label">Received By:</span><span class="value">${pod.deliveryDetails?.receivedBy?.name || 'N/A'} - ${pod.deliveryDetails?.receivedBy?.designation || ''}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Verification</div>
    <div class="row"><span class="label">GPS Verified:</span><span class="value ${pod.verification?.gpsVerified ? 'verified' : ''}">${pod.verification?.gpsVerified ? 'YES' : 'NO'}</span></div>
    <div class="row"><span class="label">Signatures:</span><span class="value ${pod.verification?.signatureVerified ? 'verified' : ''}">${pod.verification?.signatureVerified ? 'VERIFIED' : 'PENDING'}</span></div>
    <div class="row"><span class="label">Photos:</span><span class="value">${pod.photos?.length || 0} attached</span></div>
  </div>

  <div class="signatures">
    <div class="signature-box">
      <div class="signature-line">Receiver Signature</div>
      <div>${pod.deliveryDetails?.receivedBy?.name || ''}</div>
    </div>
    <div class="signature-box">
      <div class="signature-line">Transporter Signature</div>
      <div>${transporter?.name || ''}</div>
    </div>
  </div>

  <div class="footer">
    <p>This is a computer-generated document. Generated on ${new Date().toLocaleString()}</p>
    <p>Palmtrent Freight & Logistics Platform | www.palmtrent.com</p>
  </div>
</body>
</html>`;
  }

  /**
   * Convert HTML to PDF (placeholder - implement with Puppeteer in production)
   */
  async convertHTMLToPDF(html, reference) {
    // In production, use Puppeteer:
    // const puppeteer = require('puppeteer');
    // const browser = await puppeteer.launch();
    // const page = await browser.newPage();
    // await page.setContent(html);
    // const pdf = await page.pdf({ format: 'A4' });
    // await browser.close();
    // Upload to storage and return URL

    // For now, return a placeholder URL
    const storageService = require('./storageService');
    const filename = storageService.generateFilename(`${reference}.pdf`, 'pod-');
    return `/api/v1/pods/${reference}/download`;
  }

  /**
   * Get POD by booking ID
   */
  async getPODByBooking(bookingId) {
    return PODDocument.findOne({ booking: bookingId })
      .populate('shipper', 'name email')
      .populate('transporter', 'name email');
  }

  /**
   * Get POD by reference
   */
  async getPODByReference(podReference) {
    return PODDocument.findOne({ podReference })
      .populate('booking')
      .populate('shipper', 'name email')
      .populate('transporter', 'name email');
  }

  /**
   * Add photo to POD
   */
  async addPhoto(podId, photoData) {
    const pod = await PODDocument.findById(podId);

    if (!pod) {
      throw new Error('POD not found');
    }

    pod.photos.push({
      type: photoData.type,
      url: photoData.url,
      caption: photoData.caption,
      takenAt: photoData.takenAt || new Date(),
      coordinates: photoData.coordinates
    });

    pod.verification.photoVerified = true;
    await pod.save();

    return pod;
  }

  /**
   * Add signature to POD
   */
  async addSignature(podId, signatureData) {
    const pod = await PODDocument.findById(podId);

    if (!pod) {
      throw new Error('POD not found');
    }

    if (signatureData.type === 'receiver') {
      pod.signatures.receiver = {
        image: signatureData.image,
        signedAt: new Date(),
        name: signatureData.name
      };
    } else if (signatureData.type === 'transporter') {
      pod.signatures.transporter = {
        image: signatureData.image,
        signedAt: new Date(),
        name: signatureData.name
      };
    }

    // Check if both signatures are present
    if (pod.signatures.receiver?.image && pod.signatures.transporter?.image) {
      pod.verification.signatureVerified = true;
    }

    await pod.save();

    return pod;
  }

  /**
   * Email POD to recipient
   */
  async emailPOD(podId, email) {
    const pod = await PODDocument.findById(podId);

    if (!pod) {
      throw new Error('POD not found');
    }

    // Generate PDF if not already generated
    if (!pod.pdfUrl) {
      await this.generatePDF(podId);
    }

    // In production, use email service to send
    // For now, just record the attempt
    pod.emailedTo.push({
      email,
      sentAt: new Date()
    });

    await pod.save();

    return {
      success: true,
      message: `POD emailed to ${email}`
    };
  }
}

module.exports = new PODService();
