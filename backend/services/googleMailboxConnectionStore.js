const TABLE_NAME = 'google_mailbox_connections';
const CONNECTION_KEY = 'shared';
const CONNECTION_FIELDS =
  'connection_key, mailbox_email, secret_reference, secret_version, scopes, connected_by, connected_at, updated_at';

export function createGoogleMailboxConnectionStore(supabaseAdmin) {
  if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') {
    throw new TypeError('A Supabase admin client is required.');
  }

  return {
    async get() {
      const { data, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .select(CONNECTION_FIELDS)
        .eq('connection_key', CONNECTION_KEY)
        .maybeSingle();
      if (error) {
        throw new Error('Unable to read Google mailbox connection metadata.', {
          cause: error,
        });
      }
      return data;
    },

    async save(connection) {
      const { data, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .upsert(
          {
            ...connection,
            connection_key: CONNECTION_KEY,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'connection_key' },
        )
        .select(CONNECTION_FIELDS)
        .single();
      if (error) {
        throw new Error('Unable to save Google mailbox connection metadata.', {
          cause: error,
        });
      }
      return data;
    },

    async remove() {
      const { data, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .delete()
        .eq('connection_key', CONNECTION_KEY)
        .select(CONNECTION_FIELDS)
        .maybeSingle();
      if (error) {
        throw new Error('Unable to remove Google mailbox connection metadata.', {
          cause: error,
        });
      }
      return data;
    },
  };
}
