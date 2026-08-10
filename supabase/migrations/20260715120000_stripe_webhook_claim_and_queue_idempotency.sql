BEGIN;

DO $ledger_preflight$
DECLARE
  missing_columns TEXT;
BEGIN
  IF to_regclass('public.stripe_webhook_events') IS NULL THEN
    RAISE EXCEPTION 'P0 billing migration aborted: public.stripe_webhook_events does not exist';
  END IF;

  SELECT string_agg(required.column_name, ', ' ORDER BY required.column_name)
    INTO missing_columns
  FROM unnest(ARRAY[
    'event_id',
    'event_type',
    'status',
    'error_message',
    'created_at',
    'updated_at',
    'processed_at'
  ]) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS existing
    WHERE existing.table_schema = 'public'
      AND existing.table_name = 'stripe_webhook_events'
      AND existing.column_name = required.column_name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION
      'P0 billing migration aborted: stripe_webhook_events is missing required columns: %',
      missing_columns;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stripe_webhook_events'
      AND column_name IN ('event_id', 'event_type', 'status', 'error_message')
      AND data_type NOT IN ('text', 'character varying')
  ) THEN
    RAISE EXCEPTION
      'P0 billing migration aborted: stripe_webhook_events text contract is incompatible';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stripe_webhook_events'
      AND column_name IN ('created_at', 'updated_at', 'processed_at')
      AND data_type <> 'timestamp with time zone'
  ) THEN
    RAISE EXCEPTION
      'P0 billing migration aborted: stripe_webhook_events timestamp contract is incompatible';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index AS index_definition
    JOIN pg_class AS table_definition
      ON table_definition.oid = index_definition.indrelid
    JOIN pg_namespace AS table_namespace
      ON table_namespace.oid = table_definition.relnamespace
    WHERE table_namespace.nspname = 'public'
      AND table_definition.relname = 'stripe_webhook_events'
      AND index_definition.indisunique
      AND index_definition.indisvalid
      AND index_definition.indisready
      AND index_definition.indimmediate
      AND index_definition.indpred IS NULL
      AND index_definition.indexprs IS NULL
      AND index_definition.indnkeyatts = 1
      AND EXISTS (
        SELECT 1
        FROM pg_attribute AS indexed_column
        WHERE indexed_column.attrelid = table_definition.oid
          AND indexed_column.attnum = index_definition.indkey[0]
          AND indexed_column.attname = 'event_id'
      )
  ) THEN
    RAISE EXCEPTION
      'P0 billing migration aborted: stripe_webhook_events.event_id is not uniquely indexed';
  END IF;
END;
$ledger_preflight$;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS attempt_count BIGINT;

DO $ledger_new_columns$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stripe_webhook_events'
      AND column_name = 'processing_started_at'
      AND data_type <> 'timestamp with time zone'
  ) THEN
    RAISE EXCEPTION
      'P0 billing migration aborted: processing_started_at has an incompatible type';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stripe_webhook_events'
      AND column_name = 'attempt_count'
      AND data_type NOT IN ('smallint', 'integer', 'bigint')
  ) THEN
    RAISE EXCEPTION
      'P0 billing migration aborted: attempt_count has an incompatible type';
  END IF;
END;
$ledger_new_columns$;

UPDATE public.stripe_webhook_events
SET attempt_count = 0
WHERE attempt_count IS NULL;

DO $ledger_attempt_count_preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.stripe_webhook_events
    WHERE attempt_count < 0
  ) THEN
    RAISE EXCEPTION
      'P0 billing migration aborted: attempt_count contains negative values';
  END IF;
END;
$ledger_attempt_count_preflight$;

ALTER TABLE public.stripe_webhook_events
  ALTER COLUMN attempt_count SET DEFAULT 0,
  ALTER COLUMN attempt_count SET NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_stripe_webhook_event(
  p_event_id TEXT,
  p_event_type TEXT,
  p_processing_stale_after_seconds INTEGER DEFAULT 300
)
RETURNS TABLE (
  claim_result TEXT,
  event_id TEXT,
  attempt_count BIGINT,
  existing_status TEXT,
  error_code TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $claim_function$
DECLARE
  claimed_event public.stripe_webhook_events%ROWTYPE;
  claim_time TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF NULLIF(btrim(p_event_id), '') IS NULL THEN
    RAISE EXCEPTION 'event_id is required';
  END IF;

  IF NULLIF(btrim(p_event_type), '') IS NULL THEN
    RAISE EXCEPTION 'event_type is required';
  END IF;

  IF p_processing_stale_after_seconds IS NULL
     OR p_processing_stale_after_seconds < 1
     OR p_processing_stale_after_seconds > 86400 THEN
    RAISE EXCEPTION 'processing stale interval is outside the accepted range';
  END IF;

  INSERT INTO public.stripe_webhook_events (
    event_id,
    event_type,
    status,
    error_message,
    processing_started_at,
    attempt_count,
    created_at,
    updated_at
  )
  VALUES (
    p_event_id,
    p_event_type,
    'processing',
    NULL,
    claim_time,
    1,
    claim_time,
    claim_time
  )
  ON CONFLICT DO NOTHING
  RETURNING * INTO claimed_event;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      'CLAIMED'::TEXT,
      claimed_event.event_id,
      claimed_event.attempt_count::BIGINT,
      NULL::TEXT,
      NULL::TEXT;
    RETURN;
  END IF;

  SELECT event_row.*
    INTO claimed_event
  FROM public.stripe_webhook_events AS event_row
  WHERE event_row.event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      'ERROR'::TEXT,
      p_event_id,
      NULL::BIGINT,
      NULL::TEXT,
      'LEDGER_ROW_MISSING'::TEXT;
    RETURN;
  END IF;

  IF claimed_event.event_type IS NOT NULL
     AND claimed_event.event_type <> p_event_type THEN
    RETURN QUERY
    SELECT
      'ERROR'::TEXT,
      claimed_event.event_id,
      claimed_event.attempt_count::BIGINT,
      claimed_event.status,
      'EVENT_TYPE_MISMATCH'::TEXT;
    RETURN;
  END IF;

  IF claimed_event.status = 'processed' THEN
    RETURN QUERY
    SELECT
      'ALREADY_PROCESSED'::TEXT,
      claimed_event.event_id,
      claimed_event.attempt_count::BIGINT,
      claimed_event.status,
      NULL::TEXT;
    RETURN;
  END IF;

  IF claimed_event.status = 'processing'
     AND claimed_event.processing_started_at IS NOT NULL
     AND claimed_event.processing_started_at >
       claim_time - make_interval(secs => p_processing_stale_after_seconds) THEN
    RETURN QUERY
    SELECT
      'IN_PROGRESS'::TEXT,
      claimed_event.event_id,
      claimed_event.attempt_count::BIGINT,
      claimed_event.status,
      NULL::TEXT;
    RETURN;
  END IF;

  IF claimed_event.status IN (
    'processing',
    'failed',
    'received',
    'checkout_session_completed'
  ) THEN
    UPDATE public.stripe_webhook_events AS event_row
    SET
      event_type = COALESCE(event_row.event_type, p_event_type),
      status = 'processing',
      error_message = NULL,
      processed_at = NULL,
      processing_started_at = claim_time,
      attempt_count = event_row.attempt_count + 1,
      updated_at = claim_time
    WHERE event_row.event_id = p_event_id
    RETURNING event_row.* INTO claimed_event;

    RETURN QUERY
    SELECT
      'RETRY_CLAIMED'::TEXT,
      claimed_event.event_id,
      claimed_event.attempt_count::BIGINT,
      claimed_event.status,
      NULL::TEXT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    'ERROR'::TEXT,
    claimed_event.event_id,
    claimed_event.attempt_count::BIGINT,
    claimed_event.status,
    'UNSUPPORTED_STATUS'::TEXT;
END;
$claim_function$;

REVOKE ALL ON FUNCTION public.claim_stripe_webhook_event(TEXT, TEXT, INTEGER)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_stripe_webhook_event(TEXT, TEXT, INTEGER)
  FROM anon;
REVOKE ALL ON FUNCTION public.claim_stripe_webhook_event(TEXT, TEXT, INTEGER)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_webhook_event(TEXT, TEXT, INTEGER)
  TO service_role;

DO $queue_preflight$
DECLARE
  missing_columns TEXT;
  equivalent_unique_index_exists BOOLEAN;
BEGIN
  IF to_regclass('public.billing_provisioning_queue') IS NULL THEN
    RAISE EXCEPTION
      'P0 billing migration aborted: public.billing_provisioning_queue does not exist';
  END IF;

  SELECT string_agg(required.column_name, ', ' ORDER BY required.column_name)
    INTO missing_columns
  FROM unnest(ARRAY[
    'id',
    'source',
    'status',
    'priority',
    'checkout_session_id',
    'stripe_customer_id',
    'stripe_subscription_id',
    'payment_status',
    'subscription_status',
    'plan_key',
    'internal_plan',
    'plan_name',
    'customer_name',
    'customer_email',
    'customer_phone',
    'company_name',
    'company_phone',
    'document',
    'amount_subtotal',
    'amount_total',
    'currency',
    'onboarding_gate_token',
    'gate_expires_at',
    'metadata'
  ]) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS existing
    WHERE existing.table_schema = 'public'
      AND existing.table_name = 'billing_provisioning_queue'
      AND existing.column_name = required.column_name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION
      'P0 billing migration aborted: billing_provisioning_queue is missing required columns: %',
      missing_columns;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'billing_provisioning_queue'
      AND column_name = 'checkout_session_id'
      AND data_type NOT IN ('text', 'character varying')
  ) THEN
    RAISE EXCEPTION
      'P0 billing migration aborted: checkout_session_id has an incompatible type';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.billing_provisioning_queue
    WHERE checkout_session_id IS NOT NULL
    GROUP BY checkout_session_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'P0 billing migration aborted: duplicate non-null checkout_session_id values exist';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_index AS index_definition
    JOIN pg_class AS table_definition
      ON table_definition.oid = index_definition.indrelid
    JOIN pg_namespace AS table_namespace
      ON table_namespace.oid = table_definition.relnamespace
    WHERE table_namespace.nspname = 'public'
      AND table_definition.relname = 'billing_provisioning_queue'
      AND index_definition.indisunique
      AND index_definition.indisvalid
      AND index_definition.indisready
      AND index_definition.indimmediate
      AND index_definition.indpred IS NULL
      AND index_definition.indexprs IS NULL
      AND index_definition.indnkeyatts = 1
      AND EXISTS (
        SELECT 1
        FROM pg_attribute AS indexed_column
        WHERE indexed_column.attrelid = table_definition.oid
          AND indexed_column.attnum = index_definition.indkey[0]
          AND indexed_column.attname = 'checkout_session_id'
      )
  ) INTO equivalent_unique_index_exists;

  IF NOT equivalent_unique_index_exists THEN
    EXECUTE
      'CREATE UNIQUE INDEX billing_provisioning_queue_checkout_session_id_key ' ||
      'ON public.billing_provisioning_queue (checkout_session_id)';
  END IF;
END;
$queue_preflight$;

COMMIT;
