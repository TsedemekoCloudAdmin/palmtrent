jest.mock('../services/storageService', () => ({
  generateFilename: jest.fn(),
  uploadFile: jest.fn(),
  getSignedDownloadUrl: jest.fn()
}));

jest.mock('../services/notificationService', () => ({
  sendEmail: jest.fn()
}));

const storageService = require('../services/storageService');
const notificationService = require('../services/notificationService');
const podService = require('../services/podService');

function podDocument(overrides = {}) {
  return {
    _id: 'pod-1',
    podReference: 'POD-1',
    booking: { bookingReference: 'BOOK-1' },
    shipper: { fullName: 'Shipper One' },
    transporter: { fullName: 'Transporter One' },
    deliveryDetails: {
      receivedBy: {
        name: 'Receiver One',
        contact: '+263771111111'
      }
    },
    cargo: {
      description: 'Pallets',
      quantity: '1000 kg',
      condition: 'good'
    },
    photos: [{ url: '/api/v1/uploads/pod/photo.jpg' }],
    timeline: {
      pickupLocation: 'Harare',
      deliveryLocation: 'Bulawayo',
      pickupAt: new Date('2026-05-22T08:00:00.000Z'),
      deliveryAt: new Date('2026-05-22T12:00:00.000Z'),
      totalDuration: 240
    },
    verification: {
      gpsVerified: true,
      signatureVerified: true,
      photoVerified: true
    },
    emailedTo: [],
    save: jest.fn().mockResolvedValue(),
    ...overrides
  };
}

describe('podService documents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('generates and stores a private PDF document', async () => {
    const pod = podDocument();
    jest.spyOn(podService, 'getPopulatedPOD').mockResolvedValue(pod);
    storageService.generateFilename.mockReturnValue('pod-document-1.pdf');
    storageService.uploadFile.mockResolvedValue({
      url: '/api/v1/uploads/pod-documents/pod-document-1.pdf',
      key: 'pod-documents/pod-document-1.pdf',
      provider: 'local'
    });

    const result = await podService.generatePDF('pod-1');
    const [pdfBuffer] = storageService.uploadFile.mock.calls[0];

    expect(pdfBuffer.toString('utf8', 0, 8)).toBe('%PDF-1.4');
    expect(storageService.uploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'pod-document-1.pdf',
      'application/pdf',
      'pod-documents'
    );
    expect(pod.pdfUrl).toBe('/api/v1/uploads/pod-documents/pod-document-1.pdf');
    expect(pod.pdfStorageKey).toBe('pod-documents/pod-document-1.pdf');
    expect(pod.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({
      success: true,
      podReference: 'POD-1',
      pdfStorageKey: 'pod-documents/pod-document-1.pdf'
    }));
  });

  test('emails the generated PDF as an attachment and records successful delivery', async () => {
    const pod = podDocument({
      pdfUrl: '/api/v1/uploads/pod-documents/pod-document-1.pdf',
      pdfStorageKey: 'pod-documents/pod-document-1.pdf'
    });
    jest.spyOn(podService, 'getPopulatedPOD').mockResolvedValue(pod);
    notificationService.sendEmail.mockResolvedValue({ success: true, messageId: 'mail-1' });

    const result = await podService.emailPOD('pod-1', 'receiver@example.com');
    const message = notificationService.sendEmail.mock.calls[0][0];

    expect(message).toEqual(expect.objectContaining({
      to: 'receiver@example.com',
      subject: 'Proof of Delivery POD-1'
    }));
    expect(message.attachments[0]).toEqual(expect.objectContaining({
      filename: 'POD-1.pdf',
      contentType: 'application/pdf',
      content: expect.any(Buffer)
    }));
    expect(message.attachments[0].content.toString('utf8', 0, 8)).toBe('%PDF-1.4');
    expect(pod.emailedTo).toEqual([
      expect.objectContaining({ email: 'receiver@example.com', messageId: 'mail-1' })
    ]);
    expect(pod.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, message: 'POD emailed to receiver@example.com' });
  });
});
