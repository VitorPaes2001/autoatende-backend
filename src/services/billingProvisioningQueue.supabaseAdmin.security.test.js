'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const previousStripeSecretKey = process.env.STRIPE_SECRET_KEY;
process.env.STRIPE_SECRET_KEY = 'unit_test_key_not_a_secret';

const servicePath = require.resolve('./billingProvisioningQueue.service');
const {
  buildQueuePayload,
  createBillingProvisioningQueueService,
} = require(servicePath);

const SUPABASE_ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_SERVICE_ROLE',
  'SUPABASE_SECRET_KEY',
  'SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
];

test.after(() => {
  if (previousStripeSecretKey === undefined) {
    delete process.env.STRIPE_SECRET_KEY;
  } else {
    process.env.STRIPE_SECRET_KEY = previousStripeSecretKey;
  }
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function checkoutSession() {
  return {
    id: 'cs_security_1',
    payment_status: 'paid',
    status: 'complete',
    mode: 'subscription',
    livemode: false,
    created: 123,
    customer: {
      id: 'cus_security_1',
      email: 'customer@example.test',
    },
    subscription: {
      id: 'sub_security_1',
      status: 'active',
    },
    customer_details: {
      name: 'Customer',
      email: 'customer@example.test',
      phone: '+5500000000000',
    },
    metadata: {
      planKey: 'profissional',
      companyName: 'Security Test Company',
    },
    amount_subtotal: 1000,
    amount_total: 1000,
    currency: 'brl',
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

function createService(fetchImpl, session = checkoutSession(), overrides = {}) {
  return createBillingProvisioningQueueService({
    stripeClient: {
      checkout: {
        sessions: {
          async retrieve(sessionId, options) {
            assert.equal(sessionId, session.id);
            assert.deepEqual(options, {
              expand: ['customer', 'subscription'],
            });
            return clone(session);
          },
        },
      },
    },
    fetchImpl,
    ...overrides,
  });
}

async function withSupabaseEnv(values, callback) {
  const previous = new Map(
    SUPABASE_ENV_KEYS.map((key) => [key, process.env[key]])
  );

  for (const key of SUPABASE_ENV_KEYS) {
    delete process.env[key];
  }

  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }

  try {
    return await callback();
  } finally {
    for (const key of SUPABASE_ENV_KEYS) {
      const value = previous.get(key);

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function assertAdminUnavailable(error) {
  assert.equal(error.name, 'SupabaseAdminUnavailableError');
  assert.equal(error.message, 'Supabase admin indisponível.');
  assert.equal(error.code, 'SUPABASE_ADMIN_UNAVAILABLE');
  assert.equal(error.statusCode, 503);
  return true;
}

test('module import is lazy and does not read admin config or call fetch', {
  concurrency: false,
}, () => {
  const previousServiceModule = require.cache[servicePath];
  const previousLoad = Module._load;
  const previousFetch = global.fetch;
  let configCalls = 0;
  let fetchCalls = 0;

  delete require.cache[servicePath];

  Module._load = function load(request, parent, isMain) {
    if (
      request === '../config/supabase' &&
      parent?.filename === servicePath
    ) {
      return {
        getSupabaseAdminConfig() {
          configCalls += 1;
          throw new Error('admin config must remain lazy');
        },
      };
    }

    return previousLoad.call(this, request, parent, isMain);
  };

  global.fetch = async function importFetchSentinel() {
    fetchCalls += 1;
    throw new Error('fetch must not run during import');
  };

  try {
    const imported = require(servicePath);

    assert.equal(typeof imported.ensureFromCheckoutSessionId, 'function');
    assert.equal(configCalls, 0);
    assert.equal(fetchCalls, 0);
  } finally {
    Module._load = previousLoad;
    global.fetch = previousFetch;
    delete require.cache[servicePath];

    if (previousServiceModule) {
      require.cache[servicePath] = previousServiceModule;
    }
  }
});

test('missing canonical admin config rejects centrally before fetch', {
  concurrency: false,
}, async () => {
  await withSupabaseEnv({}, async () => {
    let fetchCalls = 0;
    const service = createService(async () => {
      fetchCalls += 1;
      throw new Error('fetch must not run');
    });

    await assert.rejects(
      service.ensureFromCheckoutSessionId('cs_security_1'),
      assertAdminUnavailable
    );
    assert.equal(fetchCalls, 0);
  });
});

test('public, legacy, and anon aliases are ignored before fetch', {
  concurrency: false,
}, async () => {
  await withSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: 'https://public.supabase.invalid',
    VITE_SUPABASE_URL: 'https://vite.supabase.invalid',
    SUPABASE_SERVICE_KEY: 'legacy_service_key_not_a_secret',
    SUPABASE_SERVICE_ROLE: 'legacy_service_role_not_a_secret',
    SUPABASE_SECRET_KEY: 'legacy_secret_key_not_a_secret',
    SERVICE_ROLE_KEY: 'legacy_role_key_not_a_secret',
    SUPABASE_ANON_KEY: 'anon_key_not_a_secret_1234567890',
  }, async () => {
    let fetchCalls = 0;
    const service = createService(async () => {
      fetchCalls += 1;
      throw new Error('fetch must not run');
    });

    await assert.rejects(
      service.ensureFromCheckoutSessionId('cs_security_1'),
      assertAdminUnavailable
    );
    assert.equal(fetchCalls, 0);
  });
});

test('injected configured=false preserves the resolved unavailable contract', {
  concurrency: false,
}, async () => {
  let fetchCalls = 0;
  const service = createService(async () => {
    fetchCalls += 1;
    throw new Error('fetch must not run');
  }, checkoutSession(), {
    getConfig() {
      return {
        configured: false,
        url: 'https://unit.supabase.invalid',
        key: 'unit_service_role_key_1234567890',
      };
    },
  });

  const result = await service.ensureFromCheckoutSessionId('cs_security_1');

  assert.equal(result.ok, false);
  assert.equal(result.durable, false);
  assert.equal(result.inserted, false);
  assert.equal(result.upserted, false);
  assert.equal(result.reason, 'supabase_service_role_not_configured');
  assert.equal(fetchCalls, 0);
});

test('missing fetchImpl preserves the resolved unavailable contract', {
  concurrency: false,
}, async () => {
  await withSupabaseEnv({
    SUPABASE_URL: 'https://unit.supabase.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'unit_service_role_key_1234567890',
  }, async () => {
    const service = createService(null);
    const result = await service.ensureFromCheckoutSessionId('cs_security_1');

    assert.equal(result.ok, false);
    assert.equal(result.durable, false);
    assert.equal(result.inserted, false);
    assert.equal(result.upserted, false);
    assert.equal(result.reason, 'supabase_service_role_not_configured');
  });
});

test('canonical config preserves endpoint, headers, method, payload, and success', {
  concurrency: false,
}, async () => {
  const url = 'https://unit.supabase.invalid';
  const key = 'unit_service_role_key_1234567890';
  const session = checkoutSession();
  const context = {
    eventId: 'evt_security_1',
    webhookType: 'checkout.session.completed',
  };
  const requests = [];

  await withSupabaseEnv({
    SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: key,
  }, async () => {
    const service = createService(async (requestUrl, options) => {
      requests.push({ url: requestUrl, options });
      const payload = JSON.parse(options.body);

      return jsonResponse(201, [{
        id: 'queue_security_1',
        checkout_session_id: payload.checkout_session_id,
        status: payload.status,
      }]);
    }, session);

    const result = await service.ensureFromCheckoutSessionId(
      session.id,
      context
    );

    assert.equal(requests.length, 1);
    assert.equal(
      requests[0].url,
      'https://unit.supabase.invalid/rest/v1/billing_provisioning_queue'
    );
    assert.equal(requests[0].options.method, 'POST');
    assert.deepEqual(requests[0].options.headers, {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    });
    assert.deepEqual(
      JSON.parse(requests[0].options.body),
      buildQueuePayload(session, context)
    );
    assert.equal(result.ok, true);
    assert.equal(result.durable, true);
    assert.equal(result.inserted, true);
    assert.equal(result.upserted, true);
    assert.equal(result.queueId, 'queue_security_1');
  });
});

test('non-central network failure still rejects with the original error', {
  concurrency: false,
}, async () => {
  const networkError = new Error('unit network failure');
  let fetchCalls = 0;

  await withSupabaseEnv({
    SUPABASE_URL: 'https://unit.supabase.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'unit_service_role_key_1234567890',
  }, async () => {
    const service = createService(async () => {
      fetchCalls += 1;
      throw networkError;
    });

    await assert.rejects(
      service.ensureFromCheckoutSessionId('cs_security_1'),
      (error) => error === networkError
    );
    assert.equal(fetchCalls, 1);
  });
});

test('non-2xx REST response preserves the current resolved failure contract', {
  concurrency: false,
}, async () => {
  await withSupabaseEnv({
    SUPABASE_URL: 'https://unit.supabase.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'unit_service_role_key_1234567890',
  }, async () => {
    const service = createService(async () => jsonResponse(503, {
      code: 'REST_UNAVAILABLE',
    }));

    const result = await service.ensureFromCheckoutSessionId('cs_security_1');

    assert.equal(result.ok, false);
    assert.equal(result.durable, false);
    assert.equal(result.inserted, false);
    assert.equal(result.upserted, false);
    assert.equal(result.reason, 'supabase_insert_failed');
    assert.equal(result.httpStatus, 503);
    assert.equal(result.errorCode, 'REST_UNAVAILABLE');
  });
});

test('malformed successful REST payload remains unconfirmed and non-durable', {
  concurrency: false,
}, async () => {
  await withSupabaseEnv({
    SUPABASE_URL: 'https://unit.supabase.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'unit_service_role_key_1234567890',
  }, async () => {
    const service = createService(async () => ({
      ok: true,
      status: 201,
      async text() {
        return 'not-json';
      },
    }));

    const result = await service.ensureFromCheckoutSessionId('cs_security_1');

    assert.equal(result.ok, false);
    assert.equal(result.durable, false);
    assert.equal(result.inserted, false);
    assert.equal(result.upserted, false);
    assert.equal(result.reason, 'insert_response_not_confirmed');
    assert.equal(result.httpStatus, 201);
  });
});
