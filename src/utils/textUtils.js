
/**
 * Normalizes a string for answer checking: lowercase, trim, and remove accents.
 * @param {string} text The text to normalize.
 * @returns {string} The normalized text.
 */
export function normalizeForAnswerCheck(text) {
  if (typeof text !== 'string') return '';
  // 1. Lowercase and trim whitespace
  let normalized = text.trim().toLowerCase();
  // 2. Separate combined characters (like é) into the base character and the accent (e + ´)
  normalized = normalized.normalize("NFD");
  // 3. Use a regular expression to remove the accent characters
  normalized = normalized.replace(/[\u0300-\u036f]/g, "");
  return normalized;
}