// services/podService.js
const mongoose = require('mongoose');
const storageService = require('./storageService');
const notificationService = require('./notificationService');

// POD Document model schema
const podDocumentSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  shipment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shipment'
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
  pdfStorageKey: String,
  pdfProvider: String,
  pdfGeneratedAt: Date,
  emailedTo: [{
    email: String,
    sentAt: Date,
    messageId: String
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
podDocumentSchema.index({ shipment: 1 });
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
      const pod = await this.getPopulatedPOD(podId);

      if (!pod) {
        throw new Error('POD not found');
      }

      const pdfBuffer = this.generatePDFBuffer(pod);
      const filename = storageService.generateFilename(`${pod.podReference}.pdf`, 'pod-document-');
      const uploaded = await storageService.uploadFile(
        pdfBuffer,
        filename,
        'application/pdf',
        'pod-documents'
      );

      pod.pdfUrl = uploaded.url;
      pod.pdfStorageKey = uploaded.key;
      pod.pdfProvider = uploaded.provider;
      pod.pdfGeneratedAt = new Date();
      await pod.save();

      return {
        success: true,
        pdfUrl: pod.pdfUrl,
        pdfStorageKey: pod.pdfStorageKey,
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

  async getPopulatedPOD(podId) {
    return PODDocument.findById(podId)
      .populate('booking', 'bookingReference route cargoDetails pricing')
      .populate('shipper', 'fullName name email phone')
      .populate('transporter', 'fullName name email phone');
  }

  cleanPDFText(value) {
    return String(value || 'N/A')
      .replace(/[^\x20-\x7E]/g, '?')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  getPODPDFLines(pod) {
    const booking = pod.booking || {};
    const shipperName = pod.shipper?.fullName || pod.shipper?.name || 'N/A';
    const transporterName = pod.transporter?.fullName || pod.transporter?.name || 'N/A';
    const receiver = pod.deliveryDetails?.receivedBy || {};
    const duration = pod.timeline?.totalDuration
      ? `${Math.floor(pod.timeline.totalDuration / 60)}h ${pod.timeline.totalDuration % 60}m`
      : 'N/A';

    return [
      'Palmtrent Proof of Delivery',
      `POD reference: ${pod.podReference}`,
      `Booking reference: ${booking.bookingReference || 'N/A'}`,
      '',
      'Shipment',
      `Pickup location: ${pod.timeline?.pickupLocation || 'N/A'}`,
      `Delivery location: ${pod.timeline?.deliveryLocation || 'N/A'}`,
      `Pickup time: ${pod.timeline?.pickupAt ? new Date(pod.timeline.pickupAt).toISOString() : 'N/A'}`,
      `Delivery time: ${pod.timeline?.deliveryAt ? new Date(pod.timeline.deliveryAt).toISOString() : 'N/A'}`,
      `Duration: ${duration}`,
      '',
      'Cargo',
      `Description: ${pod.cargo?.description || 'N/A'}`,
      `Quantity: ${pod.cargo?.quantity || 'N/A'}`,
      `Condition: ${(pod.cargo?.condition || 'good').toUpperCase()}`,
      `Condition notes: ${pod.cargo?.conditionNotes || 'N/A'}`,
      '',
      'Parties',
      `Shipper: ${shipperName}`,
      `Transporter: ${transporterName}`,
      `Received by: ${receiver.name || 'N/A'}`,
      `Recipient contact: ${receiver.contact || 'N/A'}`,
      '',
      'Verification',
      `GPS verified: ${pod.verification?.gpsVerified ? 'YES' : 'NO'}`,
      `Signature captured: ${pod.verification?.signatureVerified ? 'YES' : 'NO'}`,
      `Photos attached: ${pod.photos?.length || 0}`,
      '',
      `Generated at: ${new Date().toISOString()}`
    ];
  }

  generatePDFBuffer(pod) {
    const lines = this.getPODPDFLines(pod).slice(0, 40);
    const textOps = lines.map((line, index) => {
      const fontSize = index === 0 ? 18 : 10;
      const move = index === 0 ? '50 790 Td' : '0 -16 Td';
      return `/F1 ${fontSize} Tf ${move} (${this.cleanPDFText(line)}) Tj`;
    }).join('\n');
    const stream = `BT\n${textOps}\nET`;
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    offsets.slice(1).forEach(offset => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'utf8');
  }

  async syncFromShipment(shipment, booking = shipment?.booking) {
    if (!shipment || !booking) {
      throw new Error('POD documents require a booking-backed shipment');
    }

    const bookingId = booking._id || shipment.booking || booking;
    const shipper = shipment.shipper || booking.shipper || booking.user;
    const deliveryEvidence = shipment.deliveryDetails || shipment.proofOfDelivery || {};
    const photos = deliveryEvidence.photos || [];
    let pod = await PODDocument.findOne({ shipment: shipment._id });

    if (!pod) {
      pod = await PODDocument.findOne({ booking: bookingId, shipment: { $exists: false } });
    }

    if (!pod) {
      pod = new PODDocument({
        booking: bookingId,
        shipment: shipment._id,
        podReference: this.generatePODReference()
      });
    }

    pod.shipment = shipment._id;
    pod.shipper = shipper;
    pod.transporter = shipment.transporter || booking.transporter;
    pod.deliveryDetails = {
      completedAt: deliveryEvidence.confirmedAt || deliveryEvidence.receivedAt || new Date(),
      receivedBy: {
        name: deliveryEvidence.receiverName || deliveryEvidence.receivedBy,
        contact: deliveryEvidence.receiverPhone
      },
      location: {
        address: shipment.route?.delivery?.address || booking.route?.delivery?.address
      }
    };
    pod.cargo = {
      description: shipment.cargoDetails?.description || booking.cargoDetails?.description,
      quantity: shipment.cargoDetails?.weight ? `${shipment.cargoDetails.weight} kg` : undefined,
      condition: 'good',
      conditionNotes: deliveryEvidence.notes
    };
    pod.signatures = {
      ...pod.signatures,
      receiver: deliveryEvidence.signature ? {
        image: deliveryEvidence.signature,
        signedAt: deliveryEvidence.confirmedAt || deliveryEvidence.receivedAt || new Date(),
        name: deliveryEvidence.receiverName || deliveryEvidence.receivedBy
      } : pod.signatures?.receiver
    };
    pod.photos = photos.map(url => ({
      type: 'cargo_delivered',
      url
    }));
    pod.timeline = {
      pickupAt: shipment.schedule?.actualPickupTime || shipment.timeline?.pickedUpAt || booking.timeline?.pickedUpAt,
      pickupLocation: shipment.route?.pickup?.address || booking.route?.pickup?.address,
      deliveryAt: deliveryEvidence.confirmedAt || deliveryEvidence.receivedAt || shipment.timeline?.deliveredAt,
      deliveryLocation: shipment.route?.delivery?.address || booking.route?.delivery?.address,
      totalDuration: this.calculateDurationMinutes(
        shipment.schedule?.actualPickupTime || shipment.timeline?.pickedUpAt || booking.timeline?.pickedUpAt,
        deliveryEvidence.confirmedAt || deliveryEvidence.receivedAt || shipment.timeline?.deliveredAt
      )
    };
    pod.verification = {
      gpsVerified: Boolean(shipment.route?.delivery?.coordinates || booking.route?.delivery?.coordinates),
      signatureVerified: Boolean(deliveryEvidence.signature),
      photoVerified: photos.length > 0
    };

    await pod.save();
    return pod;
  }

  calculateDurationMinutes(start, end) {
    if (!start || !end) return 0;
    return Math.max(0, Math.round((new Date(end) - new Date(start)) / (1000 * 60)));
  }

  async ensurePDFFromShipment(shipment, booking = shipment?.booking) {
    const pod = await this.syncFromShipment(shipment, booking);
    if (!pod.pdfUrl || !pod.pdfStorageKey) {
      await this.generatePDF(pod._id);
    }
    return this.getPopulatedPOD(pod._id);
  }

  async getDownloadData(pod) {
    if (!pod.pdfStorageKey) {
      await this.generatePDF(pod._id);
      pod = await this.getPopulatedPOD(pod._id);
    }

    const signed = await storageService.getSignedDownloadUrl(pod.pdfStorageKey);
    if (signed.provider === 'local') {
      signed.url = pod.pdfUrl;
    }
    return {
      ...signed,
      podReference: pod.podReference,
      generatedAt: pod.pdfGeneratedAt
    };
  }

  async canReadPDFUpload(user, filename) {
    if (!user) return false;
    if (user.userType === 'admin') return true;

    const pod = await PODDocument.findOne({
      $or: [
        { pdfStorageKey: `pod-documents/${filename}` },
        { pdfUrl: { $in: [
          `/api/v1/uploads/pod-documents/${filename}`,
          `/uploads/pod-documents/${filename}`
        ] } }
      ]
    }).select('shipper transporter');

    const userId = user._id?.toString() || user.id?.toString();
    return Boolean(pod && [pod.shipper, pod.transporter]
      .filter(Boolean)
      .some(party => party.toString() === userId));
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
    let pod = await this.getPopulatedPOD(podId);

    if (!pod) {
      throw new Error('POD not found');
    }

    // Generate PDF if not already generated
    if (!pod.pdfUrl) {
      await this.generatePDF(podId);
      pod = await this.getPopulatedPOD(podId);
    }

    const pdfBuffer = this.generatePDFBuffer(pod);
    const emailResult = await notificationService.sendEmail({
      to: email,
      subject: `Proof of Delivery ${pod.podReference}`,
      data: {
        title: 'Proof of Delivery',
        message: `Attached is the proof of delivery for booking ${pod.booking?.bookingReference || 'N/A'}.`
      },
      attachments: [{
        filename: `${pod.podReference}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    });

    pod.emailedTo.push({
      email,
      sentAt: new Date(),
      messageId: emailResult.messageId
    });

    await pod.save();

    return {
      success: true,
      message: `POD emailed to ${email}`
    };
  }
}

module.exports = new PODService();
