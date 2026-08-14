const supabase = require('../config/supabase');

const TABLE_NAME = 'stripe_webhook_events';
const CLAIM_RPC_NAME = 'claim_stripe_webhook_event';
const STRIPE_WEBHOOK_PROCESSING_STALE_MS = 5 * 60 * 1000;

const CLAIM_RESULTS = Object.freeze({
  CLAIMED: 'CLAIMED',
  ALREADY_PROCESSED: 'ALREADY_PROCESSED',
  IN_PROGRESS: 'IN_PROGRESS',
  RETRY_CLAIMED: 'RETRY_CLAIMED',
  ERROR: 'ERROR',
});

function makeLedgerError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 503;
  return error;
}

function requiredText(value, fieldName, maxLength = 255) {
  const textValue = String(value || '').trim();

  if (!textValue) {
    throw makeLedgerError(
      'STRIPE_LEDGER_INVALID_EVENT',
      'Stripe ledger requires ' + fieldName + '.'
    );
  }

  return textValue.slice(0, maxLength);
}

function parseAttemptCount(value, { required = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (required) {
      throw makeLedgerError(
        'STRIPE_LEDGER_INVALID_FENCING_TOKEN',
        'Stripe ledger returned an invalid fencing token.'
      );
    }

    return null;
  }

  const attemptCount = Number(value);

  if (!Number.isSafeInteger(attemptCount) || attemptCount < (required ? 1 : 0)) {
    if (required) {
      throw makeLedgerError(
        'STRIPE_LEDGER_INVALID_FENCING_TOKEN',
        'Stripe ledger returned an invalid fencing token.'
      );
    }

    return null;
  }

  return attemptCount;
}

function sanitizeStoredError(error) {
  return String(error?.message || error || 'unknown')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9_-]+\b/gi, '[REDACTED_STRIPE_KEY]')
    .replace(/\bwhsec_[A-Za-z0-9_-]+\b/gi, '[REDACTED_WEBHOOK_SECRET]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_TOKEN]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300) || 'unknown';
}

function exactRpcRow(data) {
  if (
    !Array.isArray(data) ||
    data.length !== 1 ||
    !data[0] ||
    typeof data[0] !== 'object' ||
    Array.isArray(data[0])
  ) {
    throw makeLedgerError(
      'STRIPE_LEDGER_INVALID_CLAIM_RESPONSE',
      'Stripe ledger returned an invalid claim response.'
    );
  }

  return data[0];
}

function optionalExistingStatus(value) {
  if (value === null || value === undefined) return null;

  if (typeof value !== 'string' || !value.trim()) {
    throw makeLedgerError(
      'STRIPE_LEDGER_INVALID_CLAIM_RESPONSE',
      'Stripe ledger returned an invalid existing status.'
    );
  }

  return value.trim();
}

function validateClaimCoherence(result, existingStatus) {
  const expectedStatus = {
    [CLAIM_RESULTS.CLAIMED]: 'processing',
    [CLAIM_RESULTS.RETRY_CLAIMED]: 'processing',
    [CLAIM_RESULTS.ALREADY_PROCESSED]: 'processed',
    [CLAIM_RESULTS.IN_PROGRESS]: 'processing',
  }[result];

  if (existingStatus && expectedStatus && existingStatus !== expectedStatus) {
    throw makeLedgerError(
      'STRIPE_LEDGER_INVALID_CLAIM_RESPONSE',
      'Stripe ledger returned a contradictory claim response.'
    );
  }
}

function createStripeWebhookEventService({ supabaseClient = supabase } = {}) {
  async function claimEvent(event) {
    const eventId = requiredText(event?.id, 'event_id');
    const eventType = requiredText(event?.type, 'event_type');
    const staleAfterSeconds = Math.floor(STRIPE_WEBHOOK_PROCESSING_STALE_MS / 1000);

    const { data, error } = await supabaseClient.rpc(CLAIM_RPC_NAME, {
      p_event_id: eventId,
      p_event_type: eventType,
      p_processing_stale_after_seconds: staleAfterSeconds,
    });

    if (error) {
      throw makeLedgerError(
        'STRIPE_LEDGER_CLAIM_FAILED',
        'Stripe webhook event could not be claimed durably.'
      );
    }

    const row = exactRpcRow(data);
    const result = row?.claim_result;

    if (!Object.values(CLAIM_RESULTS).includes(result)) {
      throw makeLedgerError(
        'STRIPE_LEDGER_INVALID_CLAIM_RESPONSE',
        'Stripe ledger returned an invalid claim response.'
      );
    }

    const ownsClaim = result === CLAIM_RESULTS.CLAIMED || result === CLAIM_RESULTS.RETRY_CLAIMED;
    const claimedEventId = requiredText(row.event_id, 'event_id');
    const existingStatus = optionalExistingStatus(row.existing_status);

    validateClaimCoherence(result, existingStatus);

    if (claimedEventId !== eventId) {
      throw makeLedgerError(
        'STRIPE_LEDGER_INVALID_CLAIM_RESPONSE',
        'Stripe ledger returned a mismatched event id.'
      );
    }

    return {
      result,
      eventId: claimedEventId,
      attemptCount: ownsClaim
        ? parseAttemptCount(row.attempt_count, { required: true })
        : null,
      existingStatus,
      errorCode: row.error_code || null,
    };
  }

  async function updateOwnedClaim(eventId, attemptCount, values) {
    const safeEventId = requiredText(eventId, 'event_id');
    const fencingToken = parseAttemptCount(attemptCount, { required: true });

    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .update(values)
      .eq('event_id', safeEventId)
      .eq('status', 'processing')
      .eq('attempt_count', fencingToken)
      .select('event_id,attempt_count')
      .maybeSingle();

    if (error) {
      throw makeLedgerError(
        'STRIPE_LEDGER_UPDATE_FAILED',
        'Stripe webhook event state could not be persisted.'
      );
    }

    if (!data) {
      return {
        ok: false,
        result: 'CLAIM_LOST',
        eventId: safeEventId,
        attemptCount: fencingToken,
      };
    }

    return {
      ok: true,
      result: 'UPDATED',
      eventId: safeEventId,
      attemptCount: fencingToken,
    };
  }

  async function markProcessed(eventId, attemptCount) {
    const now = new Date().toISOString();

    return updateOwnedClaim(eventId, attemptCount, {
      status: 'processed',
      processed_at: now,
      updated_at: now,
      error_message: null,
    });
  }

  async function markFailed(eventId, attemptCount, error) {
    return updateOwnedClaim(eventId, attemptCount, {
      status: 'failed',
      updated_at: new Date().toISOString(),
      error_message: sanitizeStoredError(error),
    });
  }

  return {
    claimEvent,
    markProcessed,
    markFailed,
  };
}

const defaultService = createStripeWebhookEventService();

module.exports = {
  ...defaultService,
  CLAIM_RESULTS,
  STRIPE_WEBHOOK_PROCESSING_STALE_MS,
  createStripeWebhookEventService,
  sanitizeStoredError,
};
