/**
 * sanitize.js
 * Strips characters and patterns that could be used for prompt injection
 * before any user-supplied text is passed into a Claude prompt.
 */

/**
 * Sanitize a string for safe inclusion in an LLM prompt.
 * @param {string} input - Raw user or file-extracted text
 * @param {number} maxLength - Hard character cap (default 20000)
 * @returns {string} Sanitized string
 */
const sanitizeForPrompt = (input, maxLength = 20000) => {
  if (typeof input !== "string") return "";

  let clean = input
    // Remove null bytes
    .replace(/\0/g, "")
    // Collapse excessive whitespace
    .replace(/\s{4,}/g, "   ")
    // Strip common prompt injection attempts
    .replace(/ignore (all |previous |above |prior )?(instructions?|prompts?|context)/gi, "[REMOVED]")
    .replace(/you are now|pretend (you are|to be)|act as (a |an )?(?!hr|recruiter|analyst)/gi, "[REMOVED]")
    .replace(/system\s*:/gi, "[REMOVED]")
    .replace(/<\/?(?:system|user|assistant|prompt|instruction)>/gi, "[REMOVED]")
    // Trim to max length
    .slice(0, maxLength)
    .trim();

  return clean;
};

/**
 * Sanitize a filename to prevent path traversal.
 * @param {string} filename
 * @returns {string}
 */
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, 200);
};

module.exports = { sanitizeForPrompt, sanitizeFilename };
