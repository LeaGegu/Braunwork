import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import test from 'node:test';
import { createStaffRouter } from './staff.js';

const adminId = '00000000-0000-4000-8000-000000000001';
const staffId = '00000000-0000-4000-8000-000000000002';
const invitedId = '00000000-0000-4000-8000-000000000003';
const token = 'valid-token';
const adminProfile = {
  id: adminId,
  full_name: 'Admin User',
  role: 'admin',
  can_manage_inquiries: true,
  is_active: true,
};
const listedProfile = {
  id: staffId,
  full_name: 'Staff User',
  role: 'staff',
  can_manage_inquiries: false,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
};

function createAdminClient({
  listResult = { data: [listedProfile], error: null },
  inviteResult = { data: { user: { id: invitedId } }, error: null },
  upsertResult,
  upsertError,
  deleteResult = { error: null },
  rpcResult = { data: [listedProfile], error: null },
} = {}) {
  const calls = { list: [], invites: [], upserts: [], deletes: [], rpcs: [] };
  const adminClient = {
    auth: {
      admin: {
        async inviteUserByEmail(email, options) {
          calls.invites.push({ email, options });
          return inviteResult;
        },
        async deleteUser(userId) {
          calls.deletes.push(userId);
          return deleteResult;
        },
      },
    },
    from(table) {
      assert.equal(table, 'staff_profiles');
      return {
        select(fields) {
          calls.list.push({ fields });
          return {
            async order(field, options) {
              calls.list[calls.list.length - 1].order = { field, options };
              return listResult;
            },
          };
        },
        upsert(values, options) {
          calls.upserts.push({ values, options });
          return {
            select(fields) {
              calls.upserts[calls.upserts.length - 1].fields = fields;
              return {
                async single() {
                  if (upsertError) {
                    return { data: null, error: upsertError };
                  }
                  return {
                    data: upsertResult ?? {
                      ...listedProfile,
                      ...values,
                      created_at: listedProfile.created_at,
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
    async rpc(functionName, args) {
      calls.rpcs.push({ functionName, args });
      return rpcResult;
    },
  };
  return { adminClient, calls };
}

async function withStaffServer({
  role = 'admin',
  userId = adminId,
  userResult = { data: { user: { id: userId } }, error: null },
  profileResult = { data: { ...adminProfile, id: userId, role }, error: null },
  adminOptions,
  inviteRedirectTo = 'https://example.test/admin/invite',
  logger = { error() {} },
  run,
}) {
  const { adminClient, calls } = createAdminClient(adminOptions);
  const app = express();
  app.locals.supabase = {
    auth: {
      async getUser(receivedToken) {
        assert.equal(receivedToken, token);
        return userResult;
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
          filters.push({ field, value });
          return this;
        },
        async maybeSingle() {
          assert.deepEqual(filters, [
            { field: 'id', value: userId },
            { field: 'is_active', value: true },
          ]);
          return profileResult;
        },
      };
    },
  });
  app.use(
    '/api/admin/staff',
    createStaffRouter({
      supabaseAdmin: adminClient,
      inviteRedirectTo,
      logger,
    }),
  );
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({
        success: false,
        message: 'Request body must be valid JSON.',
      });
    }
    return next(error);
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    return await run(`http://127.0.0.1:${port}/api/admin/staff`, {
      calls,
      adminClient,
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function authHeaders() {
  return { Authorization: `Bearer ${token}` };
}

function jsonOptions(method, body) {
  return {
    method,
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

test('requires authentication before calling the service-role client', async () => {
  await withStaffServer({
    run: async (url, { calls }) => {
      const response = await fetch(url);
      assert.equal(response.status, 401);
      assert.deepEqual(calls, {
        list: [],
        invites: [],
        upserts: [],
        deletes: [],
        rpcs: [],
      });
    },
  });
});

test('denies staff users access to staff management', async () => {
  await withStaffServer({
    role: 'staff',
    profileResult: {
      data: { ...adminProfile, role: 'staff' },
      error: null,
    },
    run: async (url, { calls }) => {
      const response = await fetch(url, { headers: authHeaders() });
      assert.equal(response.status, 403);
      assert.deepEqual(calls.list, []);
      assert.deepEqual(calls.invites, []);
    },
  });
});

test('admin can list the staff profile fields needed by the console', async () => {
  await withStaffServer({
    run: async (url, { calls }) => {
      const response = await fetch(url, { headers: authHeaders() });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        success: true,
        data: [listedProfile],
      });
      assert.equal(calls.list[0].fields, 'id, full_name, role, can_manage_inquiries, is_active, created_at');
      assert.deepEqual(calls.list[0].order, {
        field: 'created_at',
        options: { ascending: true },
      });
    },
  });
});

test('rejects invalid invitation fields without calling Auth Admin', async () => {
  await withStaffServer({
    run: async (url, { calls }) => {
      const response = await fetch(url, jsonOptions('POST', {
        email: 'not-an-email',
        full_name: 'A User',
        role: 'super_admin',
      }));
      assert.equal(response.status, 400);
      assert.deepEqual(calls.invites, []);
    },
  });
});

test('requires a configured invitation callback before sending email', async () => {
  await withStaffServer({
    inviteRedirectTo: '',
    run: async (url, { calls }) => {
      const response = await fetch(url, jsonOptions('POST', {
        email: 'staff@example.com',
        full_name: 'New Staff',
      }));
      assert.equal(response.status, 503);
      assert.deepEqual(calls.invites, []);
    },
  });
});

test('invites and creates an active staff profile with safe defaults', async () => {
  await withStaffServer({
    run: async (url, { calls }) => {
      const response = await fetch(url, jsonOptions('POST', {
        email: '  STAFF@example.com ',
        full_name: '  New Staff ',
      }));
      assert.equal(response.status, 201);
      const body = await response.json();
      assert.equal(body.data.id, invitedId);
      assert.equal(body.data.role, 'staff');
      assert.equal(body.data.can_manage_inquiries, false);
      assert.equal(body.data.is_active, true);
      assert.deepEqual(calls.invites, [{
        email: 'staff@example.com',
        options: {
          data: { full_name: 'New Staff' },
          redirectTo: 'https://example.test/admin/invite',
        },
      }]);
      assert.deepEqual(calls.upserts[0].values, {
        id: invitedId,
        full_name: 'New Staff',
        role: 'staff',
        can_manage_inquiries: false,
        is_active: true,
      });
      assert.equal(JSON.stringify(body).includes('service_role'), false);
      assert.equal(JSON.stringify(body).includes('access_token'), false);
    },
  });
});

test('allows an admin to invite another administrator', async () => {
  await withStaffServer({
    run: async (url, { calls }) => {
      const response = await fetch(url, jsonOptions('POST', {
        email: 'future.admin@example.com',
        full_name: 'Future Admin',
        role: 'admin',
        can_manage_inquiries: true,
      }));
      assert.equal(response.status, 201);
      assert.equal(calls.upserts[0].values.role, 'admin');
      assert.equal(calls.upserts[0].values.can_manage_inquiries, true);
    },
  });
});

test('returns conflict when the invited email already has an account', async () => {
  await withStaffServer({
    adminOptions: {
      inviteResult: {
        data: { user: null },
        error: { code: 'email_exists', status: 422 },
      },
    },
    run: async (url, { calls }) => {
      const response = await fetch(url, jsonOptions('POST', {
        email: 'staff@example.com',
        full_name: 'Existing Staff',
      }));
      assert.equal(response.status, 409);
      assert.deepEqual(calls.upserts, []);
    },
  });
});

test('rolls back the Auth invitation when profile creation fails', async () => {
  await withStaffServer({
    adminOptions: { upsertError: { code: '23514' } },
    run: async (url, { calls }) => {
      const response = await fetch(url, jsonOptions('POST', {
        email: 'staff@example.com',
        full_name: 'New Staff',
      }));
      assert.equal(response.status, 503);
      assert.deepEqual(calls.deletes, [invitedId]);
      assert.match((await response.json()).message, /could not be completed/i);
    },
  });
});

test('reports when failed invitation cleanup needs administrator attention', async () => {
  await withStaffServer({
    adminOptions: {
      upsertError: { code: '23514' },
      deleteResult: { error: { code: 'auth_delete_failed' } },
    },
    run: async (url) => {
      const response = await fetch(url, jsonOptions('POST', {
        email: 'staff@example.com',
        full_name: 'New Staff',
      }));
      assert.equal(response.status, 503);
      assert.match((await response.json()).message, /cleanup needs administrator attention/i);
    },
  });
});

test('admin profile edits use the atomic last-admin-protected function', async () => {
  await withStaffServer({
    run: async (url, { calls }) => {
      const response = await fetch(
        `${url}/${staffId}`,
        jsonOptions('PATCH', { role: 'admin', can_manage_inquiries: true }),
      );
      assert.equal(response.status, 200);
      assert.deepEqual(calls.rpcs, [{
        functionName: 'admin_update_staff_profile',
        args: {
          p_user_id: staffId,
          p_full_name: null,
          p_role: 'admin',
          p_is_active: null,
          p_can_manage_inquiries: true,
        },
      }]);
    },
  });
});

test('rejects attempts to change the current admin role or permission', async () => {
  await withStaffServer({
    run: async (url, { calls }) => {
      for (const body of [
        { role: 'staff' },
        { can_manage_inquiries: false },
      ]) {
        const response = await fetch(
          `${url}/${adminId}`,
          jsonOptions('PATCH', body),
        );
        assert.equal(response.status, 409);
      }
      assert.deepEqual(calls.rpcs, []);
    },
  });
});

test('rejects attempts to deactivate the current admin', async () => {
  await withStaffServer({
    run: async (url, { calls }) => {
      const response = await fetch(
        `${url}/${adminId}`,
        jsonOptions('PATCH', { is_active: false }),
      );
      assert.equal(response.status, 409);
      assert.deepEqual(calls.rpcs, []);
    },
  });
});

test('recognizes the current user ID regardless of UUID letter case', async () => {
  const uppercaseAdminId = adminId.toUpperCase();
  await withStaffServer({
    run: async (url, { calls }) => {
      const response = await fetch(
        `${url}/${uppercaseAdminId}`,
        jsonOptions('PATCH', { role: 'staff' }),
      );
      assert.equal(response.status, 409);
      assert.deepEqual(calls.rpcs, []);
    },
  });
});

test('returns conflict when the database protects the last active admin', async () => {
  await withStaffServer({
    adminOptions: {
      rpcResult: {
        data: null,
        error: { code: 'BW001' },
      },
    },
    run: async (url) => {
      const response = await fetch(
        `${url}/${staffId}`,
        jsonOptions('PATCH', { role: 'staff', is_active: false }),
      );
      assert.equal(response.status, 409);
      assert.match((await response.json()).message, /at least one active administrator/i);
    },
  });
});

test('validates update identifiers, fields, and values', async () => {
  await withStaffServer({
    run: async (url, { calls }) => {
      const invalidRequests = [
        [`${url}/not-a-uuid`, { role: 'staff' }],
        [`${url}/${staffId}`, { role: 'super_admin' }],
        [`${url}/${staffId}`, { is_active: 'false' }],
        [`${url}/${staffId}`, { id: adminId }],
        [`${url}/${staffId}`, {}],
      ];
      for (const [target, body] of invalidRequests) {
        const response = await fetch(target, jsonOptions('PATCH', body));
        assert.equal(response.status, 400);
      }
      assert.deepEqual(calls.rpcs, []);
    },
  });
});

test('returns not found when the atomic update finds no profile', async () => {
  await withStaffServer({
    adminOptions: { rpcResult: { data: [], error: null } },
    run: async (url) => {
      const response = await fetch(
        `${url}/${staffId}`,
        jsonOptions('PATCH', { is_active: false }),
      );
      assert.equal(response.status, 404);
    },
  });
});

test('does not expose database failure details', async () => {
  await withStaffServer({
    adminOptions: {
      listResult: { data: null, error: { code: '42501', message: 'private detail' } },
    },
    run: async (url) => {
      const response = await fetch(url, { headers: authHeaders() });
      assert.equal(response.status, 503);
      assert.equal((await response.text()).includes('private detail'), false);
    },
  });
});
