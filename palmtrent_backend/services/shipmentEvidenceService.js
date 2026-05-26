const path = require('path');
const { isUploadOwnedByUser } = require('./resourceAccessService');

const allowedUploadPath = (uploadType, value) => {
  if (typeof value !== 'string') return false;
  return value.startsWith(`/api/v1/uploads/${uploadType}/`) ||
    value.startsWith(`/uploads/${uploadType}/`);
};

const uploadFilename = (value) => path.basename(String(value || '').split('?')[0]);

const validateShipmentEvidence = ({ photos, signature, user, minPhotos = 3 }) => {
  const photoUrls = Array.isArray(photos) ? photos.filter(Boolean) : [];
  const errors = [];

  if (photoUrls.length < minPhotos) {
    errors.push(`At least ${minPhotos} uploaded POD photos are required`);
  }

  photoUrls.forEach((photo) => {
    if (!allowedUploadPath('pod', photo)) {
      errors.push('POD photos must be uploaded before confirmation');
      return;
    }

    if (!isUploadOwnedByUser(uploadFilename(photo), user)) {
      errors.push('POD photos must belong to the confirming transporter');
    }
  });

  if (!allowedUploadPath('signatures', signature)) {
    errors.push('An uploaded signature image is required');
  } else if (!isUploadOwnedByUser(uploadFilename(signature), user)) {
    errors.push('The signature image must belong to the confirming transporter');
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    photos: photoUrls,
    signature
  };
};

module.exports = {
  allowedUploadPath,
  uploadFilename,
  validateShipmentEvidence
};
