BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL idle_in_transaction_session_timeout = '60s';

-- ============================================================
-- SEC-0 — EMERGENCY DATABASE ACCESS CONTAINMENT
--
-- This migration intentionally:
--   * enables RLS on critical internal tables;
--   * revokes direct access from PUBLIC, anon and authenticated;
--   * preserves only SELECT, INSERT and UPDATE for service_role;
--   * does not create or remove policies;
--   * does not modify application data or table structure.
--
-- Do not execute before the SEC-A service-role strictness gate.
-- ============================================================

DO $$
DECLARE
  target_table text;
  required_role text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'users',
    'companies',
    'clients',
    'plans',
    'subscriptions',
    'stripe_webhook_events'
  ]
  LOOP
    IF to_regclass(format('public.%I', target_table)) IS NULL THEN
      RAISE EXCEPTION
        'SEC-0 preflight failed: required table public.% does not exist',
        target_table;
    END IF;
  END LOOP;

  FOREACH required_role IN ARRAY ARRAY[
    'anon',
    'authenticated',
    'service_role'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = required_role
    ) THEN
      RAISE EXCEPTION
        'SEC-0 preflight failed: required role % does not exist',
        required_role;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'service_role'
      AND rolbypassrls IS TRUE
  ) THEN
    RAISE EXCEPTION
      'SEC-0 preflight failed: service_role must have BYPASSRLS';
  END IF;
END
$$;

ALTER TABLE public.users
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.companies
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clients
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.plans
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.subscriptions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stripe_webhook_events
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
  ON TABLE public.users
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES
  ON TABLE public.companies
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES
  ON TABLE public.clients
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES
  ON TABLE public.plans
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES
  ON TABLE public.subscriptions
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES
  ON TABLE public.stripe_webhook_events
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.users
  TO service_role;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.companies
  TO service_role;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.clients
  TO service_role;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.plans
  TO service_role;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.subscriptions
  TO service_role;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.stripe_webhook_events
  TO service_role;

DO $$
DECLARE
  target_table text;
  qualified_table text;
  public_role text;
  prohibited_privilege text;
  required_privilege text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'users',
    'companies',
    'clients',
    'plans',
    'subscriptions',
    'stripe_webhook_events'
  ]
  LOOP
    qualified_table := format('public.%I', target_table);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_class relation
      JOIN pg_namespace schema_row
        ON schema_row.oid = relation.relnamespace
      WHERE schema_row.nspname = 'public'
        AND relation.relname = target_table
        AND relation.relkind IN ('r', 'p')
        AND relation.relrowsecurity IS TRUE
    ) THEN
      RAISE EXCEPTION
        'SEC-0 verification failed: RLS is not enabled on %',
        qualified_table;
    END IF;

    FOREACH public_role IN ARRAY ARRAY[
      'public',
      'anon',
      'authenticated'
    ]
    LOOP
      FOREACH prohibited_privilege IN ARRAY ARRAY[
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER',
        'MAINTAIN'
      ]
      LOOP
        IF has_table_privilege(
          public_role,
          qualified_table,
          prohibited_privilege
        ) THEN
          RAISE EXCEPTION
            'SEC-0 verification failed: role % still has % on %',
            public_role,
            prohibited_privilege,
            qualified_table;
        END IF;
      END LOOP;

      FOREACH prohibited_privilege IN ARRAY ARRAY[
        'SELECT',
        'INSERT',
        'UPDATE',
        'REFERENCES'
      ]
      LOOP
        IF has_any_column_privilege(
          public_role,
          qualified_table,
          prohibited_privilege
        ) THEN
          RAISE EXCEPTION
            'SEC-0 verification failed: role % still has column-level % on %',
            public_role,
            prohibited_privilege,
            qualified_table;
        END IF;
      END LOOP;
    END LOOP;

    FOREACH required_privilege IN ARRAY ARRAY[
      'SELECT',
      'INSERT',
      'UPDATE'
    ]
    LOOP
      IF NOT has_table_privilege(
        'service_role',
        qualified_table,
        required_privilege
      ) THEN
        RAISE EXCEPTION
          'SEC-0 verification failed: service_role lacks % on %',
          required_privilege,
          qualified_table;
      END IF;

      IF has_any_column_privilege(
        'service_role',
        qualified_table,
        required_privilege || ' WITH GRANT OPTION'
      ) THEN
        RAISE EXCEPTION
          'SEC-0 verification failed: service_role has % WITH GRANT OPTION on %',
          required_privilege,
          qualified_table;
      END IF;
    END LOOP;

    FOREACH prohibited_privilege IN ARRAY ARRAY[
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER',
      'MAINTAIN'
    ]
    LOOP
      IF has_table_privilege(
        'service_role',
        qualified_table,
        prohibited_privilege
      ) THEN
        RAISE EXCEPTION
          'SEC-0 verification failed: service_role unexpectedly has % on %',
          prohibited_privilege,
          qualified_table;
      END IF;
    END LOOP;

    IF has_any_column_privilege(
      'service_role',
      qualified_table,
      'REFERENCES'
    ) THEN
      RAISE EXCEPTION
        'SEC-0 verification failed: service_role has column-level REFERENCES on %',
        qualified_table;
    END IF;
  END LOOP;
END
$$;

COMMIT;
