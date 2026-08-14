'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CLAIM_RESULTS,
  STRIPE_WEBHOOK_PROCESSING_STALE_MS,
  createStripeWebhookEventService,
} = require('./stripeWebhookEvent.service');

function event() {
  return {
    id: 'evt_ledger_1',
    type: 'checkout.session.completed',
  };
}

function claimRow(result, row, errorCode = null) {
  return {
    claim_result: result,
    event_id: row?.event_id || 'evt_ledger_1',
    attempt_count: row?.attempt_count ?? null,
    existing_status: row?.status || null,
    error_code: errorCode,
  };
}

function clone(value) {
  if (value === undefined) return undefined;
  return value === null ? null : JSON.parse(JSON.stringify(value));
}

function createRpcResponseClient(data, error = null) {
  return {
    async rpc() {
      return {
        data,
        error,
      };
    },
  };
}

function createFakeSupabase(initialRow = null) {
  let row = clone(initialRow);
  const updateCalls = [];

  return {
    getRow() {
      return clone(row);
    },

    getUpdateCalls() {
      return clone(updateCalls);
    },

    async rpc(name, args) {
      assert.equal(name, 'claim_stripe_webhook_event');
      assert.equal(
        args.p_processing_stale_after_seconds,
        STRIPE_WEBHOOK_PROCESSING_STALE_MS / 1000
      );

      const now = Date.now();

      if (!row) {
        row = {
          event_id: args.p_event_id,
          event_type: args.p_event_type,
          status: 'processing',
          processing_started_at: new Date(now).toISOString(),
          attempt_count: 1,
          error_message: null,
          processed_at: null,
        };

        return {
          data: [claimRow(CLAIM_RESULTS.CLAIMED, row)],
          error: null,
        };
      }

      if (row.event_type && row.event_type !== args.p_event_type) {
        return {
          data: [claimRow(CLAIM_RESULTS.ERROR, row, 'EVENT_TYPE_MISMATCH')],
          error: null,
        };
      }

      if (row.status === 'processed') {
        return {
          data: [claimRow(CLAIM_RESULTS.ALREADY_PROCESSED, row)],
          error: null,
        };
      }

      const staleBefore =
        now - (args.p_processing_stale_after_seconds * 1000);

      if (
        row.status === 'processing' &&
        row.processing_started_at &&
        Date.parse(row.processing_started_at) > staleBefore
      ) {
        return {
          data: [claimRow(CLAIM_RESULTS.IN_PROGRESS, row)],
          error: null,
        };
      }

      if ([
        'processing',
        'failed',
        'received',
        'checkout_session_completed',
      ].includes(row.status)) {
        row = {
          ...row,
          event_type: row.event_type || args.p_event_type,
          status: 'processing',
          processing_started_at: new Date(now).toISOString(),
          attempt_count: row.attempt_count + 1,
          error_message: null,
          processed_at: null,
        };

        return {
          data: [claimRow(CLAIM_RESULTS.RETRY_CLAIMED, row)],
          error: null,
        };
      }

      return {
        data: [claimRow(CLAIM_RESULTS.ERROR, row, 'UNSUPPORTED_STATUS')],
        error: null,
      };
    },

    from(tableName) {
      assert.equal(tableName, 'stripe_webhook_events');

      return {
        update(values) {
          const filters = [];
          const builder = {
            eq(column, value) {
              filters.push([column, value]);
              return builder;
            },
            select() {
              return builder;
            },
            maybeSingle() {
              updateCalls.push({
                values: clone(values),
                filters: clone(filters),
              });

              const ownsClaim = Boolean(
                row &&
                filters.every(([column, value]) => row[column] === value)
              );

              if (ownsClaim) {
                row = {
                  ...row,
                  ...values,
                };
              }

              return Promise.resolve({
                data: ownsClaim
                  ? {
                    event_id: row.event_id,
                    attempt_count: row.attempt_count,
                  }
                  : null,
                error: null,
              });
            },
          };

          return builder;
        },
      };
    },
  };
}

test('new event receives CLAIMED with fencing token 1', async () => {
  const fake = createFakeSupabase();
  const service = createStripeWebhookEventService({
    supabaseClient: fake,
  });

  const result = await service.claimEvent(event());

  assert.equal(result.result, CLAIM_RESULTS.CLAIMED);
  assert.equal(result.attemptCount, 1);
  assert.equal(fake.getRow().status, 'processing');
});

test('empty RPC response fails closed', async () => {
  const service = createStripeWebhookEventService({
    supabaseClient: createRpcResponseClient([]),
  });

  await assert.rejects(
    service.claimEvent(event()),
    (error) => error.code === 'STRIPE_LEDGER_INVALID_CLAIM_RESPONSE'
  );
});

test('multiple RPC rows fail closed', async () => {
  const row = claimRow(CLAIM_RESULTS.CLAIMED, {
    event_id: event().id,
    status: 'processing',
    attempt_count: 1,
  });
  const service = createStripeWebhookEventService({
    supabaseClient: createRpcResponseClient([row, row]),
  });

  await assert.rejects(
    service.claimEvent(event()),
    (error) => error.code === 'STRIPE_LEDGER_INVALID_CLAIM_RESPONSE'
  );
});

test('non-array RPC response fails closed', async () => {
  const service = createStripeWebhookEventService({
    supabaseClient: createRpcResponseClient(claimRow(CLAIM_RESULTS.CLAIMED, {
      event_id: event().id,
      status: 'processing',
      attempt_count: 1,
    })),
  });

  await assert.rejects(
    service.claimEvent(event()),
    (error) => error.code === 'STRIPE_LEDGER_INVALID_CLAIM_RESPONSE'
  );
});

test('malformed RPC row fails closed', async () => {
  const service = createStripeWebhookEventService({
    supabaseClient: createRpcResponseClient([null]),
  });

  await assert.rejects(
    service.claimEvent(event()),
    (error) => error.code === 'STRIPE_LEDGER_INVALID_CLAIM_RESPONSE'
  );
});

test('RPC transport error fails closed', async () => {
  const service = createStripeWebhookEventService({
    supabaseClient: createRpcResponseClient(null, {
      code: 'RPC_UNAVAILABLE',
    }),
  });

  await assert.rejects(
    service.claimEvent(event()),
    (error) => error.code === 'STRIPE_LEDGER_CLAIM_FAILED'
  );
});

test('unknown claim result fails closed', async () => {
  const service = createStripeWebhookEventService({
    supabaseClient: createRpcResponseClient([{
      claim_result: 'UNKNOWN_RESULT',
      event_id: event().id,
      attempt_count: null,
      existing_status: null,
      error_code: null,
    }]),
  });

  await assert.rejects(
    service.claimEvent(event()),
    (error) => error.code === 'STRIPE_LEDGER_INVALID_CLAIM_RESPONSE'
  );
});

test('ownership result without a valid attempt_count fails closed', async () => {
  const service = createStripeWebhookEventService({
    supabaseClient: createRpcResponseClient([{
      claim_result: CLAIM_RESULTS.CLAIMED,
      event_id: event().id,
      attempt_count: null,
      existing_status: null,
      error_code: null,
    }]),
  });

  await assert.rejects(
    service.claimEvent(event()),
    (error) => error.code === 'STRIPE_LEDGER_INVALID_FENCING_TOKEN'
  );
});

test('contradictory existing_status fails closed', async () => {
  const service = createStripeWebhookEventService({
    supabaseClient: createRpcResponseClient([{
      claim_result: CLAIM_RESULTS.ALREADY_PROCESSED,
      event_id: event().id,
      attempt_count: 2,
      existing_status: 'processing',
      error_code: null,
    }]),
  });

  await assert.rejects(
    service.claimEvent(event()),
    (error) => error.code === 'STRIPE_LEDGER_INVALID_CLAIM_RESPONSE'
  );
});

test('event_type mismatch is returned as a fail-closed ERROR result', async () => {
  const service = createStripeWebhookEventService({
    supabaseClient: createRpcResponseClient([{
      claim_result: CLAIM_RESULTS.ERROR,
      event_id: event().id,
      attempt_count: 2,
      existing_status: 'failed',
      error_code: 'EVENT_TYPE_MISMATCH',
    }]),
  });

  const result = await service.claimEvent(event());

  assert.equal(result.result, CLAIM_RESULTS.ERROR);
  assert.equal(result.attemptCount, null);
  assert.equal(result.errorCode, 'EVENT_TYPE_MISMATCH');
});

for (const nonOwner of [
  {
    result: CLAIM_RESULTS.ALREADY_PROCESSED,
    status: 'processed',
  },
  {
    result: CLAIM_RESULTS.IN_PROGRESS,
    status: 'processing',
  },
]) {
  test(nonOwner.result + ' never exposes an ownership token', async () => {
    const service = createStripeWebhookEventService({
      supabaseClient: createRpcResponseClient([{
        claim_result: nonOwner.result,
        event_id: event().id,
        attempt_count: 9,
        existing_status: nonOwner.status,
        error_code: null,
      }]),
    });

    const result = await service.claimEvent(event());

    assert.equal(result.result, nonOwner.result);
    assert.equal(result.attemptCount, null);
  });
}

test('failed event retry increments attempt_count and returns RETRY_CLAIMED', async () => {
  const fake = createFakeSupabase({
    event_id: 'evt_ledger_1',
    event_type: 'checkout.session.completed',
    status: 'failed',
    processing_started_at: null,
    attempt_count: 3,
    error_message: 'prior failure',
  });
  const service = createStripeWebhookEventService({
    supabaseClient: fake,
  });

  const result = await service.claimEvent(event());

  assert.equal(result.result, CLAIM_RESULTS.RETRY_CLAIMED);
  assert.equal(result.attemptCount, 4);
  assert.equal(fake.getRow().error_message, null);
});

test('stale processing is reclaimed with a new fencing token', async () => {
  const fake = createFakeSupabase({
    event_id: 'evt_ledger_1',
    event_type: 'checkout.session.completed',
    status: 'processing',
    processing_started_at: new Date(Date.now() - (10 * 60 * 1000)).toISOString(),
    attempt_count: 7,
    error_message: null,
  });
  const service = createStripeWebhookEventService({
    supabaseClient: fake,
  });

  const result = await service.claimEvent(event());

  assert.equal(result.result, CLAIM_RESULTS.RETRY_CLAIMED);
  assert.equal(result.attemptCount, 8);
});

for (const legacyStatus of ['received', 'checkout_session_completed']) {
  test('legacy state ' + legacyStatus + ' is reclaimed explicitly', async () => {
    const fake = createFakeSupabase({
      event_id: 'evt_ledger_1',
      event_type: 'checkout.session.completed',
      status: legacyStatus,
      processing_started_at: null,
      attempt_count: 0,
      error_message: null,
    });
    const service = createStripeWebhookEventService({
      supabaseClient: fake,
    });

    const result = await service.claimEvent(event());

    assert.equal(result.result, CLAIM_RESULTS.RETRY_CLAIMED);
    assert.equal(result.attemptCount, 1);
    assert.equal(fake.getRow().status, 'processing');
  });
}

test('old attempt cannot markProcessed after reclaim', async () => {
  const fake = createFakeSupabase({
    event_id: 'evt_ledger_1',
    event_type: 'checkout.session.completed',
    status: 'processing',
    processing_started_at: new Date(Date.now() - (10 * 60 * 1000)).toISOString(),
    attempt_count: 2,
    error_message: null,
  });
  const service = createStripeWebhookEventService({
    supabaseClient: fake,
  });

  const reclaimed = await service.claimEvent(event());
  const result = await service.markProcessed(event().id, 2);

  assert.equal(reclaimed.attemptCount, 3);
  assert.equal(result.ok, false);
  assert.equal(result.result, 'CLAIM_LOST');
  assert.equal(fake.getRow().status, 'processing');
  assert.equal(fake.getRow().attempt_count, 3);
});

test('old attempt cannot markFailed after reclaim', async () => {
  const fake = createFakeSupabase({
    event_id: 'evt_ledger_1',
    event_type: 'checkout.session.completed',
    status: 'processing',
    processing_started_at: new Date(Date.now() - (10 * 60 * 1000)).toISOString(),
    attempt_count: 4,
    error_message: null,
  });
  const service = createStripeWebhookEventService({
    supabaseClient: fake,
  });

  const reclaimed = await service.claimEvent(event());
  const result = await service.markFailed(event().id, 4, new Error('old attempt'));

  assert.equal(reclaimed.attemptCount, 5);
  assert.equal(result.ok, false);
  assert.equal(result.result, 'CLAIM_LOST');
  assert.equal(fake.getRow().status, 'processing');
  assert.equal(fake.getRow().attempt_count, 5);
});

test('markProcessed applies event_id, processing status, and fencing token filters', async () => {
  const fake = createFakeSupabase({
    event_id: 'evt_ledger_1',
    event_type: 'checkout.session.completed',
    status: 'processing',
    processing_started_at: new Date().toISOString(),
    attempt_count: 6,
    error_message: null,
  });
  const service = createStripeWebhookEventService({
    supabaseClient: fake,
  });

  const result = await service.markProcessed(event().id, 6);

  assert.equal(result.ok, true);
  assert.equal(fake.getRow().status, 'processed');
  assert.deepEqual(fake.getUpdateCalls()[0].filters, [
    ['event_id', 'evt_ledger_1'],
    ['status', 'processing'],
    ['attempt_count', 6],
  ]);
});

test('markFailed applies event_id, processing status, and fencing token filters', async () => {
  const fake = createFakeSupabase({
    event_id: 'evt_ledger_1',
    event_type: 'checkout.session.completed',
    status: 'processing',
    processing_started_at: new Date().toISOString(),
    attempt_count: 8,
    error_message: null,
  });
  const service = createStripeWebhookEventService({
    supabaseClient: fake,
  });

  const result = await service.markFailed(event().id, 8, new Error('retry later'));

  assert.equal(result.ok, true);
  assert.equal(fake.getRow().status, 'failed');
  assert.deepEqual(fake.getUpdateCalls()[0].filters, [
    ['event_id', 'evt_ledger_1'],
    ['status', 'processing'],
    ['attempt_count', 8],
  ]);
});

test('simulated overlapping service claims produce one owner in the fake contract', async () => {
  const fake = createFakeSupabase();
  const service = createStripeWebhookEventService({
    supabaseClient: fake,
  });

  const results = await Promise.all([
    service.claimEvent(event()),
    service.claimEvent(event()),
  ]);
  const owners = results.filter((result) => [
    CLAIM_RESULTS.CLAIMED,
    CLAIM_RESULTS.RETRY_CLAIMED,
  ].includes(result.result));
  const inProgress = results.filter(
    (result) => result.result === CLAIM_RESULTS.IN_PROGRESS
  );

  assert.equal(owners.length, 1);
  assert.equal(inProgress.length, 1);
});

test('unknown ledger status fails closed without changing the row', async () => {
  const initial = {
    event_id: 'evt_ledger_1',
    event_type: 'checkout.session.completed',
    status: 'unexpected_state',
    processing_started_at: null,
    attempt_count: 9,
    error_message: null,
  };
  const fake = createFakeSupabase(initial);
  const service = createStripeWebhookEventService({
    supabaseClient: fake,
  });

  const result = await service.claimEvent(event());

  assert.equal(result.result, CLAIM_RESULTS.ERROR);
  assert.equal(result.errorCode, 'UNSUPPORTED_STATUS');
  assert.deepEqual(fake.getRow(), initial);
});
