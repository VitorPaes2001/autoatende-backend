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
  createBillingWebhookService,
  getSupportedWebhookEventTypes,
  isSupportedWebhookEventType,
} = require('./billing.service');

const TEST_PLAN_CATALOG = {
  TEST: {
    name: 'Test Plan',
    stripePriceId: 'price_billing_1',
    limits: {
      conversations: 100,
      templates: 50,
    },
  },
};

function subscriptionEvent(
  type = 'customer.subscription.updated',
  objectOverrides = {}
) {
  return {
    id: 'evt_billing_1',
    type,
    data: {
      object: {
        id: 'sub_billing_1',
        customer: 'cus_billing_1',
        status: 'active',
        items: {
          data: [
            {
              price: {
                id: 'price_billing_1',
              },
            },
          ],
        },
        metadata: {
          clientId: 'client_billing_1',
        },
        ...objectOverrides,
      },
    },
  };
}

function createSupabaseHarness({
  lookupRow = null,
  lookupError = null,
  planData = { id: 'plan_db_1' },
  planError = null,
  subscriptionPersistenceError = null,
} = {}) {
  const calls = {
    lookup: 0,
    planUpsert: 0,
    subscriptionUpsert: 0,
    planPayloads: [],
    subscriptionPayloads: [],
  };

  return {
    calls,
    client: {
      from(table) {
        if (table === 'plans') {
          return {
            upsert(payload) {
              calls.planUpsert += 1;
              calls.planPayloads.push(payload);

              return {
                select() {
                  return {
                    async single() {
                      return {
                        data: planData,
                        error: planError,
                      };
                    },
                  };
                },
              };
            },
          };
        }

        if (table === 'subscriptions') {
          return {
            select() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      calls.lookup += 1;

                      return {
                        data: lookupRow,
                        error: lookupError,
                      };
                    },
                  };
                },
              };
            },
            async upsert(payload) {
              calls.subscriptionUpsert += 1;
              calls.subscriptionPayloads.push(payload);

              return {
                data: null,
                error: subscriptionPersistenceError,
              };
            },
          };
        }

        throw new Error('Unexpected table in billing service test');
      },
    },
  };
}

function createServiceHarness({
  customer = {
    metadata: {
      clientId: 'client_from_customer',
    },
  },
  customerError = null,
  planCatalog = TEST_PLAN_CATALOG,
  ...supabaseOptions
} = {}) {
  const supabaseHarness = createSupabaseHarness(supabaseOptions);
  const calls = {
    customerRetrieve: 0,
    audit: 0,
  };
  const service = createBillingWebhookService({
    stripeClient: {
      customers: {
        async retrieve() {
          calls.customerRetrieve += 1;

          if (customerError) throw customerError;
          return customer;
        },
      },
    },
    supabaseClient: supabaseHarness.client,
    planCatalog,
    logger: {
      log() {
        calls.audit += 1;
      },
    },
  });

  return {
    calls,
    service,
    supabase: supabaseHarness,
  };
}

test('supported event source is immutable and contains only implemented subscription cases', () => {
  const supportedEvents = getSupportedWebhookEventTypes();

  assert.equal(Object.isFrozen(supportedEvents), true);
  assert.deepEqual(supportedEvents, [
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
  ]);
  assert.throws(() => {
    supportedEvents.push('invoice.paid');
  }, TypeError);

  for (const eventType of supportedEvents) {
    assert.equal(isSupportedWebhookEventType(eventType), true);
  }

  assert.equal(isSupportedWebhookEventType('invoice.paid'), false);
  assert.equal(isSupportedWebhookEventType('invoice.payment_succeeded'), false);
  assert.equal(isSupportedWebhookEventType('invoice.payment_failed'), false);
});

for (const eventType of [
  'invoice.paid',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
]) {
  test(eventType + ' is explicitly unsupported and performs no billing effect', async () => {
    const harness = createServiceHarness();
    const result = await harness.service.handleWebhook({
      id: 'evt_invoice_1',
      type: eventType,
      data: {
        object: {
          id: 'in_billing_1',
        },
      },
    });

    assert.deepEqual(result, {
      ok: false,
      handled: false,
      eventType,
      code: 'UNSUPPORTED_EVENT',
    });
    assert.equal(harness.calls.customerRetrieve, 0);
    assert.equal(harness.calls.audit, 0);
    assert.equal(harness.supabase.calls.lookup, 0);
    assert.equal(harness.supabase.calls.planUpsert, 0);
    assert.equal(harness.supabase.calls.subscriptionUpsert, 0);
  });
}

for (const eventType of getSupportedWebhookEventTypes()) {
  test(eventType + ' returns explicit success only after persistence', async () => {
    const harness = createServiceHarness();
    const result = await harness.service.handleWebhook(subscriptionEvent(eventType));

    assert.deepEqual(result, {
      ok: true,
      handled: true,
      eventType,
    });
    assert.equal(harness.calls.customerRetrieve, 0);
    assert.equal(harness.calls.audit, 1);
    assert.equal(harness.supabase.calls.lookup, 0);
    assert.equal(harness.supabase.calls.planUpsert, 1);
    assert.equal(harness.supabase.calls.subscriptionUpsert, 1);
  });
}

test('missing required subscription data fails explicitly', async () => {
  const harness = createServiceHarness();
  const event = subscriptionEvent('customer.subscription.updated', {
    items: {
      data: [],
    },
  });

  await assert.rejects(
    () => harness.service.handleWebhook(event),
    (error) => {
      assert.equal(error.name, 'BillingWebhookError');
      assert.equal(error.code, 'BILLING_SUBSCRIPTION_DATA_INVALID');
      assert.equal(error.statusCode, 503);
      assert.equal(error.retryable, false);
      return true;
    }
  );
  assert.equal(harness.supabase.calls.planUpsert, 0);
  assert.equal(harness.supabase.calls.subscriptionUpsert, 0);
});

test('missing required client fails explicitly', async () => {
  const harness = createServiceHarness({
    customer: {
      metadata: {},
    },
    lookupRow: null,
  });
  const event = subscriptionEvent('customer.subscription.updated', {
    metadata: {},
  });

  await assert.rejects(
    () => harness.service.handleWebhook(event),
    (error) => {
      assert.equal(error.code, 'BILLING_CLIENT_NOT_FOUND');
      assert.equal(error.eventType, event.type);
      return true;
    }
  );
  assert.equal(harness.calls.customerRetrieve, 1);
  assert.equal(harness.supabase.calls.lookup, 1);
  assert.equal(harness.supabase.calls.planUpsert, 0);
});

test('subscription lookup error fails explicitly', async () => {
  const harness = createServiceHarness({
    customer: {
      metadata: {},
    },
    lookupError: {
      code: 'lookup_failed',
    },
  });
  const event = subscriptionEvent('customer.subscription.updated', {
    metadata: {},
  });

  await assert.rejects(
    () => harness.service.handleWebhook(event),
    (error) => {
      assert.equal(error.code, 'BILLING_SUBSCRIPTION_LOOKUP_FAILED');
      return true;
    }
  );
  assert.equal(harness.supabase.calls.planUpsert, 0);
});

test('missing price mapping fails instead of selecting a fallback plan', async () => {
  const harness = createServiceHarness({
    planCatalog: {},
  });
  const event = subscriptionEvent();

  await assert.rejects(
    () => harness.service.handleWebhook(event),
    (error) => {
      assert.equal(error.code, 'BILLING_PLAN_MAPPING_NOT_FOUND');
      return true;
    }
  );
  assert.equal(harness.supabase.calls.planUpsert, 0);
  assert.equal(harness.supabase.calls.subscriptionUpsert, 0);
});

test('plan persistence error fails explicitly', async () => {
  const harness = createServiceHarness({
    planError: {
      code: 'plan_upsert_failed',
    },
  });

  await assert.rejects(
    () => harness.service.handleWebhook(subscriptionEvent()),
    (error) => {
      assert.equal(error.code, 'BILLING_PLAN_PERSIST_FAILED');
      return true;
    }
  );
  assert.equal(harness.supabase.calls.planUpsert, 1);
  assert.equal(harness.supabase.calls.subscriptionUpsert, 0);
});

test('subscription persistence error fails explicitly', async () => {
  const harness = createServiceHarness({
    subscriptionPersistenceError: {
      code: 'subscription_upsert_failed',
    },
  });

  await assert.rejects(
    () => harness.service.handleWebhook(subscriptionEvent()),
    (error) => {
      assert.equal(error.code, 'BILLING_SUBSCRIPTION_PERSIST_FAILED');
      return true;
    }
  );
  assert.equal(harness.supabase.calls.planUpsert, 1);
  assert.equal(harness.supabase.calls.subscriptionUpsert, 1);
  assert.equal(harness.calls.audit, 0);
});

test('unexpected dependency exception is sanitized into a typed operational failure', async () => {
  const harness = createServiceHarness({
    customerError: new Error('internal dependency detail'),
  });
  const event = subscriptionEvent('customer.subscription.updated', {
    metadata: {},
  });

  await assert.rejects(
    () => harness.service.handleWebhook(event),
    (error) => {
      assert.equal(error.name, 'BillingWebhookError');
      assert.equal(error.code, 'BILLING_WEBHOOK_OPERATION_FAILED');
      assert.equal(error.message, 'Billing webhook operation failed.');
      assert.equal(error.eventType, event.type);
      assert.equal(error.message.includes('internal dependency detail'), false);
      return true;
    }
  );
  assert.equal(harness.supabase.calls.planUpsert, 0);
});

test('unknown event returns an explicit unsupported result', async () => {
  const harness = createServiceHarness();
  const result = await harness.service.handleWebhook({
    id: 'evt_unknown_1',
    type: 'customer.created',
    data: {
      object: {},
    },
  });

  assert.deepEqual(result, {
    ok: false,
    handled: false,
    eventType: 'customer.created',
    code: 'UNSUPPORTED_EVENT',
  });
  assert.equal(harness.supabase.calls.planUpsert, 0);
  assert.equal(harness.supabase.calls.subscriptionUpsert, 0);
});
