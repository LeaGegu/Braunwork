import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  requireAuth,
  requireAuthenticatedUser,
} from '../middleware/requireAuth.js';

export function createAuthRouter({
  loginRateLimitWindowMs = 15 * 60 * 1000,
  loginRateLimitMax = 5,
} = {}) {
  const router = express.Router();

  router.post(
    '/login',
    rateLimit({
      windowMs: loginRateLimitWindowMs,
      limit: loginRateLimitMax,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (req, res) =>
        res.status(429).json({
          success: false,
          message: 'Too many login attempts. Please try again later.',
        }),
    }),
    express.json(),
    async (req, res) => {
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
        const loginSupabase = req.app.locals.createSupabaseClient();
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
        const authenticatedSupabase =
          req.app.locals.createAuthenticatedSupabaseClient(
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
    },
  );

  router.post('/refresh', express.json(), async (req, res) => {
    const refreshToken = req.body?.refresh_token;
    if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'A refresh token is required.',
      });
    }

    let data;
    try {
      const result = await req.app.locals
        .createSupabaseClient()
        .auth.refreshSession({ refresh_token: refreshToken.trim() });

      if (result.error) {
        const serviceUnavailable =
          typeof result.error.status !== 'number' ||
          result.error.status >= 500;
        return res.status(serviceUnavailable ? 503 : 401).json({
          success: false,
          message: serviceUnavailable
            ? 'Authentication service is temporarily unavailable.'
            : 'The refresh token is invalid or expired.',
        });
      }

      if (!result.data.user || !result.data.session) {
        return res.status(401).json({
          success: false,
          message: 'The refresh token is invalid or expired.',
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
      const authenticatedSupabase =
        req.app.locals.createAuthenticatedSupabaseClient(
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
        message: 'An active staff profile is required.',
      });
    }

    const response = {
      success: true,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    };
    if (data.session.expires_at !== undefined) {
      response.expires_at = data.session.expires_at;
    }
    if (data.session.expires_in !== undefined) {
      response.expires_in = data.session.expires_in;
    }

    return res.status(200).json(response);
  });

  router.post(
    '/logout',
    express.json(),
    requireAuthenticatedUser,
    async (req, res) => {
      const refreshToken = req.body?.refresh_token;
      if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'A refresh token is required to end the session.',
        });
      }

      try {
        const auth = req.app.locals.createSupabaseClient().auth;
        const { data, error } = await auth.setSession({
          access_token: req.accessToken,
          refresh_token: refreshToken.trim(),
        });

        if (error) {
          const serviceUnavailable =
            typeof error.status !== 'number' || error.status >= 500;
          return res.status(serviceUnavailable ? 503 : 401).json({
            success: false,
            message: serviceUnavailable
              ? 'Unable to verify the session right now.'
              : 'The session is invalid or expired.',
          });
        }

        if (!data.session || data.user?.id !== req.user.id) {
          return res.status(401).json({
            success: false,
            message: 'The session is invalid or expired.',
          });
        }

        const signOutResult = await auth.signOut({ scope: 'local' });
        if (signOutResult.error) {
          return res.status(503).json({
            success: false,
            message: 'Unable to end the session right now.',
          });
        }
      } catch {
        return res.status(503).json({
          success: false,
          message: 'Unable to end the session right now.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Session ended.',
      });
    },
  );

  router.get('/me', requireAuth, (req, res) => {
    res.status(200).json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
      },
      staffProfile: req.staffProfile,
    });
  });

  return router;
}

export default createAuthRouter;
