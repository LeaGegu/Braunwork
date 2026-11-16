import { createHash, randomBytes } from 'node:crypto';

const TABLE_NAME = 'google_oauth_state_transactions';
export const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class InvalidGoogleOAuthStateError extends Error {
  constructor() {
    super('The Google OAuth state is invalid, expired, or already consumed.');
    this.name = 'InvalidGoogleOAuthStateError';
  }
}

export function generateGoogleOAuthState() {
  return randomBytes(32).toString('base64url');
}

export function hashGoogleOAuthState(state) {
  if (typeof state !== 'string' || !STATE_PATTERN.test(state)) {
    throw new InvalidGoogleOAuthStateError();
  }

  return createHash('sha256').update(state, 'utf8').digest('hex');
}

export function createGoogleOAuthStateStore(supabaseAdmin, { now = Date.now } = {}) {
  if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') {
    throw new TypeError('A Supabase admin client is required.');
  }
  if (typeof now !== 'function') {
    throw new TypeError('The clock must be a function.');
  }

  return {
    async create(adminUserId) {
      if (typeof adminUserId !== 'string' || !UUID_PATTERN.test(adminUserId)) {
        throw new TypeError('A valid initiating admin user ID is required.');
      }

      const createdAtMs = now();
      if (!Number.isFinite(createdAtMs)) {
        throw new TypeError('The clock must return a valid timestamp.');
      }

      const state = generateGoogleOAuthState();
      const expiresAt = new Date(
        createdAtMs + GOOGLE_OAUTH_STATE_TTL_MS,
      ).toISOString();
      const { error } = await supabaseAdmin
        .from(TABLE_NAME)
        .insert({
          state_hash: hashGoogleOAuthState(state),
          admin_user_id: adminUserId,
          created_at: new Date(createdAtMs).toISOString(),
          expires_at: expiresAt,
        });

      if (error) {
        throw new Error('Unable to create the Google OAuth state transaction.', {
          cause: error,
        });
      }

      return { state, expiresAt };
    },

    async consume(state) {
      const stateHash = hashGoogleOAuthState(state);
      const consumedAt = new Date(now()).toISOString();
      const { data, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .update({ consumed_at: consumedAt })
        .eq('state_hash', stateHash)
        .is('consumed_at', null)
        .gt('expires_at', consumedAt)
        .select('admin_user_id')
        .maybeSingle();

      if (error) {
        throw new Error('Unable to consume the Google OAuth state transaction.', {
          cause: error,
        });
      }

      if (!data || typeof data.admin_user_id !== 'string' ||
        !UUID_PATTERN.test(data.admin_user_id)) {
        throw new InvalidGoogleOAuthStateError();
      }

      return { adminUserId: data.admin_user_id };
    },
  };
}
