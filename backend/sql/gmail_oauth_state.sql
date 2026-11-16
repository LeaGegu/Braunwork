BEGIN;

CREATE TABLE public.google_oauth_state_transactions (
  state_hash text PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT google_oauth_state_hash_format
    CHECK (state_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT google_oauth_state_expiration_after_creation
    CHECK (expires_at > created_at),
  CONSTRAINT google_oauth_state_consumed_after_creation
    CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE INDEX google_oauth_state_expiration_idx
  ON public.google_oauth_state_transactions (expires_at)
  WHERE consumed_at IS NULL;

CREATE INDEX google_oauth_state_admin_created_idx
  ON public.google_oauth_state_transactions (admin_user_id, created_at DESC);

ALTER TABLE public.google_oauth_state_transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON TABLE public.google_oauth_state_transactions
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.google_oauth_state_transactions
TO service_role;

COMMIT;
