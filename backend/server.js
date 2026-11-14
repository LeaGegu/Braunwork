import express from 'express';
import {
  createAuthenticatedSupabaseClient,
  createSupabaseClient,
  supabase,
} from './config/supabase.js';
import {
  createPublicInquirySubmitter,
  createSupabaseAdminClient,
} from './config/supabaseAdmin.js';
import { createAuthRouter } from './routes/auth.js';
import { createInquiriesRouter } from './routes/inquiries.js';
import { createPublicInquiriesRouter } from './routes/publicInquiries.js';

const app = express();
const PORT = process.env.PORT || 5000;
const supabaseAdmin = createSupabaseAdminClient();

function getPositiveIntegerEnv(name, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  if (!/^[1-9]\d*$/.test(value) || Number(value) > maximum) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}.`);
  }

  return Number(value);
}

app.locals.supabase = supabase;
app.locals.createSupabaseClient = createSupabaseClient;
app.locals.createAuthenticatedSupabaseClient = createAuthenticatedSupabaseClient;

app.use(
  '/api/inquiries',
  createPublicInquiriesRouter({
    submitPublicInquiry: createPublicInquirySubmitter(supabaseAdmin),
    rateLimitWindowMs: getPositiveIntegerEnv(
      'PUBLIC_INQUIRY_RATE_LIMIT_WINDOW_MS',
      15 * 60 * 1000,
      2_147_483_647,
    ),
    rateLimitMax: getPositiveIntegerEnv(
      'PUBLIC_INQUIRY_RATE_LIMIT_MAX',
      5,
    ),
  }),
);
app.use(
  '/api/auth',
  createAuthRouter({
    loginRateLimitWindowMs: getPositiveIntegerEnv(
      'AUTH_LOGIN_RATE_LIMIT_WINDOW_MS',
      15 * 60 * 1000,
      2_147_483_647,
    ),
    loginRateLimitMax: getPositiveIntegerEnv(
      'AUTH_LOGIN_RATE_LIMIT_MAX',
      5,
    ),
  }),
);
app.use('/api/admin/inquiries', createInquiriesRouter());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Braunwork backend is running!',
  });
});

app.get('/api/supabase/health', async (req, res) => {
  const failureResponse = {
    success: false,
    message:
      'Supabase Data API query failed. Check Data API availability, environment configuration, and table or RLS permissions.',
  };

  try {
    const { error } = await app.locals.supabase
      .from('staff_profiles')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42501') {
        return res.status(503).json({
          success: false,
          message:
            'Supabase Data API query failed (42501: insufficient privilege). Check table SELECT grants and RLS configuration.',
        });
      }

      return res.status(503).json(failureResponse);
    }

    return res.status(200).json({
      success: true,
      message: 'Supabase Data API query succeeded.',
    });
  } catch {
    return res.status(503).json(failureResponse);
  }
});

app.use((error, req, res, next) => {
  if (
    error.type === 'entity.parse.failed' ||
    error.type === 'entity.too.large'
  ) {
    return res.status(400).json({
      success: false,
      message: error.type === 'entity.too.large'
        ? 'Request body exceeds the allowed size.'
        : 'Request body must be valid JSON.',
    });
  }

  return next(error);
});

app.listen(PORT, () => {
  console.log(`Braunwork backend is running on port ${PORT}`);
});
