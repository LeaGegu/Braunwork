import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import test from 'node:test';
import { createAuthRouter } from './auth.js';

const user = { id: 'user-123', email: 'staff@example.com' };
const session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
};
const staffProfile = {
  id: user.id,
  full_name: 'Staff User',
  role: 'admin',
  can_manage_inquiries: true,
  is_active: true,
};

function createProfileClient(
  profileResult = { data: staffProfile, error: null },
) {
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    async maybeSingle() {
      return profileResult;
    },
  };
  return { from: () => query };
}

async function withAuthServer({
  loginResult = { data: { user, session }, error: null },
  loginError,
  refreshResult = { data: { user, session }, error: null },
  refreshException,
  setSessionResult = { data: { user, session }, error: null },
  signOutResult = { error: null },
  signOutException,
  profileResult = { data: staffProfile, error: null },
  profileError,
  tokenResult = { data: { user }, error: null },
  loginRateLimitWindowMs,
  loginRateLimitMax,
} = {}, run) {
  let loginCalls = 0;
  let signInArguments;
  const authCalls = {
    refresh: [],
    setSession: [],
    signOut: [],
  };
  const app = express();
  app.locals.createSupabaseClient = () => ({
    auth: {
      async signInWithPassword(credentials) {
        loginCalls += 1;
        signInArguments = credentials;
        if (loginError) {
          throw loginError;
        }
        return loginResult;
      },
      async refreshSession(credentials) {
        authCalls.refresh.push(credentials);
        if (refreshException) {
          throw refreshException;
        }
        return refreshResult;
      },
      async setSession(credentials) {
        authCalls.setSession.push(credentials);
        return setSessionResult;
      },
      async signOut(options) {
        authCalls.signOut.push(options);
        if (signOutException) {
          throw signOutException;
        }
        return signOutResult;
      },
    },
  });
  app.locals.supabase = {
    auth: {
      async getUser() {
        return tokenResult;
      },
    },
  };
  app.locals.createAuthenticatedSupabaseClient = () => {
    if (profileError) {
      throw profileError;
    }
    return createProfileClient(profileResult);
  };
  app.use(
    '/api/auth',
    createAuthRouter({ loginRateLimitWindowMs, loginRateLimitMax }),
  );

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    return await run(
      `http://127.0.0.1:${port}/api/auth`,
      () => loginCalls,
      () => signInArguments,
      authCalls,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function postJson(url, body, endpoint = 'login', headers = {}) {
  return fetch(`${url}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('login rejects missing credentials', async () => {
  await withAuthServer({}, async (url, getLoginCalls) => {
    const response = await postJson(url, {});
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      success: false,
      message: 'A valid email and password are required.',
    });
    assert.equal(getLoginCalls(), 0);
  });
});

test('login rejects invalid credentials without exposing provider errors', async () => {
  await withAuthServer({
    loginResult: {
      data: { user: null, session: null },
      error: { message: 'sensitive provider detail' },
    },
  }, async (url) => {
    const response = await postJson(url, {
      email: 'staff@example.com',
      password: 'wrong-password',
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      success: false,
      message: 'Invalid email or password.',
    });
  });
});

test('login returns session details for an active staff profile', async () => {
  await withAuthServer({}, async (url, getLoginCalls, getSignInArguments) => {
    const response = await postJson(url, {
      email: ' staff@example.com ',
      password: 'correct-password',
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, {
      success: true,
      user,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      staffProfile,
    });
    assert.deepEqual(getSignInArguments(), {
      email: user.email,
      password: 'correct-password',
    });
  });
});

test('login denies users without an active staff profile', async () => {
  await withAuthServer({
    profileResult: { data: null, error: null },
  }, async (url) => {
    const response = await postJson(url, {
      email: user.email,
      password: 'correct-password',
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      success: false,
      message: 'Unable to complete sign-in.',
    });
  });
});

test('login hides staff profile lookup failures', async () => {
  await withAuthServer(
    {
      profileResult: {
        data: null,
        error: { message: 'private database detail' },
      },
    },
    async (url) => {
      const response = await postJson(url, {
        email: user.email,
        password: 'correct-password',
      });
      assert.equal(response.status, 503);
      assert.equal(
        (await response.text()).includes('private database detail'),
        false,
      );
    },
  );
});

test('auth/me rejects a missing authorization token', async () => {
  await withAuthServer({}, async (url) => {
    const response = await fetch(`${url}/me`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).success, false);
  });
});

test('auth/me rejects an invalid Bearer token', async () => {
  await withAuthServer({
    tokenResult: { data: { user: null }, error: { message: 'invalid token' } },
  }, async (url) => {
    const response = await fetch(`${url}/me`, {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    assert.equal(response.status, 401);
  });
});

test('auth/me returns the authenticated user and active staff profile', async () => {
  await withAuthServer({}, async (url) => {
    const response = await fetch(`${url}/me`, {
      headers: { Authorization: 'Bearer valid-token' },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      user,
      staffProfile,
    });
  });
});

test('auth/me safely reports active profile lookup failures', async () => {
  await withAuthServer(
    {
      profileResult: {
        data: null,
        error: { message: 'private database detail' },
      },
    },
    async (url) => {
      const response = await fetch(`${url}/me`, {
        headers: { Authorization: 'Bearer valid-token' },
      });
      assert.equal(response.status, 503);
      assert.equal(
        (await response.text()).includes('private database detail'),
        false,
      );
    },
  );
});

test('login rate limit blocks attempts after the configured maximum', async () => {
  await withAuthServer({
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMax: 2,
    loginResult: {
      data: { user: null, session: null },
      error: { message: 'invalid credentials' },
    },
  }, async (url, getLoginCalls) => {
    const credentials = {
      email: user.email,
      password: 'wrong-password',
    };
    assert.equal((await postJson(url, credentials)).status, 401);
    assert.equal((await postJson(url, credentials)).status, 401);

    const limited = await postJson(url, credentials);
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), {
      success: false,
      message: 'Too many login attempts. Please try again later.',
    });
    assert.equal(getLoginCalls(), 2);
  });
});

test('refresh returns new tokens after verifying the active staff profile', async () => {
  const refreshedSession = {
    ...session,
    access_token: 'new-access-token',
    refresh_token: 'new-refresh-token',
  };
  await withAuthServer(
    { refreshResult: { data: { user, session: refreshedSession }, error: null } },
    async (url, _getLoginCalls, _getSignInArguments, authCalls) => {
      const response = await postJson(
        url,
        { refresh_token: 'old-refresh-token' },
        'refresh',
      );

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        success: true,
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: session.expires_in,
      });
      assert.deepEqual(authCalls.refresh, [
        { refresh_token: 'old-refresh-token' },
      ]);
    },
  );
});

test('refresh rejects a missing refresh token', async () => {
  await withAuthServer({}, async (url, _calls, _args, authCalls) => {
    const response = await postJson(url, {}, 'refresh');
    assert.equal(response.status, 400);
    assert.equal(authCalls.refresh.length, 0);
  });
});

test('refresh rejects invalid or expired tokens without provider details', async () => {
  await withAuthServer(
    {
      refreshResult: {
        data: { user: null, session: null },
        error: { status: 400, message: 'private auth provider error' },
      },
    },
    async (url) => {
      const response = await postJson(
        url,
        { refresh_token: 'invalid-refresh-token' },
        'refresh',
      );
      assert.equal(response.status, 401);
      assert.equal(
        (await response.text()).includes('private auth provider error'),
        false,
      );
    },
  );
});

test('refresh does not return tokens when the staff profile is inactive', async () => {
  const refreshedSession = {
    ...session,
    access_token: 'new-access-token',
    refresh_token: 'new-refresh-token',
  };
  await withAuthServer(
    {
      refreshResult: { data: { user, session: refreshedSession }, error: null },
      profileResult: { data: null, error: null },
    },
    async (url) => {
      const response = await postJson(
        url,
        { refresh_token: 'old-refresh-token' },
        'refresh',
      );
      assert.equal(response.status, 403);
      assert.equal((await response.text()).includes('new-access-token'), false);
    },
  );
});

test('refresh safely handles Supabase errors and thrown exceptions', async (t) => {
  await t.test('Supabase error', async () => {
    await withAuthServer(
      {
        refreshResult: {
          data: { user: null, session: null },
          error: { status: 503, message: 'private auth provider error' },
        },
      },
      async (url) => {
        const response = await postJson(
          url,
          { refresh_token: 'refresh-token' },
          'refresh',
        );
        assert.equal(response.status, 503);
        assert.equal(
          (await response.text()).includes('private auth provider error'),
          false,
        );
      },
    );
  });

  await t.test('thrown exception', async () => {
    await withAuthServer(
      { refreshException: new Error('private thrown error') },
      async (url) => {
        const response = await postJson(
          url,
          { refresh_token: 'refresh-token' },
          'refresh',
        );
        assert.equal(response.status, 503);
        assert.equal(
          (await response.text()).includes('private thrown error'),
          false,
        );
      },
    );
  });
});

test('logout requires a valid access token and a refresh token', async () => {
  await withAuthServer({}, async (url, _calls, _args, authCalls) => {
    const missingAccessToken = await postJson(url, {
      refresh_token: 'refresh-token',
    }, 'logout');
    assert.equal(missingAccessToken.status, 401);

    const missingRefreshToken = await postJson(
      url,
      {},
      'logout',
      { Authorization: 'Bearer access-token' },
    );
    assert.equal(missingRefreshToken.status, 400);
    assert.equal(authCalls.setSession.length, 0);
  });
});

test('logout revokes the current Supabase session successfully', async () => {
  await withAuthServer({}, async (url, _calls, _args, authCalls) => {
    const response = await postJson(
      url,
      { refresh_token: 'refresh-token' },
      'logout',
      { Authorization: 'Bearer access-token' },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      message: 'Session ended.',
    });
    assert.deepEqual(authCalls.setSession, [{
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    }]);
    assert.deepEqual(authCalls.signOut, [{ scope: 'local' }]);
  });
});

test('logout rejects a mismatched or invalid Supabase session', async () => {
  await withAuthServer(
    {
      setSessionResult: {
        data: { user: { id: 'another-user' }, session },
        error: null,
      },
    },
    async (url, _calls, _args, authCalls) => {
      const response = await postJson(
        url,
        { refresh_token: 'another-users-refresh-token' },
        'logout',
        { Authorization: 'Bearer access-token' },
      );

      assert.equal(response.status, 401);
      assert.equal(authCalls.signOut.length, 0);
    },
  );
});

test('logout safely reports session verification errors', async () => {
  await withAuthServer(
    {
      setSessionResult: {
        data: { user: null, session: null },
        error: { status: 503, message: 'private session verification error' },
      },
    },
    async (url) => {
      const response = await postJson(
        url,
        { refresh_token: 'refresh-token' },
        'logout',
        { Authorization: 'Bearer access-token' },
      );
      assert.equal(response.status, 503);
      assert.equal(
        (await response.text()).includes('private session verification error'),
        false,
      );
    },
  );
});

test('logout does not claim success when Supabase fails', async (t) => {
  await t.test('returned error', async () => {
    await withAuthServer(
      {
        signOutResult: {
          error: { message: 'private revocation error' },
        },
      },
      async (url) => {
        const response = await postJson(
          url,
          { refresh_token: 'refresh-token' },
          'logout',
          { Authorization: 'Bearer access-token' },
        );
        assert.equal(response.status, 503);
        assert.equal(
          (await response.text()).includes('private revocation error'),
          false,
        );
      },
    );
  });

  await t.test('thrown exception', async () => {
    await withAuthServer(
      { signOutException: new Error('private revocation exception') },
      async (url) => {
        const response = await postJson(
          url,
          { refresh_token: 'refresh-token' },
          'logout',
          { Authorization: 'Bearer access-token' },
        );
        assert.equal(response.status, 503);
        assert.equal(
          (await response.text()).includes('private revocation exception'),
          false,
        );
      },
    );
  });
});
