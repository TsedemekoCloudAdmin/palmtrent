// Shared Zimbabwean phone normalizer. Used by auth (registration/login) and the
// driver roster→marketplace linking so that phone matching is consistent across
// the platform (e.g. "0772..." and "+263772..." resolve to the same value).
function normalizeZimbabwePhone(phone) {
  if (phone === undefined || phone === null || phone === '') return undefined;
  const digits = String(phone).replace(/\D/g, '');

  if (digits.startsWith('263') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+263${digits.slice(1)}`;
  }
  if (!digits.startsWith('0') && digits.length === 9) {
    return `+263${digits}`;
  }
  if (String(phone).startsWith('+263') && digits.length === 12) {
    return `+${digits}`;
  }
  return String(phone).trim();
}

module.exports = { normalizeZimbabwePhone };
