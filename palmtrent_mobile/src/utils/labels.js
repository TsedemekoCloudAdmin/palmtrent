// Display helpers that guarantee we never render a raw Mongo ObjectId in the UI.
// Vehicle make/model/vehicleType are ObjectId references; depending on the
// endpoint they arrive as a populated object ({name}), a resolved *Name string,
// or an unresolved id. These helpers always resolve to human text (or blank).

const isObjectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

// Returns a clean label string, or '' for ids / empty values.
export const cleanLabel = (value) => {
  if (!value) return '';
  if (typeof value === 'object') return cleanLabel(value.name || value.label || value.displayName);
  return isObjectId(value) ? '' : String(value);
};

// Builds a readable vehicle label: "REG · Make Model" (never an ObjectId).
export const vehicleLabel = (vehicle = {}, fallback = 'Vehicle') => {
  if (!vehicle) return fallback;
  const reg = cleanLabel(vehicle.registrationNumber);
  const make = cleanLabel(vehicle.makeName) || cleanLabel(vehicle.make);
  const model = cleanLabel(vehicle.modelName) || cleanLabel(vehicle.model);
  const makeModel = [make, model].filter(Boolean).join(' ');
  return [reg, makeModel].filter(Boolean).join(' · ') || fallback;
};

export const vehicleTypeLabel = (vehicle = {}) => (
  cleanLabel(vehicle.vehicleTypeName) || cleanLabel(vehicle.vehicleType) || cleanLabel(vehicle.subType) || ''
);
