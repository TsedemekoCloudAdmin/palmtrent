const {
  allowedUploadPath,
  uploadFilename,
  validateShipmentEvidence
} = require('../services/shipmentEvidenceService');

describe('shipmentEvidenceService', () => {
  const transporter = { _id: 'transporter-1', userType: 'transporter' };

  test('recognizes authenticated and legacy upload paths', () => {
    expect(allowedUploadPath('pod', '/api/v1/uploads/pod/transporter-1-a.jpg')).toBe(true);
    expect(allowedUploadPath('pod', '/uploads/pod/transporter-1-a.jpg')).toBe(true);
    expect(allowedUploadPath('pod', 'photo1')).toBe(false);
    expect(uploadFilename('/api/v1/uploads/pod/transporter-1-a.jpg?version=1')).toBe('transporter-1-a.jpg');
  });

  test('accepts transporter-owned uploaded POD evidence', () => {
    const result = validateShipmentEvidence({
      user: transporter,
      photos: [
        '/api/v1/uploads/pod/transporter-1-one.jpg',
        '/api/v1/uploads/pod/transporter-1-two.jpg',
        '/api/v1/uploads/pod/transporter-1-three.jpg'
      ],
      signature: '/api/v1/uploads/signatures/transporter-1-signature.jpg'
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('rejects placeholder and another users shipment evidence', () => {
    const result = validateShipmentEvidence({
      user: transporter,
      photos: [
        'photo1',
        '/api/v1/uploads/pod/other-user-two.jpg'
      ],
      signature: true
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'At least 3 uploaded POD photos are required',
      'POD photos must be uploaded before confirmation',
      'POD photos must belong to the confirming transporter',
      'An uploaded signature image is required'
    ]));
  });
});
