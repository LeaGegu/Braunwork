import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import test from 'node:test';
import { createInquiriesRouter } from './inquiries.js';

const user = { id: '00000000-0000-4000-8000-000000000001' };
const inquiryId = '00000000-0000-4000-8000-000000000002';
const inquiry = {
  id: inquiryId,
  name: 'Customer',
  email: 'customer@example.com',
  phone: null,
  category: 'General',
  subject: 'Project inquiry',
  message: 'Initial question',
  status: 'new',
  assigned_to: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function createQuery(table, result, calls, state) {
  const filters = {};
  let assignmentFilter;
  let updateValues;
  const query = {
    select(fields, options) {
      calls.push({ table, method: 'select', fields, options });
      return this;
    },
    eq(field, value) {
      calls.push({ table, method: 'eq', field, value });
      filters[field] = value;
      return this;
    },
    or(filters) {
      calls.push({ table, method: 'or', filters });
      assignmentFilter = filters;
      return this;
    },
    in(field, values) {
      calls.push({ table, method: 'in', field, values });
      return this;
    },
    order(field, options) {
      calls.push({ table, method: 'order', field, options });
      return this;
    },
    range(from, to) {
      calls.push({ table, method: 'range', from, to });
      return this;
    },
    update(values) {
      calls.push({ table, method: 'update', values });
      updateValues = values;
      return this;
    },
    insert(values) {
      calls.push({ table, method: 'insert', values });
      return this;
    },
    maybeSingle() {
      if (table === 'inquiries' && state?.inquiries) {
        const row = state.inquiries.find(
          (inquiryRow) => inquiryRow.id === filters.id,
        );
        const canUpdate = row && (
          !assignmentFilter ||
          (
            assignmentFilter ===
              `assigned_to.is.null,assigned_to.eq.${state.callerId}` &&
            (row.assigned_to === null || row.assigned_to === state.callerId)
          )
        );

        if (!canUpdate) {
          return Promise.resolve({ data: null, error: null });
        }

        Object.assign(row, updateValues);
        return Promise.resolve({ data: { ...row }, error: null });
      }

      return Promise.resolve(result);
    },
    single() {
      return Promise.resolve(result);
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return query;
}

async function withInquiryServer({
  profile = {
    role: 'admin',
    can_manage_inquiries: false,
    is_active: true,
  },
  userResult = { data: { user }, error: null },
  tableResults = {},
  state,
  clientError,
  run,
}) {
  const calls = [];
  const clientTokens = [];
  const app = express();
  app.locals.supabase = {
    auth: {
      async getUser(token) {
        clientTokens.push(token);
        return userResult;
      },
    },
  };
  app.locals.createAuthenticatedSupabaseClient = (token) => {
    clientTokens.push(token);
    if (clientError) {
      throw clientError;
    }
    return {
      from(table) {
        return createQuery(
          table,
          table === 'staff_profiles'
            ? { data: { id: user.id, ...profile }, error: null }
            : tableResults[table] ?? { data: [], error: null, count: 0 },
          calls,
          state,
        );
      },
    };
  };
  app.use('/api/admin/inquiries', createInquiriesRouter({
    logger: { error() {} },
  }));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
      return res.status(400).json({
        success: false,
        message: 'Request body is invalid.',
      });
    }
    return next(error);
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    return await run(
      `http://127.0.0.1:${port}/api/admin/inquiries`,
      { calls, clientTokens },
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function authHeaders() {
  return { Authorization: 'Bearer verified-access-token' };
}

function inquiryCalls(calls) {
  return calls.filter((call) => call.table !== 'staff_profiles');
}

function jsonOptions(method, body) {
  return {
    method,
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

test('requires a valid bearer token before inquiry access', async () => {
  await withInquiryServer({ run: async (url, { calls }) => {
    const response = await fetch(url);
    assert.equal(response.status, 401);
    assert.deepEqual(calls, []);
  } });
});

test('denies staff without inquiry permission and skips inquiry queries', async () => {
  await withInquiryServer({
    profile: { role: 'staff', can_manage_inquiries: false, is_active: true },
    run: async (url, { calls }) => {
      const response = await fetch(url, { headers: authHeaders() });
      assert.equal(response.status, 403);
      assert.deepEqual(inquiryCalls(calls), []);
    },
  });
});

test('lists inquiries with validated pagination using the caller JWT', async () => {
  await withInquiryServer({
    profile: { role: 'staff', can_manage_inquiries: true, is_active: true },
    tableResults: {
      inquiries: { data: [inquiry], error: null, count: 21 },
    },
    run: async (url, { calls, clientTokens }) => {
      const response = await fetch(`${url}?page=2&limit=10`, {
        headers: authHeaders(),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        success: true,
        data: [{ ...inquiry, assigned_to_name: null }],
        pagination: { page: 2, limit: 10, total: 21, totalPages: 3 },
      });
      assert.deepEqual(calls.find((call) => call.method === 'range'), {
        table: 'inquiries',
        method: 'range',
        from: 10,
        to: 19,
      });
      assert.ok(clientTokens.includes('verified-access-token'));
    },
  });
});

test('lists assigned staff names using only the caller-visible ID/name directory', async () => {
  const assignedInquiry = {
    ...inquiry,
    assigned_to: user.id,
  };
  await withInquiryServer({
    tableResults: {
      inquiries: { data: [assignedInquiry], error: null, count: 1 },
      inquiry_assignee_directory: {
        data: [{ id: user.id, full_name: 'Verified Staff Name' }],
        error: null,
      },
    },
    run: async (url, { calls }) => {
      const response = await fetch(url, { headers: authHeaders() });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        success: true,
        data: [{ ...assignedInquiry, assigned_to_name: 'Verified Staff Name' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      assert.deepEqual(
        calls.find((call) => call.table === 'inquiry_assignee_directory' && call.method === 'select'),
        {
          table: 'inquiry_assignee_directory',
          method: 'select',
          fields: 'id, full_name',
          options: undefined,
        },
      );
      assert.deepEqual(
        calls.find((call) => call.table === 'inquiry_assignee_directory' && call.method === 'in'),
        {
          table: 'inquiry_assignee_directory',
          method: 'in',
          field: 'id',
          values: [user.id],
        },
      );
    },
  });
});

test('hides assignee-directory database failures', async () => {
  await withInquiryServer({
    tableResults: {
      inquiries: { data: [{ ...inquiry, assigned_to: user.id }], error: null, count: 1 },
      inquiry_assignee_directory: {
        data: null,
        error: { code: '42501', message: 'private database details' },
      },
    },
    run: async (url) => {
      const response = await fetch(url, { headers: authHeaders() });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        success: false,
        message: 'Unable to access inquiry data right now.',
      });
    },
  });
});

test('rejects invalid pagination and malformed inquiry IDs', async () => {
  await withInquiryServer({ run: async (url, { calls }) => {
    const invalidPage = await fetch(`${url}?page=0`, {
      headers: authHeaders(),
    });
    assert.equal(invalidPage.status, 400);

    const invalidId = await fetch(`${url}/not-a-uuid`, {
      headers: authHeaders(),
    });
    assert.equal(invalidId.status, 400);
    assert.deepEqual(inquiryCalls(calls), []);
  } });
});

test('retrieves an inquiry and its messages', async () => {
  const messages = [{
    id: '00000000-0000-4000-8000-000000000003',
    inquiry_id: inquiryId,
    sender_id: user.id,
    message_type: 'internal_note',
    body: 'Follow up with customer',
    sender_email: null,
    recipient_email: null,
    created_at: '2026-01-02T00:00:00.000Z',
  }];
  await withInquiryServer({
    tableResults: {
      inquiries: { data: inquiry, error: null },
      inquiry_messages: { data: messages, error: null },
    },
    run: async (url, { calls }) => {
      const response = await fetch(`${url}/${inquiryId}`, {
        headers: authHeaders(),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        success: true,
        inquiry,
        messages,
      });
      assert.match(
        calls.find((call) =>
          call.table === 'inquiries' && call.method === 'select'
        ).fields,
        /assigned_to/,
      );
    },
  });
});

test('returns not found when RLS exposes no matching inquiry', async () => {
  await withInquiryServer({
    tableResults: {
      inquiries: { data: null, error: null },
    },
    run: async (url) => {
      const response = await fetch(`${url}/${inquiryId}`, {
        headers: authHeaders(),
      });
      assert.equal(response.status, 404);
    },
  });
});

test('admin can update status regardless of can_manage_inquiries', async () => {
  const updatedInquiry = { ...inquiry, status: 'waiting' };
  await withInquiryServer({
    tableResults: {
      inquiries: { data: updatedInquiry, error: null },
    },
    run: async (url, { calls }) => {
      const response = await fetch(
        `${url}/${inquiryId}/status`,
        jsonOptions('PATCH', { status: 'waiting' }),
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        success: true,
        inquiry: updatedInquiry,
      });
      const update = calls.find((call) => call.method === 'update');
      assert.equal(update.values.status, 'waiting');
      assert.equal('role' in update.values, false);
    },
  });
});

test('assigns an inquiry to the authenticated user', async () => {
  const updatedInquiry = { ...inquiry, assigned_to: user.id };
  await withInquiryServer({
    tableResults: {
      inquiries: { data: updatedInquiry, error: null },
    },
    run: async (url, { calls, clientTokens }) => {
      const response = await fetch(
        `${url}/${inquiryId}/assignment`,
        jsonOptions('PATCH', { assigned_to: user.id }),
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        success: true,
        inquiry: updatedInquiry,
      });
      assert.deepEqual(calls.find((call) => call.method === 'update').values, {
        assigned_to: user.id,
      });
      assert.ok(clientTokens.includes('verified-access-token'));
    },
  });
});

test('unassigns an unassigned inquiry when assigned_to is null', async () => {
  const updatedInquiry = { ...inquiry, assigned_to: null };
  await withInquiryServer({
    tableResults: {
      inquiries: { data: updatedInquiry, error: null },
    },
    run: async (url, { calls }) => {
      const response = await fetch(
        `${url}/${inquiryId}/assignment`,
        jsonOptions('PATCH', { assigned_to: null }),
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        success: true,
        inquiry: updatedInquiry,
      });
      assert.deepEqual(calls.find((call) => call.method === 'update').values, {
        assigned_to: null,
      });
      assert.deepEqual(calls.find((call) => call.method === 'or'), {
        table: 'inquiries',
        method: 'or',
        filters: `assigned_to.is.null,assigned_to.eq.${user.id}`,
      });
    },
  });
});

test('unassigns an inquiry assigned to the authenticated user', async () => {
  const updatedInquiry = { ...inquiry, assigned_to: null };
  await withInquiryServer({
    tableResults: {
      inquiries: { data: updatedInquiry, error: null },
    },
    run: async (url, { calls }) => {
      const response = await fetch(
        `${url}/${inquiryId}/assignment`,
        jsonOptions('PATCH', { assigned_to: null }),
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        success: true,
        inquiry: updatedInquiry,
      });
      assert.deepEqual(calls.find((call) => call.method === 'update').values, {
        assigned_to: null,
      });
      assert.ok(calls.some((call) =>
        call.method === 'or' &&
        call.filters === `assigned_to.is.null,assigned_to.eq.${user.id}`
      ));
    },
  });
});

test('rejects unassigning an inquiry assigned to another staff member', async () => {
  const otherStaffId = '00000000-0000-4000-8000-000000000099';
  const state = {
    callerId: user.id,
    inquiries: [{ ...inquiry, assigned_to: otherStaffId }],
  };
  await withInquiryServer({
    state,
    run: async (url, { calls, clientTokens }) => {
      const response = await fetch(
        `${url}/${inquiryId}/assignment`,
        jsonOptions('PATCH', { assigned_to: null }),
      );
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), {
        success: false,
        message: 'This inquiry is assigned to another staff member or is no longer available to unassign.',
      });
      assert.ok(calls.some((call) =>
        call.method === 'or' &&
        call.filters === `assigned_to.is.null,assigned_to.eq.${user.id}`
      ));
      assert.deepEqual(calls.find((call) => call.method === 'update').values, {
        assigned_to: null,
      });
      assert.ok(clientTokens.includes('verified-access-token'));
      assert.equal(state.inquiries[0].assigned_to, otherStaffId);
    },
  });
});

test('denies staff without inquiry permission on assignment endpoint', async () => {
  await withInquiryServer({
    profile: { role: 'staff', can_manage_inquiries: false, is_active: true },
    run: async (url, { calls }) => {
      const response = await fetch(
        `${url}/${inquiryId}/assignment`,
        jsonOptions('PATCH', { assigned_to: user.id }),
      );
      assert.equal(response.status, 403);
      assert.deepEqual(inquiryCalls(calls), []);
    },
  });
});

test('requires a valid bearer token on the assignment endpoint', async () => {
  await withInquiryServer({ run: async (url, { calls }) => {
    const response = await fetch(`${url}/${inquiryId}/assignment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: user.id }),
    });
    assert.equal(response.status, 401);
    assert.deepEqual(inquiryCalls(calls), []);
  } });
});

test('rejects invalid assignment inquiry IDs and request bodies', async () => {
  await withInquiryServer({ run: async (url, { calls }) => {
    const invalidInquiryId = await fetch(
      `${url}/not-a-uuid/assignment`,
      jsonOptions('PATCH', { assigned_to: user.id }),
    );
    const missingAssignment = await fetch(
      `${url}/${inquiryId}/assignment`,
      jsonOptions('PATCH', {}),
    );
    const extraField = await fetch(
      `${url}/${inquiryId}/assignment`,
      jsonOptions('PATCH', { assigned_to: user.id, status: 'resolved' }),
    );
    const invalidAssignedId = await fetch(
      `${url}/${inquiryId}/assignment`,
      jsonOptions('PATCH', { assigned_to: 'not-a-uuid' }),
    );

    assert.equal(invalidInquiryId.status, 400);
    assert.equal(missingAssignment.status, 400);
    assert.equal(extraField.status, 400);
    assert.equal(invalidAssignedId.status, 400);
    assert.deepEqual(inquiryCalls(calls), []);
  } });
});

test('does not allow assigning an inquiry to another user', async () => {
  await withInquiryServer({ run: async (url, { calls }) => {
    const response = await fetch(
      `${url}/${inquiryId}/assignment`,
      jsonOptions('PATCH', {
        assigned_to: '00000000-0000-4000-8000-000000000099',
      }),
    );
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      success: false,
      message: 'You may only assign inquiries to yourself.',
    });
    assert.deepEqual(inquiryCalls(calls), []);
  } });
});

test('returns not found when assignment query matches no inquiry', async () => {
  await withInquiryServer({
    tableResults: {
      inquiries: { data: null, error: null },
    },
    run: async (url) => {
      const response = await fetch(
        `${url}/${inquiryId}/assignment`,
        jsonOptions('PATCH', { assigned_to: user.id }),
      );
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), {
        success: false,
        message: 'Inquiry not found.',
      });
    },
  });
});

test('hides assignment database failures', async () => {
  await withInquiryServer({
    tableResults: {
      inquiries: {
        data: null,
        error: { code: '42501', message: 'private assignment database error' },
      },
    },
    run: async (url) => {
      const response = await fetch(
        `${url}/${inquiryId}/assignment`,
        jsonOptions('PATCH', { assigned_to: user.id }),
      );
      assert.equal(response.status, 503);
      const body = await response.text();
      assert.equal(body.includes('private assignment database error'), false);
      assert.deepEqual(JSON.parse(body), {
        success: false,
        message: 'Unable to access inquiry data right now.',
      });
    },
  });
});

test('rejects unsupported statuses and user-supplied update fields', async () => {
  await withInquiryServer({ run: async (url, { calls }) => {
    const invalidStatus = await fetch(
      `${url}/${inquiryId}/status`,
      jsonOptions('PATCH', { status: 'closed' }),
    );
    const extraField = await fetch(
      `${url}/${inquiryId}/status`,
      jsonOptions('PATCH', { status: 'resolved', assigned_to: user.id }),
    );
    assert.equal(invalidStatus.status, 400);
    assert.equal(extraField.status, 400);
    assert.deepEqual(inquiryCalls(calls), []);
  } });
});

test('creates only an internal note and derives its sender from auth', async () => {
  const note = {
    id: '00000000-0000-4000-8000-000000000004',
    inquiry_id: inquiryId,
    sender_id: user.id,
    message_type: 'internal_note',
    body: 'Internal follow-up',
    created_at: '2026-01-02T00:00:00.000Z',
  };
  await withInquiryServer({
    profile: { role: 'staff', can_manage_inquiries: true, is_active: true },
    tableResults: {
      inquiry_messages: { data: note, error: null },
    },
    run: async (url, { calls }) => {
      const response = await fetch(
        `${url}/${inquiryId}/messages`,
        jsonOptions('POST', { body: ' Internal follow-up ' }),
      );
      assert.equal(response.status, 201);
      assert.deepEqual(await response.json(), {
        success: true,
        message: note,
      });
      assert.deepEqual(calls.find((call) => call.method === 'insert').values, {
        inquiry_id: inquiryId,
        sender_id: user.id,
        message_type: 'internal_note',
        body: 'Internal follow-up',
      });
    },
  });
});

test('rejects arbitrary message fields and empty internal notes', async () => {
  await withInquiryServer({ run: async (url, { calls }) => {
    const forgedMessage = await fetch(
      `${url}/${inquiryId}/messages`,
      jsonOptions('POST', {
        body: 'Not an internal note',
        sender_id: user.id,
        message_type: 'outbound',
      }),
    );
    const emptyNote = await fetch(
      `${url}/${inquiryId}/messages`,
      jsonOptions('POST', { body: '  ' }),
    );
    assert.equal(forgedMessage.status, 400);
    assert.equal(emptyNote.status, 400);
    assert.deepEqual(inquiryCalls(calls), []);
  } });
});

test('hides database errors and returns a safe service-unavailable response', async () => {
  await withInquiryServer({
    tableResults: {
      inquiries: {
        data: null,
        error: { code: '42501', message: 'private database details' },
        count: null,
      },
    },
    run: async (url) => {
      const response = await fetch(url, { headers: authHeaders() });
      assert.equal(response.status, 503);
      const text = await response.text();
      assert.equal(text.includes('private database details'), false);
      assert.deepEqual(JSON.parse(text), {
        success: false,
        message: 'Unable to access inquiry data right now.',
      });
    },
  });
});

test('hides database errors from status updates and internal-note inserts', async () => {
  for (const scenario of [
    {
      endpoint: `${inquiryId}/status`,
      method: 'PATCH',
      body: { status: 'resolved' },
      table: 'inquiries',
    },
    {
      endpoint: `${inquiryId}/messages`,
      method: 'POST',
      body: { body: 'Private note' },
      table: 'inquiry_messages',
    },
  ]) {
    await withInquiryServer({
      tableResults: {
        [scenario.table]: {
          data: null,
          error: { code: '42501', message: 'private database details' },
        },
      },
      run: async (url) => {
        const response = await fetch(
          `${url}/${scenario.endpoint}`,
          jsonOptions(scenario.method, scenario.body),
        );
        assert.equal(response.status, 503);
        assert.equal(
          (await response.text()).includes('private database details'),
          false,
        );
      },
    });
  }
});
