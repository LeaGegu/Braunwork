import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import { google } from 'googleapis';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

const STATE_COOKIE_NAME = 'braunwork_gmail_oauth_state';
const STATE_COOKIE_PATH = '/api/gmail/oauth/callback';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function logFailure(logger, operation) {
  logger.error(`Google OAuth ${operation} failed.`);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidFrontendOrigin(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      url.origin === value &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isReadyConfiguration(config) {
  return (
    config?.isConfigured === true &&
    isNonEmptyString(config.clientId) &&
    isNonEmptyString(config.clientSecret) &&
    isNonEmptyString(config.redirectUri) &&
    typeof config.allowedMailbox === 'string' &&
    emailPattern.test(config.allowedMailbox) &&
    isValidFrontendOrigin(config.frontendOrigin) &&
    Array.isArray(config.scopes) &&
    config.scopes.length > 0 &&
    config.scopes.every(isNonEmptyString)
  );
}

function getCookieValue(header, name) {
  if (typeof header !== 'string') {
    return null;
  }

  const prefix = `${name}=`;
  for (const part of header.split(';')) {
    const cookie = part.trim();
    if (cookie.startsWith(prefix)) {
      return cookie.slice(prefix.length);
    }
  }
  return null;
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') {
    return false;
  }

  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer);
}

function clearStateCookie(res, secure) {
  res.clearCookie(STATE_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: STATE_COOKIE_PATH,
  });
}

function escapeScriptString(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function sendPopupResult(res, frontendOrigin, success, status = 200) {
  if (!isValidFrontendOrigin(frontendOrigin)) {
    return res.status(503).json({
      success: false,
      message: 'Google OAuth is not configured.',
    });
  }

  const targetOrigin = escapeScriptString(frontendOrigin);
  const successLiteral = success ? 'true' : 'false';
  res.set({
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
  return res
    .status(status)
    .type('html')
    .send(`<!doctype html><html><head><meta charset="utf-8"><title>Gmail connection</title></head><body><p>${success ? 'Gmail connection complete.' : 'Gmail connection could not be completed.'}</p><script>if (window.opener) { window.opener.postMessage({ type: 'braunwork:gmail-oauth', success: ${successLiteral} }, ${targetOrigin}); } window.close();</script></body></html>`);
}

function createOAuthClient(config) {
  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  );
}

function getTokenStore(tokenStore, createTokenStore) {
  const store = tokenStore ?? createTokenStore?.();
  if (
    !store ||
    typeof store.save !== 'function' ||
    typeof store.get !== 'function' ||
    typeof store.delete !== 'function'
  ) {
    throw new Error('Google refresh-token storage is not configured.');
  }
  return store;
}

function safeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function revokeToken(oauthClient, token) {
  if (!isNonEmptyString(token)) {
    throw new Error('Google token revocation is unavailable.');
  }
  await oauthClient.revokeToken(token);
}

export function createGmailOAuthRouter({
  supabaseAdmin,
  stateStore,
  connectionStore,
  tokenStore,
  createTokenStore,
  oauthConfig,
  oauthClientFactory = createOAuthClient,
  gmailClientFactory = (oauthClient) =>
    google.gmail({ version: 'v1', auth: oauthClient }),
  logger = console,
  isProduction = process.env.NODE_ENV === 'production',
} = {}) {
  const router = express.Router();
  const secureCookie = isProduction;

  router.post(
    '/admin/gmail/oauth/start',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      if (!isReadyConfiguration(oauthConfig) || !stateStore) {
        return res.status(503).json({
          success: false,
          message: 'Google OAuth is not fully configured.',
        });
      }

      try {
        await connectionStore.get();
        getTokenStore(tokenStore, createTokenStore);
        const { state, expiresAt } = await stateStore.create(req.user.id);
        const oauthClient = oauthClientFactory(oauthConfig);
        const authorizationUrl = oauthClient.generateAuthUrl({
          access_type: 'offline',
          include_granted_scopes: true,
          prompt: 'consent',
          scope: oauthConfig.scopes,
          state,
        });
        const maxAge = Math.max(0, Date.parse(expiresAt) - Date.now());
        res.cookie(STATE_COOKIE_NAME, state, {
          httpOnly: true,
          sameSite: 'lax',
          secure: secureCookie,
          maxAge,
          path: STATE_COOKIE_PATH,
        });
        return res.status(200).json({ authorizationUrl });
      } catch {
        logFailure(logger, 'authorization start');
        return res.status(503).json({
          success: false,
          message: 'Unable to start Google authorization.',
        });
      }
    },
  );

  router.get('/gmail/oauth/callback', async (req, res) => {
    clearStateCookie(res, secureCookie);
    const frontendOrigin = oauthConfig?.frontendOrigin;
    const fail = (status = 400) =>
      sendPopupResult(res, frontendOrigin, false, status);
    let callbackOAuthClient;
    let unpersistedRefreshToken;
    let unpersistedAccessToken;

    try {
      const state = typeof req.query.state === 'string'
        ? req.query.state
        : '';
      const cookieState = getCookieValue(
        req.headers.cookie,
        STATE_COOKIE_NAME,
      );
      if (!constantTimeEqual(state, cookieState)) {
        return fail(400);
      }

      const transaction = await stateStore.consume(state);
      if (
        typeof transaction?.adminUserId !== 'string' ||
        !uuidPattern.test(transaction.adminUserId)
      ) {
        return fail(400);
      }

      const { data: adminProfile, error: profileError } = await supabaseAdmin
        .from('staff_profiles')
        .select('id')
        .eq('id', transaction.adminUserId)
        .eq('role', 'admin')
        .eq('is_active', true)
        .maybeSingle();
      if (profileError) {
        logFailure(logger, 'admin verification');
        return fail(503);
      }
      if (!adminProfile) {
        return fail(403);
      }

      if (typeof req.query.error === 'string' || !isReadyConfiguration(oauthConfig)) {
        return fail(400);
      }
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      if (!code) {
        return fail(400);
      }

      const store = getTokenStore(tokenStore, createTokenStore);
      const existingConnection = await connectionStore.get();
      callbackOAuthClient = oauthClientFactory(oauthConfig);
      const exchange = await callbackOAuthClient.getToken(code);
      const tokens = exchange?.tokens ?? exchange;
      if (!isNonEmptyString(tokens?.access_token)) {
        return fail(400);
      }
      unpersistedRefreshToken = isNonEmptyString(tokens.refresh_token)
        ? tokens.refresh_token
        : null;
      unpersistedAccessToken = tokens.access_token;

      const existingRefreshToken = existingConnection
        ? await store.get(
          existingConnection.secret_reference,
          existingConnection.secret_version,
        )
        : null;
      const refreshToken = unpersistedRefreshToken
        ? unpersistedRefreshToken
        : existingRefreshToken;
      callbackOAuthClient.setCredentials({
        ...tokens,
        ...(refreshToken ? { refresh_token: refreshToken } : {}),
      });

      const gmail = gmailClientFactory(callbackOAuthClient);
      const { data: profile } = await gmail.users.getProfile({ userId: 'me' });
      const mailboxEmail = safeEmail(profile?.emailAddress);
      if (
        !emailPattern.test(mailboxEmail) ||
        mailboxEmail !== safeEmail(oauthConfig.allowedMailbox)
      ) {
        try {
          await revokeToken(
            callbackOAuthClient,
            unpersistedRefreshToken ?? unpersistedAccessToken,
          );
        } catch {
          logFailure(logger, 'mailbox mismatch cleanup');
        }
        unpersistedRefreshToken = null;
        unpersistedAccessToken = null;
        return fail(403);
      }
      if (!refreshToken) {
        try {
          await revokeToken(callbackOAuthClient, unpersistedAccessToken);
        } catch {
          logFailure(logger, 'missing refresh-token cleanup');
        }
        unpersistedAccessToken = null;
        return fail(400);
      }

      let savedSecret = null;
      if (unpersistedRefreshToken) {
        savedSecret = await store.save(unpersistedRefreshToken);
      }

      const secret = savedSecret ?? {
        reference: existingConnection.secret_reference,
        version: existingConnection.secret_version,
      };
      try {
        await connectionStore.save({
          mailbox_email: mailboxEmail,
          secret_reference: secret.reference,
          secret_version: secret.version,
          scopes: oauthConfig.scopes,
          connected_by: transaction.adminUserId,
          connected_at: new Date().toISOString(),
        });
      } catch (error) {
        if (savedSecret) {
          try {
            await store.delete(savedSecret.reference, savedSecret.version);
          } catch {
            logFailure(logger, 'orphaned secret cleanup');
          }
          try {
            await revokeToken(
              callbackOAuthClient,
              unpersistedRefreshToken,
            );
          } catch {
            logFailure(logger, 'authorization rollback');
          }
          unpersistedRefreshToken = null;
          unpersistedAccessToken = null;
        }
        throw error;
      }
      unpersistedRefreshToken = null;
      unpersistedAccessToken = null;

      if (
        savedSecret &&
        existingConnection?.secret_reference &&
        existingConnection?.secret_version
      ) {
        try {
          await store.delete(
            existingConnection.secret_reference,
            existingConnection.secret_version,
          );
        } catch {
          logFailure(logger, 'previous secret cleanup');
        }
      }

      return sendPopupResult(res, frontendOrigin, true);
    } catch {
      const cleanupToken =
        unpersistedRefreshToken ?? unpersistedAccessToken;
      if (cleanupToken && callbackOAuthClient) {
        try {
          await revokeToken(callbackOAuthClient, cleanupToken);
        } catch {
          logFailure(logger, 'unpersisted token cleanup');
        }
      }
      logFailure(logger, 'callback');
      return fail(503);
    }
  });

  router.get(
    '/admin/gmail/connection',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const connection = await connectionStore.get();
        return res.status(200).json({
          connected: Boolean(connection),
          ...(connection
            ? {
              mailboxEmail: connection.mailbox_email,
              connectedAt: connection.connected_at,
            }
            : {}),
        });
      } catch {
        logFailure(logger, 'connection status');
        return res.status(503).json({
          success: false,
          message: 'Unable to retrieve Gmail connection status.',
        });
      }
    },
  );

  router.delete(
    '/admin/gmail/connection',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      let connection;
      try {
        connection = await connectionStore.get();
        if (!connection) {
          return res.status(200).json({ connected: false });
        }
      } catch {
        logFailure(logger, 'disconnect lookup');
        return res.status(503).json({
          success: false,
          message: 'Unable to disconnect the Gmail mailbox.',
        });
      }

      let store;
      try {
        store = getTokenStore(tokenStore, createTokenStore);
      } catch {
        logFailure(logger, 'disconnect storage setup');
        return res.status(503).json({
          success: false,
          message: 'Unable to disconnect the Gmail mailbox.',
        });
      }

      try {
        await connectionStore.remove();
      } catch {
        logFailure(logger, 'disconnect metadata removal');
        return res.status(503).json({
          success: false,
          message: 'Unable to disconnect the Gmail mailbox.',
        });
      }

      let revocationConfirmed = false;
      try {
        const refreshToken = await store.get(
          connection.secret_reference,
          connection.secret_version,
        );
        const oauthClient = oauthClientFactory(oauthConfig);
        await revokeToken(oauthClient, refreshToken);
        revocationConfirmed = true;
      } catch {
        logFailure(logger, 'Google token revocation');
      }

      try {
        await store.delete(
          connection.secret_reference,
          connection.secret_version,
        );
      } catch {
        logFailure(logger, 'local credential removal');
        return res.status(503).json({
          success: false,
          connected: false,
          message: 'The connection was removed, but credential cleanup needs attention.',
        });
      }

      if (!revocationConfirmed) {
        return res.status(502).json({
          success: false,
          connected: false,
          message: 'The connection was removed locally, but Google revocation could not be confirmed.',
        });
      }
      return res.status(200).json({ connected: false });
    },
  );

  return router;
}
