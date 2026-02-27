-- Inbox v1 baseline migration (versioning only)
-- IMPORTANT: do not run automatically in production now.
-- Current production DB already has public.conversations and public.messages.

DO $$
BEGIN
  RAISE NOTICE 'Inbox v1 migration registered for versioning only; no schema changes executed.';
END $$;
