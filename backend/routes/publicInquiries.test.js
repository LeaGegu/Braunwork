import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import test from 'node:test';
import {
  createPublicInquiriesRouter,
} from './publicInquiries.js';
import { createPublicInquirySubmitter } from '../config/supabaseAdmin.js';

const validInquiry = {
  name: '  Jane Customer ',
  email: '  JANE@example.com ',
  category: 'General',
  subject: '  Project question ',
  message: '  I would like to learn more. ',
};

async function withServer(options, run) {
  const app = express();
  app.use(
    '/api/inquiries',
    createPublicInquiriesRouter({
      logger: { error() {} },
      ...options,
    }),
  );
  app.use(express.json());
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({
        success: false,
        message: 'Request body must be valid JSON.',
      });
    }
    if (error.type === 'entity.too.large') {
      return res.status(400).json({
        success: false,
        message: 'Request body exceeds the allowed size.',
      });
    }
    return next(error);
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    return await run(`http://127.0.0.1:${port}/api/inquiries`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function postJson(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('submits a normalized inquiry through the trusted RPC', async () => {
  let rpcCall;
  const adminClient = {
    async rpc(functionName, args) {
      rpcCall = { functionName, args };
      return { data: 'inquiry-id', error: null };
    },
  };
  const submitPublicInquiry = createPublicInquirySubmitter(adminClient);

  await withServer({ submitPublicInquiry }, async (url) => {
    const response = await postJson(url, {
      ...validInquiry,
      phone: '  +1 555 0100 ',
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      success: true,
      message: 'Your inquiry has been submitted.',
    });
  });

  assert.deepEqual(rpcCall, {
    functionName: 'submit_public_inquiry',
    args: {
      p_name: 'Jane Customer',
      p_email: 'jane@example.com',
      p_phone: '+1 555 0100',
      p_category: 'General',
      p_subject: 'Project question',
      p_message: 'I would like to learn more.',
    },
  });
});

test('accepts a successful void RPC without exposing database internals', async () => {
  let rpcCall;
  const adminClient = {
    async rpc(functionName, args) {
      rpcCall = { functionName, args };
      return { data: null, error: null };
    },
  };
  const submitPublicInquiry = createPublicInquirySubmitter(adminClient);

  await withServer({ submitPublicInquiry }, async (url) => {
    const response = await postJson(url, validInquiry);
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(body, {
      success: true,
      message: 'Your inquiry has been submitted.',
    });
    assert.equal(JSON.stringify(body).includes('database'), false);
    assert.equal(JSON.stringify(body).includes('internal'), false);
  });

  assert.deepEqual(rpcCall, {
    functionName: 'submit_public_inquiry',
    args: {
      p_name: 'Jane Customer',
      p_email: 'jane@example.com',
      p_phone: null,
      p_category: 'General',
      p_subject: 'Project question',
      p_message: 'I would like to learn more.',
    },
  });
});

test('rejects missing required fields without calling Supabase', async () => {
  let called = false;
  await withServer({
    submitPublicInquiry: async () => {
      called = true;
      return { error: null };
    },
  }, async (url) => {
    const response = await postJson(url, { ...validInquiry, subject: ' ' });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).success, false);
  });
  assert.equal(called, false);
});

test('rejects an invalid email address', async () => {
  await withServer({
    submitPublicInquiry: async () => ({ error: null }),
  }, async (url) => {
    const response = await postJson(url, {
      ...validInquiry,
      email: 'not-an-email',
    });
    assert.equal(response.status, 400);
  });
});

test('rejects excessively long input', async () => {
  await withServer({
    submitPublicInquiry: async () => ({ error: null }),
  }, async (url) => {
    const response = await postJson(url, {
      ...validInquiry,
      message: 'x'.repeat(5001),
    });
    assert.equal(response.status, 400);
  });
});

test('rejects database-controlled and unknown fields', async () => {
  await withServer({
    submitPublicInquiry: async () => ({ error: null }),
  }, async (url) => {
    const response = await postJson(url, {
      ...validInquiry,
      status: 'resolved',
    });
    assert.equal(response.status, 400);
  });
});

test('rejects invalid JSON and non-object request bodies', async () => {
  await withServer({
    submitPublicInquiry: async () => ({ error: null }),
  }, async (url) => {
    const malformed = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid',
    });
    assert.equal(malformed.status, 400);

    const arrayBody = await postJson(url, [validInquiry]);
    assert.equal(arrayBody.status, 400);
  });
});

test('rejects a request body that exceeds the JSON parser limit', async () => {
  await withServer({
    submitPublicInquiry: async () => ({ error: null }),
  }, async (url) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'x'.repeat(110_000) }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      success: false,
      message: 'Request body exceeds the allowed size.',
    });
  });
});

test('returns 429 after the configured request limit', async () => {
  await withServer({
    submitPublicInquiry: async () => ({ error: null }),
    rateLimitWindowMs: 60_000,
    rateLimitMax: 1,
  }, async (url) => {
    const first = await postJson(url, validInquiry);
    const second = await postJson(url, validInquiry);
    assert.equal(first.status, 201);
    assert.equal(second.status, 429);
  });
});

test('does not expose Supabase RPC errors', async () => {
  await withServer({
    submitPublicInquiry: async () => ({
      error: { message: 'sensitive database details' },
    }),
  }, async (url) => {
    const response = await postJson(url, validInquiry);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      success: false,
      message: 'Unable to submit your inquiry right now. Please try again later.',
    });
  });
});

test('does not expose a thrown RPC exception', async () => {
  await withServer({
    submitPublicInquiry: async () => {
      throw new Error('sensitive database exception details');
    },
  }, async (url) => {
    const response = await postJson(url, validInquiry);
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(body, {
      success: false,
      message: 'Unable to submit your inquiry right now. Please try again later.',
    });
    assert.equal(
      JSON.stringify(body).includes('sensitive database exception details'),
      false,
    );
  });
});

test('converts an empty optional phone value to null', async () => {
  let receivedArguments;
  await withServer({
    submitPublicInquiry: async (args) => {
      receivedArguments = args;
      return { error: null };
    },
  }, async (url) => {
    const response = await postJson(url, { ...validInquiry, phone: ' ' });
    assert.equal(response.status, 201);
  });
  assert.equal(receivedArguments.p_phone, null);
});
