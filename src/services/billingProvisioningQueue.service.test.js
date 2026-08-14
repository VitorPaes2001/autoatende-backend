'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const previousStripeSecretKey = process.env.STRIPE_SECRET_KEY;
process.env.STRIPE_SECRET_KEY = 'unit_test_key_not_a_secret';

test.after(() => {
  if (previousStripeSecretKey === undefined) {
    delete process.env.STRIPE_SECRET_KEY;
  } else {
    process.env.STRIPE_SECRET_KEY = previousStripeSecretKey;
  }
});

const {
  createBillingProvisioningQueueService,
} = require('./billingProvisioningQueue.service');

function clone(value) {
  return value === null ? null : JSON.parse(JSON.stringify(value));
}

function checkoutSession(overrides = {}) {
  return {
    id: 'cs_queue_1',
    payment_status: 'paid',
    status: 'complete',
    mode: 'subscription',
    livemode: false,
    created: 123,
    customer: {
      id: 'cus_queue_1',
      email: 'customer@example.test',
    },
    subscription: {
      id: 'sub_queue_1',
      status: 'active',
    },
    customer_details: {
      name: 'Customer',
      email: 'customer@example.test',
      phone: '+5500000000000',
    },
    metadata: {
      planKey: 'profissional',
      companyName: 'Example Company',
    },
    amount_subtotal: 1000,
    amount_total: 1000,
    currency: 'brl',
    ...overrides,
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return body === null ? '' : JSON.stringify(body);
    },
  };
}

function createQueueStore(initialRow = null, {
  conflictWithoutRow = false,
  lookupRows = null,
  lookupStatus = 200,
} = {}) {
  let row = clone(initialRow);
  const requests = [];

  return {
    requests,

    getRow() {
      return clone(row);
    },

    async fetch(url, options) {
      requests.push({
        url,
        options: clone(options),
      });

      if (options.method === 'POST') {
        const payload = JSON.parse(options.body);

        if (row || conflictWithoutRow) {
          return jsonResponse(409, {
            code: '23505',
            message: 'unique violation',
          });
        }

        row = {
          id: 'queue_row_1',
          ...payload,
        };

        return jsonResponse(201, [clone(row)]);
      }

      if (options.method === 'GET') {
        if (lookupStatus < 200 || lookupStatus >= 300) {
          return jsonResponse(lookupStatus, {
            code: 'LOOKUP_FAILED',
          });
        }

        const rows = lookupRows !== null
          ? lookupRows
          : row
            ? [{
              id: row.id,
              checkout_session_id: row.checkout_session_id,
              status: row.status,
            }]
            : [];

        return jsonResponse(lookupStatus, rows);
      }

      throw new Error('unexpected HTTP method');
    },
  };
}

function createService(store, session = checkoutSession()) {
  return createBillingProvisioningQueueService({
    stripeClient: {
      checkout: {
        sessions: {
          async retrieve() {
            return clone(session);
          },
        },
      },
    },
    fetchImpl: store.fetch.bind(store),
    getConfig: () => ({
      configured: true,
      url: 'https://unit.supabase.invalid',
      key: 'unit_service_role_key_not_a_secret',
    }),
  });
}

test('first delivery uses INSERT-only and confirms a durable pending row', async () => {
  const store = createQueueStore();
  const service = createService(store);

  const result = await service.ensureFromCheckoutSessionId('cs_queue_1', {
    eventId: 'evt_queue_1',
    webhookType: 'checkout.session.completed',
  });

  assert.equal(result.ok, true);
  assert.equal(result.durable, true);
  assert.equal(result.inserted, true);
  assert.equal(store.getRow().status, 'pending');
  assert.equal(store.requests.length, 1);
  assert.equal(store.requests[0].options.method, 'POST');
  assert.equal(store.requests[0].options.headers.Prefer, 'return=representation');
  assert.equal(store.requests[0].url.includes('on_conflict'), false);
  assert.equal(
    store.requests[0].options.headers.Prefer.includes('merge-duplicates'),
    false
  );
});

const preservedRows = [
  {
    name: 'pending redelivery',
    row: {
      id: 'queue_pending',
      checkout_session_id: 'cs_queue_1',
      status: 'pending',
      metadata: {
        activation: 'pending_activation',
      },
      updated_at: '2026-07-01T00:00:00.000Z',
    },
  },
  {
    name: 'contacted queue',
    row: {
      id: 'queue_contacted',
      checkout_session_id: 'cs_queue_1',
      status: 'contacted',
      metadata: {
        activation: 'contacted_activation',
      },
      updated_at: '2026-07-01T01:00:00.000Z',
    },
  },
  {
    name: 'in-progress queue',
    row: {
      id: 'queue_in_progress',
      checkout_session_id: 'cs_queue_1',
      status: 'in_progress',
      metadata: {
        activation: 'in_progress_activation',
      },
      updated_at: '2026-07-01T02:00:00.000Z',
    },
  },
  {
    name: 'configured queue',
    row: {
      id: 'queue_configured',
      checkout_session_id: 'cs_queue_1',
      status: 'configured',
      configured: true,
      metadata: {
        activation: 'configured_activation',
      },
      updated_at: '2026-07-02T00:00:00.000Z',
    },
  },
  {
    name: 'owner-prepared queue',
    row: {
      id: 'queue_owner',
      checkout_session_id: 'cs_queue_1',
      status: 'configured',
      owner: {
        id: 'owner_1',
      },
      onboarding_gate_token: 'existing_gate_token',
      gate_expires_at: '2026-08-01T00:00:00.000Z',
      notes: 'preserve this note',
      preparedAt: '2026-07-03T00:00:00.000Z',
      ownerAccessPreparedAt: '2026-07-03T00:01:00.000Z',
      metadata: {
        activation: {
          prepared: true,
        },
      },
      created_at: '2026-07-03T00:00:00.000Z',
      updated_at: '2026-07-03T00:01:00.000Z',
    },
  },
  {
    name: 'done queue',
    row: {
      id: 'queue_done',
      checkout_session_id: 'cs_queue_1',
      status: 'done',
      done: true,
      metadata: {
        activation: 'completed',
      },
      updated_at: '2026-07-04T00:00:00.000Z',
    },
  },
  {
    name: 'canceled queue',
    row: {
      id: 'queue_canceled',
      checkout_session_id: 'cs_queue_1',
      status: 'canceled',
      canceled: true,
      metadata: {
        activation: 'canceled',
      },
      updated_at: '2026-07-05T00:00:00.000Z',
    },
  },
];

for (const scenario of preservedRows) {
  test(scenario.name + ' is idempotent and preserved byte-for-byte', async () => {
    const store = createQueueStore(scenario.row);
    const before = store.getRow();
    const service = createService(store);

    const result = await service.ensureFromCheckoutSessionId('cs_queue_1', {
      eventId: 'evt_redelivery',
      webhookType: 'checkout.session.completed',
    });

    assert.equal(result.ok, true);
    assert.equal(result.durable, true);
    assert.equal(result.inserted, false);
    assert.equal(result.existing, true);
    assert.equal(result.reason, 'existing_queue_row');
    assert.deepEqual(store.getRow(), before);
    assert.deepEqual(
      store.requests.map((request) => request.options.method),
      ['POST', 'GET']
    );
  });
}

test('23505 without exactly the expected checkout row fails closed', async () => {
  const store = createQueueStore(null, {
    conflictWithoutRow: true,
  });
  const service = createService(store);

  const result = await service.ensureFromCheckoutSessionId('cs_queue_1');

  assert.equal(result.ok, false);
  assert.equal(result.durable, false);
  assert.equal(result.reason, 'unique_violation_without_expected_queue');
  assert.deepEqual(
    store.requests.map((request) => request.options.method),
    ['POST', 'GET']
  );
});

test('23505 lookup row without id fails closed', async () => {
  const store = createQueueStore({
    checkout_session_id: 'cs_queue_1',
    status: 'pending',
  });
  const service = createService(store);

  const result = await service.ensureFromCheckoutSessionId('cs_queue_1');

  assert.equal(result.ok, false);
  assert.equal(result.durable, false);
  assert.equal(result.reason, 'unique_violation_without_expected_queue');
});

test('23505 lookup row with an empty id fails closed', async () => {
  const store = createQueueStore({
    id: '   ',
    checkout_session_id: 'cs_queue_1',
    status: 'pending',
  });
  const service = createService(store);

  const result = await service.ensureFromCheckoutSessionId('cs_queue_1');

  assert.equal(result.ok, false);
  assert.equal(result.durable, false);
  assert.equal(result.reason, 'unique_violation_without_expected_queue');
});

test('23505 lookup row with an unknown status fails closed', async () => {
  const store = createQueueStore({
    id: 'queue_unknown',
    checkout_session_id: 'cs_queue_1',
    status: 'unexpected_status',
  });
  const service = createService(store);

  const result = await service.ensureFromCheckoutSessionId('cs_queue_1');

  assert.equal(result.ok, false);
  assert.equal(result.durable, false);
  assert.equal(result.reason, 'unique_violation_without_expected_queue');
});

test('23505 lookup returning two rows fails closed', async () => {
  const firstRow = {
    id: 'queue_duplicate_1',
    checkout_session_id: 'cs_queue_1',
    status: 'pending',
  };
  const store = createQueueStore(firstRow, {
    lookupRows: [
      firstRow,
      {
        id: 'queue_duplicate_2',
        checkout_session_id: 'cs_queue_1',
        status: 'pending',
      },
    ],
  });
  const service = createService(store);

  const result = await service.ensureFromCheckoutSessionId('cs_queue_1');

  assert.equal(result.ok, false);
  assert.equal(result.durable, false);
  assert.equal(result.reason, 'unique_violation_without_expected_queue');
});

test('23505 lookup HTTP failure fails closed', async () => {
  const store = createQueueStore({
    id: 'queue_lookup_failure',
    checkout_session_id: 'cs_queue_1',
    status: 'pending',
  }, {
    lookupStatus: 503,
  });
  const service = createService(store);

  const result = await service.ensureFromCheckoutSessionId('cs_queue_1');

  assert.equal(result.ok, false);
  assert.equal(result.durable, false);
  assert.equal(result.reason, 'existing_queue_lookup_failed');
});

test('retrieved checkout session id must exactly match the requested id', async () => {
  const store = createQueueStore();
  const service = createService(store, checkoutSession({
    id: 'cs_queue_different',
  }));

  const result = await service.ensureFromCheckoutSessionId('cs_queue_1');

  assert.equal(result.ok, false);
  assert.equal(result.durable, false);
  assert.equal(result.reason, 'checkout_session_id_mismatch');
  assert.equal(store.requests.length, 0);
});

test('unconfirmed payment never reaches the provisioning queue', async () => {
  const store = createQueueStore();
  const service = createService(store, checkoutSession({
    payment_status: 'unpaid',
  }));

  const result = await service.ensureFromCheckoutSessionId('cs_queue_1');

  assert.equal(result.ok, false);
  assert.equal(result.durable, false);
  assert.equal(result.reason, 'payment_not_confirmed');
  assert.equal(store.requests.length, 0);
});
