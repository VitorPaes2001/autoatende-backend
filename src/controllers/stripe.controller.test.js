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
  createWebhookHandler,
} = require('./stripe.controller');
const billingService = require('../services/billing.service');

function checkoutEvent() {
  return {
    id: 'evt_checkout_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_checkout_1',
      },
    },
  };
}

function billingEvent(type = 'customer.subscription.updated') {
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
      },
    },
  };
}

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function requestFor({ rawBody = true } = {}) {
  return {
    headers: {
      'stripe-signature': 'unit-signature',
    },
    rawBody: rawBody ? Buffer.from('{}') : undefined,
    body: rawBody ? undefined : {},
  };
}

function createHarness({
  claimImplementation,
  queueImplementation,
  processedImplementation,
  failedImplementation,
  emailImplementation,
  constructImplementation,
  billingImplementation,
  billingSupportImplementation,
  eventOverride,
  billingHandlerAvailable = true,
  queueInterfaceAvailable = true,
  legacyQueueImplementation,
} = {}) {
  const event = eventOverride || checkoutEvent();
  const calls = {
    claim: 0,
    queue: 0,
    processed: 0,
    failed: 0,
    email: 0,
    billing: 0,
    billingSupport: 0,
    legacyQueue: 0,
    construct: 0,
    order: [],
  };

  const eventLedger = {
    async claimEvent(receivedEvent) {
      calls.claim += 1;
      calls.order.push('claim');

      if (claimImplementation) {
        return claimImplementation(receivedEvent, calls);
      }

      return {
        result: 'CLAIMED',
        eventId: receivedEvent.id,
        attemptCount: 1,
      };
    },
    async markProcessed(eventId, attemptCount) {
      calls.processed += 1;
      calls.order.push('processed');

      if (processedImplementation) {
        return processedImplementation(eventId, attemptCount, calls);
      }

      return {
        ok: true,
        result: 'UPDATED',
      };
    },
    async markFailed(eventId, attemptCount, error) {
      calls.failed += 1;
      calls.order.push('failed');

      if (failedImplementation) {
        return failedImplementation(eventId, attemptCount, error, calls);
      }

      return {
        ok: true,
        result: 'UPDATED',
      };
    },
  };

  const queueService = {};

  if (queueInterfaceAvailable) {
    queueService.ensureFromCheckoutSessionId = async function ensureFromCheckoutSessionId(
      sessionId,
      context
    ) {
      calls.queue += 1;
      calls.order.push('queue');

      if (queueImplementation) {
        return queueImplementation(sessionId, context, calls);
      }

      return {
        ok: true,
        durable: true,
        inserted: true,
        checkoutSessionId: sessionId,
      };
    };
  }

  if (legacyQueueImplementation) {
    queueService.upsertFromCheckoutSessionId = async function upsertFromCheckoutSessionId(
      sessionId,
      context
    ) {
      calls.legacyQueue += 1;
      calls.order.push('legacy_queue');
      return legacyQueueImplementation(sessionId, context, calls);
    };
  }

  const emailService = {
    async sendCheckoutConfirmationEmail(sessionId) {
      calls.email += 1;
      calls.order.push('email');

      if (emailImplementation) {
        return emailImplementation(sessionId, calls);
      }

      return {
        sent: true,
      };
    },
  };

  const stripeClient = {
    webhooks: {
      constructEvent() {
        calls.construct += 1;

        if (constructImplementation) {
          return constructImplementation(calls);
        }

        return event;
      },
    },
  };

  const billingWebhookService = {
    isSupportedWebhookEventType(receivedEventType) {
      calls.billingSupport += 1;

      if (billingSupportImplementation) {
        return billingSupportImplementation(receivedEventType, calls);
      }

      return receivedEventType === event.type;
    },
  };

  if (billingHandlerAvailable) {
    billingWebhookService.handleWebhook = async function handleWebhook(receivedEvent) {
      calls.billing += 1;

      if (billingImplementation) {
        return billingImplementation(receivedEvent, calls);
      }

      return {
        ok: true,
        handled: true,
        eventType: receivedEvent.type,
      };
    };
  }

  const handler = createWebhookHandler({
    stripeClient,
    billingWebhookService,
    eventLedger,
    emailService,
    queueService,
    webhookSecretProvider: () => 'unit-webhook-secret',
    logger: {
      log() {},
      error() {},
    },
  });

  return {
    calls,
    event,
    handler,
  };
}

async function invoke(harness, request = requestFor()) {
  const response = responseRecorder();
  await harness.handler(request, response);
  return response;
}

test('new event claims, persists queue, marks processed, emails, then returns 200', async () => {
  const harness = createHarness();
  const response = await invoke(harness);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.received, true);
  assert.equal(response.body.duplicate, false);
  assert.deepEqual(harness.calls.order, ['claim', 'queue', 'processed', 'email']);
});

test('ledger unavailable never returns 2xx and performs no effects', async () => {
  const harness = createHarness({
    claimImplementation() {
      const error = new Error('ledger unavailable');
      error.statusCode = 503;
      throw error;
    },
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 503);
  assert.equal(harness.calls.queue, 0);
  assert.equal(harness.calls.processed, 0);
  assert.equal(harness.calls.failed, 0);
  assert.equal(harness.calls.email, 0);
});

test('queue failure result marks failed and never returns 2xx', async () => {
  const harness = createHarness({
    queueImplementation() {
      return {
        ok: false,
        durable: false,
        reason: 'insert_failed',
      };
    },
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 503);
  assert.equal(harness.calls.failed, 1);
  assert.equal(harness.calls.processed, 0);
  assert.equal(harness.calls.email, 0);
});

test('queue exception marks failed and never returns 2xx', async () => {
  const harness = createHarness({
    queueImplementation() {
      throw new Error('queue unavailable');
    },
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 503);
  assert.equal(harness.calls.failed, 1);
  assert.equal(harness.calls.processed, 0);
  assert.equal(harness.calls.email, 0);
});

test('central admin exception is sanitized to retryable 503 and marks failed', async () => {
  const harness = createHarness({
    queueImplementation() {
      const error = new Error('Supabase admin indisponível.');
      error.name = 'SupabaseAdminUnavailableError';
      error.code = 'SUPABASE_ADMIN_UNAVAILABLE';
      error.statusCode = 503;
      throw error;
    },
    failedImplementation(eventId, attemptCount, error) {
      assert.equal(error.code, 'PROVISIONING_QUEUE_WRITE_FAILED');
      assert.equal(error.statusCode, 503);
      return {
        ok: true,
        result: 'UPDATED',
      };
    },
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'PROVISIONING_QUEUE_WRITE_FAILED');
  assert.equal(harness.calls.failed, 1);
  assert.equal(harness.calls.processed, 0);
  assert.equal(harness.calls.email, 0);
});

test('processed duplicate returns 200 without Stripe retrieve, queue, email, or billing', async () => {
  const harness = createHarness({
    claimImplementation(receivedEvent) {
      return {
        result: 'ALREADY_PROCESSED',
        eventId: receivedEvent.id,
        attemptCount: 1,
      };
    },
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.duplicate, true);
  assert.equal(harness.calls.queue, 0);
  assert.equal(harness.calls.email, 0);
  assert.equal(harness.calls.billing, 0);
  assert.equal(harness.calls.processed, 0);
});

test('recent processing returns retryable 503 without effects', async () => {
  const harness = createHarness({
    claimImplementation(receivedEvent) {
      return {
        result: 'IN_PROGRESS',
        eventId: receivedEvent.id,
        attemptCount: 2,
      };
    },
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 503);
  assert.equal(harness.calls.queue, 0);
  assert.equal(harness.calls.processed, 0);
  assert.equal(harness.calls.failed, 0);
  assert.equal(harness.calls.email, 0);
});

test('invoice.paid uses the real billing support contract and is not forwarded', async () => {
  const harness = createHarness({
    eventOverride: billingEvent('invoice.paid'),
    billingSupportImplementation: billingService.isSupportedWebhookEventType,
    billingImplementation() {
      throw new Error('unsupported billing handler must not run');
    },
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.billingForwarded, false);
  assert.equal(response.body.billingResult, null);
  assert.equal(harness.calls.billingSupport, 1);
  assert.equal(harness.calls.billing, 0);
  assert.equal(harness.calls.processed, 1);
  assert.equal(harness.calls.failed, 0);
});

test('supported billing event requires explicit success before markProcessed', async () => {
  const harness = createHarness({
    eventOverride: billingEvent(),
    billingSupportImplementation: billingService.isSupportedWebhookEventType,
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.billingForwarded, true);
  assert.deepEqual(response.body.billingResult, {
    ok: true,
    handled: true,
    eventType: 'customer.subscription.updated',
  });
  assert.equal(harness.calls.billing, 1);
  assert.equal(harness.calls.processed, 1);
  assert.equal(harness.calls.failed, 0);
});

const invalidBillingResults = [
  {
    name: 'undefined',
    result: undefined,
  },
  {
    name: 'null',
    result: null,
  },
  {
    name: 'handled=false',
    result: {
      ok: true,
      handled: false,
      eventType: 'customer.subscription.updated',
    },
  },
  {
    name: 'ok=false',
    result: {
      ok: false,
      handled: true,
      eventType: 'customer.subscription.updated',
    },
  },
  {
    name: 'mismatched eventType',
    result: {
      ok: true,
      handled: true,
      eventType: 'customer.subscription.created',
    },
  },
  {
    name: 'bare true',
    result: true,
  },
  {
    name: 'empty object',
    result: {},
  },
];

for (const scenario of invalidBillingResults) {
  test('supported billing event fails closed for ' + scenario.name, async () => {
    const harness = createHarness({
      eventOverride: billingEvent(),
      billingSupportImplementation: billingService.isSupportedWebhookEventType,
      billingImplementation() {
        return scenario.result;
      },
    });
    const response = await invoke(harness);

    assert.equal(response.statusCode, 503);
    assert.equal(response.body.code, 'BILLING_WEBHOOK_RESULT_INVALID');
    assert.equal(response.body.billingForwarded, undefined);
    assert.equal(harness.calls.billing, 1);
    assert.equal(harness.calls.processed, 0);
    assert.equal(harness.calls.failed, 1);
  });
}

test('real billing service operational failure cannot finish with 200', async () => {
  const strictBillingService = billingService.createBillingWebhookService({
    stripeClient: {
      customers: {
        async retrieve() {
          return {
            metadata: {},
          };
        },
      },
    },
    supabaseClient: {
      from(table) {
        assert.equal(table, 'subscriptions');

        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: null,
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
    planCatalog: {},
    logger: {
      log() {},
    },
  });
  const event = billingEvent();
  event.data.object.metadata = {};
  const harness = createHarness({
    eventOverride: event,
    billingSupportImplementation: strictBillingService.isSupportedWebhookEventType,
    billingImplementation(receivedEvent) {
      return strictBillingService.handleWebhook(receivedEvent);
    },
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'BILLING_CLIENT_NOT_FOUND');
  assert.equal(harness.calls.billing, 1);
  assert.equal(harness.calls.processed, 0);
  assert.equal(harness.calls.failed, 1);
});

test('required billing forwarding without a handler fails closed', async () => {
  const harness = createHarness({
    eventOverride: billingEvent(),
    billingHandlerAvailable: false,
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'BILLING_WEBHOOK_SERVICE_UNAVAILABLE');
  assert.equal(response.body.billingForwarded, undefined);
  assert.equal(harness.calls.billing, 0);
  assert.equal(harness.calls.processed, 0);
  assert.equal(harness.calls.failed, 1);
});

test('required billing forwarding exception fails closed', async () => {
  const harness = createHarness({
    eventOverride: billingEvent('customer.subscription.updated'),
    billingImplementation() {
      throw new Error('billing unavailable');
    },
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 500);
  assert.equal(harness.calls.billing, 1);
  assert.equal(harness.calls.processed, 0);
  assert.equal(harness.calls.failed, 1);
});

test('lost claim from markProcessed prevents email and 2xx', async () => {
  const harness = createHarness({
    processedImplementation() {
      return {
        ok: false,
        result: 'CLAIM_LOST',
      };
    },
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'STRIPE_WEBHOOK_EVENT_CLAIM_LOST');
  assert.equal(harness.calls.email, 0);
  assert.equal(harness.calls.failed, 1);
});

test('markFailed exception preserves the original queue error response', async () => {
  const harness = createHarness({
    queueImplementation() {
      return {
        ok: false,
        durable: false,
      };
    },
    failedImplementation() {
      throw new Error('ledger failed close unavailable');
    },
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'PROVISIONING_QUEUE_NOT_DURABLE');
  assert.equal(harness.calls.processed, 0);
  assert.equal(harness.calls.failed, 1);
});

test('markFailed negative result preserves the original queue error response', async () => {
  const harness = createHarness({
    queueImplementation() {
      return {
        ok: false,
        durable: false,
      };
    },
    failedImplementation() {
      return {
        ok: false,
        result: 'CLAIM_LOST',
      };
    },
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'PROVISIONING_QUEUE_NOT_DURABLE');
  assert.equal(harness.calls.processed, 0);
  assert.equal(harness.calls.failed, 1);
});

test('missing safe queue interface never calls the legacy upsert fallback', async () => {
  const harness = createHarness({
    queueInterfaceAvailable: false,
    legacyQueueImplementation() {
      return {
        ok: true,
        durable: true,
      };
    },
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'PROVISIONING_QUEUE_SERVICE_UNAVAILABLE');
  assert.equal(harness.calls.claim, 0);
  assert.equal(harness.calls.queue, 0);
  assert.equal(harness.calls.legacyQueue, 0);
  assert.equal(harness.calls.processed, 0);
  assert.equal(harness.calls.failed, 0);
});

test('redelivery preserves an existing queue after failure before markProcessed and completes', async () => {
  let queueRow = null;
  let processedAttempts = 0;

  const harness = createHarness({
    claimImplementation(receivedEvent, calls) {
      return {
        result: calls.claim === 1 ? 'CLAIMED' : 'RETRY_CLAIMED',
        eventId: receivedEvent.id,
        attemptCount: calls.claim,
      };
    },
    queueImplementation(sessionId) {
      if (!queueRow) {
        queueRow = {
          checkoutSessionId: sessionId,
          status: 'pending',
          metadata: {
            activation: 'untouched',
          },
        };

        return {
          ok: true,
          durable: true,
          inserted: true,
          checkoutSessionId: sessionId,
        };
      }

      return {
        ok: true,
        durable: true,
        inserted: false,
        existing: true,
        checkoutSessionId: sessionId,
      };
    },
    processedImplementation() {
      processedAttempts += 1;

      if (processedAttempts === 1) {
        throw new Error('ledger close unavailable');
      }

      return {
        ok: true,
        result: 'UPDATED',
      };
    },
  });

  const firstResponse = await invoke(harness);
  const snapshotAfterFailure = JSON.parse(JSON.stringify(queueRow));
  const secondResponse = await invoke(harness);

  assert.equal(firstResponse.statusCode, 500);
  assert.equal(secondResponse.statusCode, 200);
  assert.equal(harness.calls.failed, 1);
  assert.equal(harness.calls.queue, 2);
  assert.deepEqual(queueRow, snapshotAfterFailure);
});

test('invalid signature returns 400 before claim', async () => {
  const harness = createHarness({
    constructImplementation() {
      throw new Error('invalid signature');
    },
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 400);
  assert.equal(harness.calls.claim, 0);
  assert.equal(harness.calls.queue, 0);
});

test('missing raw body returns 400 before signature verification and claim', async () => {
  const harness = createHarness();
  const response = await invoke(harness, requestFor({ rawBody: false }));

  assert.equal(response.statusCode, 400);
  assert.equal(harness.calls.construct, 0);
  assert.equal(harness.calls.claim, 0);
});

test('email failure remains best effort after critical persistence', async () => {
  const harness = createHarness({
    emailImplementation() {
      throw new Error('email unavailable');
    },
  });
  const response = await invoke(harness);

  assert.equal(response.statusCode, 200);
  assert.equal(harness.calls.processed, 1);
  assert.equal(harness.calls.failed, 0);
  assert.equal(response.body.confirmationEmail.reason, 'confirmation_email_error');
});
