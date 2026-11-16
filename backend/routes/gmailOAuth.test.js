import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import test from 'node:test';
import { createGmailOAuthRouter } from './gmailOAuth.js';

const adminId = 'c8f413ab-4e27-47fa-8f02-dbc7d398d29f';
const state = 'A'.repeat(43);
const authorizationCode = 'authorization-code-for-test';
const accessToken = 'access-token-for-test';
const refreshToken = 'refresh-token-for-test';
const frontendOrigin = 'http://localhost:5173';
const stateCookie = 'braunwork_gmail_oauth_state';
const config = {
  isConfigured: true,
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'http://localhost:5000/api/gmail/oauth/callback',
  allowedMailbox: 'braunworktesting@gmail.com',
  frontendOrigin,
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
  ],
};

function createContext(options = {}) {
  const calls = {
    stateCreate: [],
    stateConsume: [],
    tokenSave: [],
    tokenGet: [],
    tokenDelete: [],
    connectionSave: [],
    connectionRemove: 0,
    tokenRevocations: [],
    authorizationOptions: [],
    tokenExchange: [],
    credentials: [],
    logs: [],
  };
  let connection = options.connection ?? null;
  let consumed = false;
  const logger = {
    error(...args) {
      calls.logs.push(args);
    },
  };

  const tokenStore = {
    async save(value) {
      calls.tokenSave.push(value);
      return { reference: 'mock-reference', version: 'mock-version-new' };
    },
    async get(reference, version) {
      calls.tokenGet.push({ reference, version });
      return options.existingRefreshToken ?? refreshToken;
    },
    async delete(reference, version) {
      calls.tokenDelete.push({ reference, version });
    },
  };
  const connectionStore = {
    async get() {
      return connection;
    },
    async save(values) {
      calls.connectionSave.push(values);
      if (options.connectionSaveError) {
        throw new Error('Sensitive test metadata error.');
      }
      connection = {
        ...values,
        secret_reference: values.secret_reference,
        secret_version: values.secret_version,
      };
      return connection;
    },
    async remove() {
      calls.connectionRemove += 1;
      const previous = connection;
      connection = null;
      return previous;
    },
  };
  const stateStore = {
    async create(userId) {
      calls.stateCreate.push(userId);
      return {
        state,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      };
    },
    async consume(value) {
      calls.stateConsume.push(value);
      if (
        options.stateFailure ||
        consumed ||
        value !== state
      ) {
        throw new Error('Rejected test state.');
      }
      consumed = true;
      return { adminUserId: options.transactionAdminId ?? adminId };
    },
  };
  const supabaseAdmin = {
    from(table) {
      assert.equal(table, 'staff_profiles');
      const filters = [];
      return {
        select(fields) {
          assert.equal(fields, 'id');
          return this;
        },
        eq(field, value) {
          filters.push([field, value]);
          return this;
        },
        async maybeSingle() {
          calls.adminChecks = filters;
          if (options.adminLookupError) {
            return { data: null, error: options.adminLookupError };
          }
          const expected = [
            ['id', options.transactionAdminId ?? adminId],
            ['role', 'admin'],
            ['is_active', true],
          ];
          assert.deepEqual(filters, expected);
          if (options.adminActive === false || options.adminRole === 'staff') {
            return { data: null, error: null };
          }
          return { data: { id: options.transactionAdminId ?? adminId }, error: null };
        },
      };
    },
  };
  const oauthClient = {
    generateAuthUrl(authOptions) {
      calls.authorizationOptions.push(authOptions);
      return `https://accounts.google.test/auth?state=${authOptions.state}`;
    },
    async getToken(code) {
      calls.tokenExchange.push(code);
      if (options.tokenExchangeError) {
        throw new Error('Sensitive test exchange error.');
      }
      return {
        tokens: options.tokens ?? {
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      };
    },
    setCredentials(credentials) {
      calls.credentials.push(credentials);
    },
    async revokeToken(token) {
      calls.tokenRevocations.push(token);
      if (options.revokeError) {
        throw new Error('Sensitive test revoke error.');
      }
    },
  };
  const app = express();
  app.locals.supabase = {
    auth: {
      async getUser(token) {
        if (token !== 'valid-access-token') {
          return { data: { user: null }, error: new Error('unauthorized') };
        }
        return {
          data: { user: { id: options.userId ?? adminId } },
          error: null,
        };
      },
    },
  };
  app.locals.createAuthenticatedSupabaseClient = () => ({
    from(table) {
      assert.equal(table, 'staff_profiles');
      const filters = [];
      return {
        select() {
          return this;
        },
        eq(field, value) {
          filters.push([field, value]);
          return this;
        },
        async maybeSingle() {
          assert.deepEqual(filters, [
            ['id', options.userId ?? adminId],
            ['is_active', true],
          ]);
          if (options.activeStaff === false) {
            return { data: null, error: null };
          }
          return {
            data: {
              id: options.userId ?? adminId,
              role: options.role ?? 'admin',
              is_active: true,
            },
            error: null,
          };
        },
      };
    },
  });
  app.use(
    '/api',
    createGmailOAuthRouter({
      supabaseAdmin,
      stateStore,
      connectionStore,
      tokenStore,
      oauthConfig: options.oauthConfig ?? config,
      oauthClientFactory: () => oauthClient,
      gmailClientFactory: () => ({
        users: {
          async getProfile() {
            if (options.profileError) {
              throw new Error('Sensitive test profile error.');
            }
            return {
              data: {
                emailAddress: options.mailboxEmail ??
                  config.allowedMailbox,
              },
            };
          },
        },
      }),
      logger,
      isProduction: options.isProduction ?? false,
    }),
  );

  return {
    app,
    calls,
    stateStore,
    connectionStore,
    get connection() {
      return connection;
    },
    async withServer(run) {
      const server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const { port } = server.address();
      try {
        return await run(`http://127.0.0.1:${port}/api`);
      } finally {
        server.closeAllConnections();
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    },
  };
}

function stateCookieHeader(cookieValue = state) {
  return `${stateCookie}=${cookieValue}`;
}

async function requestCallback(baseUrl, {
  queryState = state,
  cookieState = state,
  code = authorizationCode,
} = {}) {
  const query = new URLSearchParams({ state: queryState, code });
  return fetch(
    `${baseUrl}/gmail/oauth/callback?${query.toString()}`,
    {
      headers: { Cookie: stateCookieHeader(cookieState) },
      redirect: 'manual',
    },
  );
}

test('OAuth start requires an active admin and returns only the authorization URL', async () => {
  const context = createContext();

  await context.withServer(async (baseUrl) => {
    const unauthenticated = await fetch(`${baseUrl}/admin/gmail/oauth/start`, {
      method: 'POST',
    });
    assert.equal(unauthenticated.status, 401);

    const staffContext = createContext({ role: 'staff' });
    await staffContext.withServer(async (staffBaseUrl) => {
      const staffResponse = await fetch(
        `${staffBaseUrl}/admin/gmail/oauth/start`,
        {
          method: 'POST',
          headers: { Authorization: 'Bearer valid-access-token' },
        },
      );
      assert.equal(staffResponse.status, 403);
    });

    const response = await fetch(`${baseUrl}/admin/gmail/oauth/start`, {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-access-token' },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ['authorizationUrl']);
    assert.match(body.authorizationUrl, /^https:\/\/accounts\.google\.test/);
    assert.deepEqual(context.calls.stateCreate, [adminId]);
    assert.equal(context.calls.authorizationOptions[0].access_type, 'offline');
    assert.deepEqual(context.calls.authorizationOptions[0].scope, config.scopes);
    assert.equal(
      context.calls.authorizationOptions[0].state,
      state,
    );
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Path=\/api\/gmail\/oauth\/callback/i);
    assert.doesNotMatch(cookie, /;\s*Secure/i);
  });
});

test('OAuth start sets Secure on the state cookie in production', async () => {
  const context = createContext({ isProduction: true });

  await context.withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/admin/gmail/oauth/start`, {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-access-token' },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /;\s*Secure/i);
  });
});

test('OAuth start fails safely when required integration configuration is missing', async () => {
  const context = createContext({
    oauthConfig: { ...config, isConfigured: false },
  });

  await context.withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/admin/gmail/oauth/start`, {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-access-token' },
    });
    assert.equal(response.status, 503);
    assert.deepEqual(context.calls.stateCreate, []);
  });
});

test('callback rejects a state-cookie mismatch without consuming the transaction', async () => {
  const context = createContext();

  await context.withServer(async (baseUrl) => {
    const response = await requestCallback(baseUrl, {
      cookieState: 'B'.repeat(43),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(context.calls.stateConsume, []);
    assert.deepEqual(context.calls.tokenExchange, []);
    assert.match(response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
    assert.match(await response.text(), /success: false/);
  });
});

test('callback rejects expired and replayed state before exchanging a code', async () => {
  const expiredContext = createContext({ stateFailure: true });
  await expiredContext.withServer(async (baseUrl) => {
    const response = await requestCallback(baseUrl);
    assert.equal(response.status, 503);
    assert.deepEqual(expiredContext.calls.tokenExchange, []);
  });

  const replayContext = createContext();
  await replayContext.withServer(async (baseUrl) => {
    const first = await requestCallback(baseUrl);
    assert.equal(first.status, 200);
    const replay = await requestCallback(baseUrl);
    assert.equal(replay.status, 503);
    assert.equal(replayContext.calls.tokenExchange.length, 1);
  });
});

test('callback rechecks that the initiating admin remains active', async () => {
  const context = createContext({ adminActive: false });

  await context.withServer(async (baseUrl) => {
    const response = await requestCallback(baseUrl);
    assert.equal(response.status, 403);
    assert.deepEqual(context.calls.tokenExchange, []);
  });
});

test('callback consumes state and closes safely when Google denies authorization', async () => {
  const context = createContext();

  await context.withServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/gmail/oauth/callback?state=${state}&error=access_denied`,
      { headers: { Cookie: stateCookieHeader() } },
    );
    assert.equal(response.status, 400);
    assert.deepEqual(context.calls.stateConsume, [state]);
    assert.deepEqual(context.calls.tokenExchange, []);
    assert.match(await response.text(), /success: false/);
  });
});

test('callback rejects a mailbox mismatch and does not store its token', async () => {
  const context = createContext({
    mailboxEmail: 'someone-else@example.com',
  });

  await context.withServer(async (baseUrl) => {
    const response = await requestCallback(baseUrl);
    assert.equal(response.status, 403);
    assert.deepEqual(context.calls.tokenSave, []);
    assert.deepEqual(context.calls.connectionSave, []);
    assert.deepEqual(context.calls.tokenRevocations, [refreshToken]);
  });
});

test('callback revokes an unpersisted refresh token after a Google profile error', async () => {
  const context = createContext({ profileError: true });

  await context.withServer(async (baseUrl) => {
    const response = await requestCallback(baseUrl);
    const body = await response.text();
    assert.equal(response.status, 503);
    assert.deepEqual(context.calls.tokenRevocations, [refreshToken]);
    assert.doesNotMatch(body, new RegExp(refreshToken));
    assert.doesNotMatch(JSON.stringify(context.calls.logs), new RegExp(refreshToken));
    assert.doesNotMatch(JSON.stringify(context.calls.logs), /Sensitive test/);
  });
});

test('first connection requires a refresh token', async () => {
  const context = createContext({
    tokens: { access_token: accessToken },
  });

  await context.withServer(async (baseUrl) => {
    const response = await requestCallback(baseUrl);
    assert.equal(response.status, 400);
    assert.deepEqual(context.calls.tokenSave, []);
    assert.deepEqual(context.calls.connectionSave, []);
    assert.deepEqual(context.calls.tokenRevocations, [accessToken]);
  });
});

test('metadata save failure removes and revokes the newly stored token', async () => {
  const context = createContext({ connectionSaveError: true });

  await context.withServer(async (baseUrl) => {
    const response = await requestCallback(baseUrl);
    const body = await response.text();
    assert.equal(response.status, 503);
    assert.deepEqual(context.calls.tokenDelete, [{
      reference: 'mock-reference',
      version: 'mock-version-new',
    }]);
    assert.deepEqual(context.calls.tokenRevocations, [refreshToken]);
    assert.doesNotMatch(body, new RegExp(refreshToken));
    assert.doesNotMatch(JSON.stringify(context.calls.logs), new RegExp(refreshToken));
  });
});

test('reconnection preserves the existing refresh token when Google omits one', async () => {
  const existingConnection = {
    mailbox_email: config.allowedMailbox,
    secret_reference: 'mock-reference',
    secret_version: 'mock-version-old',
    connected_by: adminId,
    connected_at: '2026-01-01T00:00:00.000Z',
  };
  const context = createContext({
    connection: existingConnection,
    existingRefreshToken: 'existing-refresh-token',
    tokens: { access_token: accessToken },
  });

  await context.withServer(async (baseUrl) => {
    const response = await requestCallback(baseUrl);
    assert.equal(response.status, 200);
    assert.deepEqual(context.calls.tokenGet, [{
      reference: 'mock-reference',
      version: 'mock-version-old',
    }]);
    assert.deepEqual(context.calls.tokenSave, []);
    assert.equal(
      context.calls.connectionSave[0].secret_version,
      'mock-version-old',
    );
    assert.equal(
      context.calls.credentials[0].refresh_token,
      'existing-refresh-token',
    );
  });
});

test('disconnect revokes and removes stored credentials and metadata', async () => {
  const context = createContext({
    connection: {
      mailbox_email: config.allowedMailbox,
      secret_reference: 'mock-reference',
      secret_version: 'mock-version-old',
      connected_by: adminId,
      connected_at: '2026-01-01T00:00:00.000Z',
    },
  });

  await context.withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/admin/gmail/connection`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-access-token' },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { connected: false });
    assert.deepEqual(context.calls.tokenRevocations, [refreshToken]);
    assert.deepEqual(context.calls.tokenDelete, [{
      reference: 'mock-reference',
      version: 'mock-version-old',
    }]);
    assert.equal(context.calls.connectionRemove, 1);
    assert.equal(context.connection, null);
  });
});

test('disconnect clears local credentials but reports failed Google revocation', async () => {
  const context = createContext({
    connection: {
      mailbox_email: config.allowedMailbox,
      secret_reference: 'mock-reference',
      secret_version: 'mock-version-old',
      connected_by: adminId,
      connected_at: '2026-01-01T00:00:00.000Z',
    },
    revokeError: true,
  });

  await context.withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/admin/gmail/connection`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-access-token' },
    });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      success: false,
      connected: false,
      message: 'The connection was removed locally, but Google revocation could not be confirmed.',
    });
    assert.equal(context.calls.connectionRemove, 1);
    assert.equal(context.calls.tokenDelete.length, 1);
    assert.equal(context.connection, null);
    assert.doesNotMatch(JSON.stringify(context.calls.logs), new RegExp(refreshToken));
  });
});

test('responses and logs never contain access or refresh tokens', async () => {
  const context = createContext();

  await context.withServer(async (baseUrl) => {
    const callback = await requestCallback(baseUrl);
    const html = await callback.text();
    assert.equal(callback.status, 200);
    assert.doesNotMatch(html, new RegExp(accessToken));
    assert.doesNotMatch(html, new RegExp(refreshToken));
    assert.doesNotMatch(html, new RegExp(authorizationCode));
    assert.doesNotMatch(JSON.stringify(context.calls.logs), new RegExp(accessToken));
    assert.doesNotMatch(JSON.stringify(context.calls.logs), new RegExp(refreshToken));
    assert.doesNotMatch(
      JSON.stringify(context.calls.logs),
      new RegExp(authorizationCode),
    );
    assert.doesNotMatch(JSON.stringify(context.calls.logs), new RegExp(state));

    const status = await fetch(`${baseUrl}/admin/gmail/connection`, {
      headers: { Authorization: 'Bearer valid-access-token' },
    });
    const body = await status.json();
    assert.equal(body.connected, true);
    assert.equal(body.mailboxEmail, config.allowedMailbox);
    assert.equal(Object.hasOwn(body, 'secret_reference'), false);
    assert.equal(Object.hasOwn(body, 'secret_version'), false);
    assert.doesNotMatch(JSON.stringify(body), new RegExp(accessToken));
    assert.doesNotMatch(JSON.stringify(body), new RegExp(refreshToken));
  });
});

test('inactive admin cannot initiate an OAuth flow', async () => {
  const context = createContext({ activeStaff: false });

  await context.withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/admin/gmail/oauth/start`, {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-access-token' },
    });
    assert.equal(response.status, 403);
    assert.deepEqual(context.calls.stateCreate, []);
  });
});
