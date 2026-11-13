import express from 'express';
import {
  createAuthenticatedSupabaseClient,
  createSupabaseClient,
  supabase,
} from './config/supabase.js';
import { requireAuth } from './middleware/requireAuth.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.locals.supabase = supabase;
app.locals.createSupabaseClient = createSupabaseClient;
app.locals.createAuthenticatedSupabaseClient = createAuthenticatedSupabaseClient;

app.use(express.json());

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (
    typeof email !== 'string' ||
    email.trim().length === 0 ||
    typeof password !== 'string' ||
    password.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'A valid email and password are required.',
    });
  }

  let data;
  try {
    const loginSupabase = app.locals.createSupabaseClient();
    const result = await loginSupabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (result.error || !result.data.user || !result.data.session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    data = result.data;
  } catch {
    return res.status(503).json({
      success: false,
      message: 'Authentication service is temporarily unavailable.',
    });
  }

  let staffProfile;
  try {
    const authenticatedSupabase = app.locals.createAuthenticatedSupabaseClient(
      data.session.access_token,
    );
    const { data: profile, error } = await authenticatedSupabase
      .from('staff_profiles')
      .select('id, full_name, role, can_manage_inquiries, is_active')
      .eq('id', data.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      return res.status(503).json({
        success: false,
        message: 'Unable to verify staff profile access.',
      });
    }

    staffProfile = profile;
  } catch {
    return res.status(503).json({
      success: false,
      message: 'Unable to verify staff profile access.',
    });
  }

  if (!staffProfile) {
    return res.status(403).json({
      success: false,
      message: 'Unable to complete sign-in.',
    });
  }

  const response = {
    success: true,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    staffProfile,
  };

  if (data.session.expires_at !== undefined) {
    response.expires_at = data.session.expires_at;
  }
  if (data.session.expires_in !== undefined) {
    response.expires_in = data.session.expires_in;
  }

  return res.status(200).json(response);
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Braunwork backend is running!',
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
    },
    staffProfile: req.staffProfile,
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
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Request body must be valid JSON.',
    });
  }

  return next(error);
});

app.listen(PORT, () => {
  console.log(`Braunwork backend is running on port ${PORT}`);
});
