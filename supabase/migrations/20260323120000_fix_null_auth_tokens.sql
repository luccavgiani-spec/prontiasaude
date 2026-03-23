-- Fix NULL auth token columns for existing users that cause
-- "Database error querying schema" on login (Supabase GoTrue bug).
-- Old users created before the new-user patch have NULL in these columns;
-- GoTrue expects empty string, not NULL, when querying the auth schema.
UPDATE auth.users
SET
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  confirmation_token         = COALESCE(confirmation_token, '')
WHERE
  email_change_token_new     IS NULL
  OR email_change_token_current IS NULL
  OR recovery_token           IS NULL
  OR confirmation_token       IS NULL;
