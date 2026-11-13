import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAdmin } from './requireAdmin.js';

function createResponse() {
  return {
    statusCode: undefined,
    body: undefined,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('allows an admin profile populated by authentication middleware', () => {
  const req = { staffProfile: { role: 'admin' } };
  const res = createResponse();
  let nextCalled = false;

  requireAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, undefined);
});

test('rejects a staff profile with HTTP 403', () => {
  const req = { staffProfile: { role: 'staff' } };
  const res = createResponse();
  let nextCalled = false;

  requireAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    success: false,
    message: 'Admin access is required.',
  });
});

test('ignores roles in request data and rejects when no verified profile exists', () => {
  const req = {
    body: { role: 'admin' },
    query: { role: 'admin' },
    headers: { role: 'admin' },
  };
  const res = createResponse();
  let nextCalled = false;

  requireAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});
