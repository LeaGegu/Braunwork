import express from 'express';
import { rateLimit } from 'express-rate-limit';

const allowedFields = new Set([
  'name',
  'email',
  'phone',
  'category',
  'subject',
  'message',
]);

const fieldLimits = {
  name: 120,
  email: 254,
  phone: 40,
  category: 80,
  subject: 200,
  message: 5000,
};

const emailPattern = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

function normalizePublicInquiry(body) {
  if (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((field) => !allowedFields.has(field))
  ) {
    return { error: 'Request body contains invalid fields.' };
  }

  const normalized = {};
  for (const field of ['name', 'email', 'category', 'subject', 'message']) {
    const value = body[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      return { error: `${field} is required.` };
    }

    const trimmed = value.trim();
    if (trimmed.length > fieldLimits[field]) {
      return { error: `${field} exceeds the maximum length.` };
    }
    normalized[field] = trimmed;
  }

  normalized.email = normalized.email.toLowerCase();
  if (!emailPattern.test(normalized.email)) {
    return { error: 'A valid email address is required.' };
  }

  if (body.phone === undefined || body.phone === null) {
    normalized.phone = null;
  } else if (typeof body.phone !== 'string') {
    return { error: 'phone must be a string when provided.' };
  } else {
    normalized.phone = body.phone.trim() || null;
    if (normalized.phone && normalized.phone.length > fieldLimits.phone) {
      return { error: 'phone exceeds the maximum length.' };
    }
  }

  return { inquiry: normalized };
}

export function createPublicInquiriesRouter({
  submitPublicInquiry,
  rateLimitWindowMs = 15 * 60 * 1000,
  rateLimitMax = 5,
  logger = console,
}) {
  if (typeof submitPublicInquiry !== 'function') {
    throw new TypeError('submitPublicInquiry must be a function.');
  }

  const router = express.Router();
  router.use(
    rateLimit({
      windowMs: rateLimitWindowMs,
      limit: rateLimitMax,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (req, res) =>
        res.status(429).json({
          success: false,
          message: 'Too many inquiry submissions. Please try again later.',
        }),
    }),
  );

  router.post('/', express.json(), async (req, res) => {
    const validation = normalizePublicInquiry(req.body);
    if (validation.error) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const {
      name,
      email,
      phone,
      category,
      subject,
      message,
    } = validation.inquiry;

    try {
      const { error } = await submitPublicInquiry({
        p_name: name,
        p_email: email,
        p_phone: phone,
        p_category: category,
        p_subject: subject,
        p_message: message,
      });

      if (error) {
        const code = typeof error.code === 'string' &&
          /^[A-Z0-9]+$/i.test(error.code)
          ? error.code
          : 'unknown';
        logger.error('Public inquiry submission RPC failed.', { code });
        return res.status(503).json({
          success: false,
          message: 'Unable to submit your inquiry right now. Please try again later.',
        });
      }
    } catch {
      logger.error('Public inquiry submission RPC threw an exception.');
      return res.status(503).json({
        success: false,
        message: 'Unable to submit your inquiry right now. Please try again later.',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Your inquiry has been submitted.',
    });
  });

  return router;
}

export default createPublicInquiriesRouter;
