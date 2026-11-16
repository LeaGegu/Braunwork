BEGIN;

CREATE TABLE public.google_mailbox_connections (
  connection_key text PRIMARY KEY DEFAULT 'shared',
  mailbox_email text NOT NULL,
  secret_reference text NOT NULL,
  secret_version text NOT NULL,
  scopes text[] NOT NULL,
  connected_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_mailbox_connection_singleton
    CHECK (connection_key = 'shared'),
  CONSTRAINT google_mailbox_connection_email_normalized
    CHECK (
      length(mailbox_email) <= 254
      AND mailbox_email = lower(btrim(mailbox_email))
    ),
  CONSTRAINT google_mailbox_connection_secret_reference_nonempty
    CHECK (length(btrim(secret_reference)) > 0),
  CONSTRAINT google_mailbox_connection_secret_version_nonempty
    CHECK (length(btrim(secret_version)) > 0),
  CONSTRAINT google_mailbox_connection_scopes_nonempty
    CHECK (cardinality(scopes) > 0)
);

ALTER TABLE public.google_mailbox_connections ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON TABLE public.google_mailbox_connections
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.google_mailbox_connections
TO service_role;

COMMIT;
