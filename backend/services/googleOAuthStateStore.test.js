import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  createGoogleOAuthStateStore,
  generateGoogleOAuthState,
  hashGoogleOAuthState,
  InvalidGoogleOAuthStateError,
} from './googleOAuthStateStore.js';

const adminUserId = 'c8f413ab-4e27-47fa-8f02-dbc7d398d29f';
const otherAdminUserId = '00d137c1-c191-4aeb-b4b2-f01d8d79b168';
const statePattern = /^[A-Za-z0-9_-]{43}$/;

function createSupabaseAdminMock() {
  const transactions = new Map();
  const operations = [];

  return {
    transactions,
    operations,
    from(tableName) {
      assert.equal(tableName, 'google_oauth_state_transactions');
      return {
        async insert(row) {
          operations.push({ type: 'insert', row: { ...row } });
          transactions.set(row.state_hash, { ...row, consumed_at: null });
          return { error: null };
        },
        update(values) {
          const filters = {};
          const query = {
            eq(column, value) {
              filters.eq = [column, value];
              return query;
            },
            is(column, value) {
              filters.is = [column, value];
              return query;
            },
            gt(column, value) {
              filters.gt = [column, value];
              return query;
            },
            select(columns) {
              assert.equal(columns, 'admin_user_id');
              return query;
            },
            async maybeSingle() {
              operations.push({
                type: 'consume',
                values: { ...values },
                filters: { ...filters },
              });
              const [hashColumn, stateHash] = filters.eq;
              assert.equal(hashColumn, 'state_hash');
              const [consumedColumn, unconsumedValue] = filters.is;
              assert.equal(consumedColumn, 'consumed_at');
              assert.equal(unconsumedValue, null);
              const [expirationColumn, currentTime] = filters.gt;
              assert.equal(expirationColumn, 'expires_at');
              const transaction = transactions.get(stateHash);

              if (
                !transaction ||
                transaction.consumed_at !== null ||
                Date.parse(transaction.expires_at) <= Date.parse(currentTime)
              ) {
                return { data: null, error: null };
              }

              transaction.consumed_at = values.consumed_at;
              return {
                data: { admin_user_id: transaction.admin_user_id },
                error: null,
              };
            },
          };
          return query;
        },
      };
    },
  };
}

test('generates cryptographically random state values', () => {
  const firstState = generateGoogleOAuthState();
  const secondState = generateGoogleOAuthState();

  assert.match(firstState, statePattern);
  assert.match(secondState, statePattern);
  assert.notEqual(firstState, secondState);
});

test('hashes state as a SHA-256 hexadecimal digest', () => {
  const state = generateGoogleOAuthState();
  const expectedHash = createHash('sha256').update(state, 'utf8').digest('hex');

  assert.equal(hashGoogleOAuthState(state), expectedHash);
  assert.match(hashGoogleOAuthState(state), /^[0-9a-f]{64}$/);
});

test('creates a temporary transaction using only the hashed state', async () => {
  const supabaseAdmin = createSupabaseAdminMock();
  const createdAt = Date.parse('2026-01-02T03:04:05.000Z');
  const store = createGoogleOAuthStateStore(supabaseAdmin, {
    now: () => createdAt,
  });

  const result = await store.create(adminUserId);
  const [insertOperation] = supabaseAdmin.operations;

  assert.match(result.state, statePattern);
  assert.equal(result.expiresAt, '2026-01-02T03:14:05.000Z');
  assert.deepEqual(Object.keys(insertOperation.row).sort(), [
    'admin_user_id',
    'created_at',
    'expires_at',
    'state_hash',
  ]);
  assert.equal(insertOperation.row.admin_user_id, adminUserId);
  assert.equal(insertOperation.row.state_hash, hashGoogleOAuthState(result.state));
  assert.equal(insertOperation.row.created_at, '2026-01-02T03:04:05.000Z');
  assert.equal(
    JSON.stringify(insertOperation.row).includes(result.state),
    false,
  );
});

test('rejects malformed admin IDs before calling Supabase', async () => {
  const supabaseAdmin = createSupabaseAdminMock();
  const store = createGoogleOAuthStateStore(supabaseAdmin);

  await assert.rejects(store.create('not-a-user-id'), TypeError);
  assert.equal(supabaseAdmin.operations.length, 0);
});

test('rejects expired state transactions', async () => {
  const supabaseAdmin = createSupabaseAdminMock();
  let currentTime = Date.parse('2026-01-02T03:04:05.000Z');
  const store = createGoogleOAuthStateStore(supabaseAdmin, {
    now: () => currentTime,
  });
  const { state, expiresAt } = await store.create(adminUserId);
  currentTime = Date.parse(expiresAt);

  await assert.rejects(
    store.consume(state),
    InvalidGoogleOAuthStateError,
  );
});

test('rejects unknown and malformed state values', async () => {
  const store = createGoogleOAuthStateStore(createSupabaseAdminMock());

  await assert.rejects(
    store.consume(generateGoogleOAuthState()),
    InvalidGoogleOAuthStateError,
  );
  await assert.rejects(store.consume('not-a-valid-state'), InvalidGoogleOAuthStateError);
});

test('rejects repeated state consumption', async () => {
  const store = createGoogleOAuthStateStore(createSupabaseAdminMock());
  const { state } = await store.create(adminUserId);

  assert.deepEqual(await store.consume(state), { adminUserId });
  await assert.rejects(
    store.consume(state),
    InvalidGoogleOAuthStateError,
  );
});

test('allows only one of two concurrent consumption attempts', async () => {
  const store = createGoogleOAuthStateStore(createSupabaseAdminMock());
  const { state } = await store.create(adminUserId);

  const results = await Promise.allSettled([
    store.consume(state),
    store.consume(state),
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  const rejection = results.find((result) => result.status === 'rejected');
  assert.ok(rejection.reason instanceof InvalidGoogleOAuthStateError);
});

test('returns the initiating admin ID when consuming a transaction', async () => {
  const store = createGoogleOAuthStateStore(createSupabaseAdminMock());
  const { state } = await store.create(otherAdminUserId);

  assert.deepEqual(await store.consume(state), {
    adminUserId: otherAdminUserId,
  });
});
