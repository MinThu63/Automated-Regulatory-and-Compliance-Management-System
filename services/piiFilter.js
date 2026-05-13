const pool = require('../db');

// =============================================
// PII Detection and Filtering Service
// Prevents personal data from reaching the LLM
// Complies with PDPA (Personal Data Protection Act)
// =============================================

// Singapore NRIC/FIN pattern: [STFGM] followed by 7 digits and 1 letter
const NRIC_PATTERN = /[STFGM]\d{7}[A-Z]/gi;

// Singapore phone numbers: +65XXXXXXXX or 8/9 digit local numbers
const PHONE_PATTERN = /(\+65\s?\d{4}\s?\d{4})|(\b[689]\d{7}\b)/g;

// Email addresses
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Singapore postal codes (6 digits)
const POSTAL_CODE_PATTERN = /\b\d{6}\b/g;

// Physical addresses (Block/Blk + number, street names with common Singapore patterns)
const ADDRESS_PATTERN = /\b(BLK|Block|Blk)\s*\d+[A-Z]?\s/gi;

// Credit card numbers (13-19 digits, possibly with spaces/dashes)
const CREDIT_CARD_PATTERN = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7}\b/g;

// Passport numbers (common format: letter followed by 7-8 digits)
const PASSPORT_PATTERN = /\b[A-Z]\d{7,8}\b/g;

// =============================================
// Main PII Detection Function
// Returns: { hasPII: boolean, detections: [...], cleanText: string }
// =============================================

function detectPII(text) {
  if (!text || typeof text !== 'string') {
    return { hasPII: false, detections: [], cleanText: text || '' };
  }

  var detections = [];

  // Check NRIC/FIN
  var nricMatches = text.match(NRIC_PATTERN);
  if (nricMatches) {
    detections.push({
      type: 'NRIC/FIN',
      count: nricMatches.length,
      pattern: 'Singapore National ID'
    });
  }

  // Check phone numbers
  var phoneMatches = text.match(PHONE_PATTERN);
  if (phoneMatches) {
    detections.push({
      type: 'Phone Number',
      count: phoneMatches.length,
      pattern: 'Singapore phone number'
    });
  }

  // Check email addresses
  var emailMatches = text.match(EMAIL_PATTERN);
  if (emailMatches) {
    detections.push({
      type: 'Email Address',
      count: emailMatches.length,
      pattern: 'Email address'
    });
  }

  // Check postal codes
  var postalMatches = text.match(POSTAL_CODE_PATTERN);
  if (postalMatches) {
    detections.push({
      type: 'Postal Code',
      count: postalMatches.length,
      pattern: 'Singapore postal code (6 digits)'
    });
  }

  // Check physical addresses
  var addressMatches = text.match(ADDRESS_PATTERN);
  if (addressMatches) {
    detections.push({
      type: 'Physical Address',
      count: addressMatches.length,
      pattern: 'Block/Blk address format'
    });
  }

  // Check credit card numbers
  var ccMatches = text.match(CREDIT_CARD_PATTERN);
  if (ccMatches) {
    detections.push({
      type: 'Credit Card',
      count: ccMatches.length,
      pattern: 'Credit card number'
    });
  }

  // Check passport numbers
  var passportMatches = text.match(PASSPORT_PATTERN);
  if (passportMatches) {
    detections.push({
      type: 'Passport Number',
      count: passportMatches.length,
      pattern: 'Passport number format'
    });
  }

  return {
    hasPII: detections.length > 0,
    detections: detections,
    cleanText: text
  };
}

// =============================================
// PII Guard — Call this before any LLM interaction
// Blocks content and logs if PII is found
// Returns: { allowed: boolean, reason: string }
// =============================================

async function piiGuard(text, context) {
  var result = detectPII(text);

  if (result.hasPII) {
    var detectionSummary = result.detections.map(function (d) {
      return d.type + ' (' + d.count + ' found)';
    }).join(', ');

    console.log('[PII Filter] BLOCKED — PII detected:', detectionSummary);
    console.log('[PII Filter] Context:', context || 'unknown');

    // Log PII detection to audit trail
    try {
      await pool.query(
        'INSERT INTO audit_logs (user_id, action_type, target_table, target_id, description) VALUES (?, ?, ?, ?, ?)',
        [
          1,
          'PII_BLOCKED',
          'regulations',
          0,
          JSON.stringify({
            context: context || 'unknown',
            detections: result.detections,
            text_length: text.length,
            timestamp: new Date().toISOString()
          })
        ]
      );
    } catch (err) {
      console.error('[PII Filter] Failed to log detection:', err.message);
    }

    return {
      allowed: false,
      reason: 'PII detected: ' + detectionSummary + '. Content blocked from LLM processing.',
      detections: result.detections
    };
  }

  return {
    allowed: true,
    reason: 'No PII detected. Content cleared for LLM processing.',
    detections: []
  };
}

// =============================================
// EXPORTS
// =============================================

module.exports = { detectPII, piiGuard };
