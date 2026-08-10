'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

function adminUnavailableError() {
  const error = new Error('Supabase admin indisponível.');
  error.name = 'SupabaseAdminUnavailableError';
  error.code = 'SUPABASE_ADMIN_UNAVAILABLE';
  error.statusCode = 503;
  delete error.stack;
  return error;
}

function isAdminUnavailable(error) {
  return Boolean(
    error &&
    error.name === 'SupabaseAdminUnavailableError' &&
    error.code === 'SUPABASE_ADMIN_UNAVAILABLE' &&
    Number(error.statusCode) === 503
  );
}

function unavailableConfig(overrides = {}) {
  const fail = () => {
    throw adminUnavailableError();
  };

  return {
    from: fail,
    rpc: fail,
    getSupabaseAdminClient: fail,
    getSupabaseAdminConfig: fail,
    createSupabaseAdminUnavailableError: adminUnavailableError,
    isSupabaseAdminUnavailableError: isAdminUnavailable,
    auth: {
      getUser: fail,
      admin: {
        createUser: fail,
        deleteUser: fail,
      },
    },
    storage: {
      from: fail,
    },
    ...overrides,
  };
}

function loadWithMocks(relativePath, mocks) {
  const targetPath = require.resolve(relativePath);
  const previousCacheEntry = require.cache[targetPath];
  const originalLoad = Module._load;

  delete require.cache[targetPath];

  Module._load = function mockedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  let exported;

  try {
    exported = require(targetPath);
  } finally {
    Module._load = originalLoad;
  }

  return {
    exported,
    restore() {
      delete require.cache[targetPath];
      if (previousCacheEntry) require.cache[targetPath] = previousCacheEntry;
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
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function expressHarness() {
  const routes = new Map();
  const router = {
    errorHandler: null,
    get(path, handler) {
      routes.set(path, handler);
      return this;
    },
    use(handler) {
      this.errorHandler = handler;
      return this;
    },
  };

  return {
    express: {
      Router() {
        return router;
      },
    },
    router,
    routes,
  };
}

function billingDependencies(config) {
  return {
    '../config/supabase': config,
    '../config/stripe': {
      customers: {},
      subscriptions: {},
      billingPortal: { sessions: {} },
    },
    './company.service': {
      getCompany: async () => null,
      getSubscription: async () => null,
    },
    './metrics.service': {},
    '../config/plans': {
      PLANS: {
        TEST: {
          name: 'Test',
          stripePriceId: 'price-test',
          limits: {
            conversations: 10,
            templates: 10,
          },
        },
      },
      getPlanByName() {
        return {
          name: 'Starter',
          limits: {
            agents: 1,
            templates: 300,
          },
          features: [],
        };
      },
    },
    './overageBilling.service': {
      getMonthlyUsageSummary: async () => null,
    },
  };
}

function usageDependencies(config) {
  return {
    '../config/supabase': config,
    './conversationWindow.service': {
      checkActiveWindow: async () => ({ active: false }),
    },
    './company.service': {
      getCompany: async () => ({ client_id: 'client-1' }),
      getSubscription: async () => ({
        status: 'active',
        plan: { templates_limit: 10 },
      }),
    },
    '../utils/AppError': class AppError extends Error {
      constructor(message, statusCode, details) {
        super(message);
        this.statusCode = statusCode;
        Object.assign(this, details || {});
      }
    },
  };
}

async function withNodeEnv(value, callback) {
  const present = Object.prototype.hasOwnProperty.call(process.env, 'NODE_ENV');
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = value;

  try {
    return await callback();
  } finally {
    if (present) process.env.NODE_ENV = previous;
    else delete process.env.NODE_ENV;
  }
}

test('admin provisioning queue propagates the central unavailable error before fetch', { concurrency: false }, async () => {
  const loaded = loadWithMocks('./adminProvisioningQueue.service', {
    '../config/supabase': unavailableConfig(),
  });
  const originalFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error('fetch must not run');
  };

  try {
    await assert.rejects(
      loaded.exported.listQueue(),
      (error) => isAdminUnavailable(error)
    );
    assert.equal(fetchCalls, 0);
  } finally {
    global.fetch = originalFetch;
    loaded.restore();
  }
});

test('tenant-aware route maps the central unavailable error to its sanitized 503 response', { concurrency: false }, async () => {
  const express = expressHarness();
  const loaded = loadWithMocks('../routes/customerBillingPlanStatusTenantAware.routes', {
    express: express.express,
    '../config/supabase': unavailableConfig(),
  });

  try {
    const handler = express.routes.get('/api/billing/status');
    const response = responseRecorder();
    let forwardedError = null;

    await handler(
      { headers: { authorization: 'Bearer test-token' } },
      response,
      (error) => {
        forwardedError = error;
      }
    );

    assert.equal(isAdminUnavailable(forwardedError), true);
    assert.equal(typeof express.router.errorHandler, 'function');

    express.router.errorHandler(
      forwardedError,
      {},
      response,
      () => assert.fail('central error must be handled')
    );

    assert.equal(response.statusCode, 503);
    assert.equal(response.body.error, 'billing_admin_unavailable');
    assert.equal(response.body.details, null);
  } finally {
    loaded.restore();
  }
});

test('billing service rethrows the central error instead of returning the Starter fallback', { concurrency: false }, async () => {
  const loaded = loadWithMocks('./billing.service', billingDependencies(unavailableConfig()));

  try {
    await assert.rejects(
      loaded.exported.getBillingStatus('company-1', 'client-1'),
      (error) => isAdminUnavailable(error)
    );
  } finally {
    loaded.restore();
  }
});

test('billing webhook keeps the central error identity instead of wrapping it', { concurrency: false }, async () => {
  const loaded = loadWithMocks('./billing.service', billingDependencies(unavailableConfig()));

  try {
    const service = loaded.exported.createBillingWebhookService({
      stripeClient: { customers: {} },
      supabaseClient: unavailableConfig(),
      planCatalog: {
        TEST: {
          name: 'Test',
          stripePriceId: 'price-test',
          limits: {
            conversations: 10,
            templates: 10,
          },
        },
      },
      logger: { log() {} },
    });

    await assert.rejects(
      service.handleWebhook({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'subscription-1',
            customer: 'customer-1',
            status: 'active',
            items: {
              data: [{ price: { id: 'price-test' } }],
            },
            metadata: { clientId: 'client-1' },
          },
        },
      }),
      (error) => isAdminUnavailable(error)
    );
  } finally {
    loaded.restore();
  }
});

test('billing controller maps the central error to a sanitized 503 response', { concurrency: false }, async () => {
  const loaded = loadWithMocks('../controllers/billing.controller', {
    '../services/billing.service': {
      getBillingStatus: async () => {
        throw adminUnavailableError();
      },
    },
    '../config/plans': {
      getCommercialPlanByAnyKey: () => null,
      COMMERCIAL_ADDONS: [],
    },
    '../services/overageBilling.service': {
      getMonthlyUsageSummary: async () => null,
    },
    '../services/templateUsageCategories.service': {
      canonicalizeTemplateUsagePayload: (value) => value,
      extractTemplateUsageByCategory: () => ({}),
    },
    '../config/supabase': unavailableConfig(),
  });

  try {
    const response = responseRecorder();

    await loaded.exported.getStatus(
      {
        user: { id: 'client-1' },
        companyId: 'company-1',
      },
      response
    );

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, {
      error: 'Serviço administrativo de billing temporariamente indisponível.',
      code: 'SUPABASE_ADMIN_UNAVAILABLE',
    });
  } finally {
    loaded.restore();
  }
});

test('usage entry points never degrade the central unavailable error in non-production', { concurrency: false }, async () => {
  await withNodeEnv('development', async () => {
    const loaded = loadWithMocks('./usage.service', usageDependencies(unavailableConfig()));

    try {
      const calls = [
        () => loaded.exported.authorizeAction({
          companyId: 'company-1',
          type: 'template',
          contact: 'contact-1',
        }),
        () => loaded.exported.consumeTemplateUsageByCategory({
          companyId: 'company-1',
          templateCategory: 'marketing',
        }),
        () => loaded.exported.consumeUsage({
          clientId: 'client-1',
          isNewConversation: true,
          requiresTemplate: true,
          plan: { templates_limit: 10 },
        }),
      ];

      for (const callback of calls) {
        await assert.rejects(callback(), (error) => isAdminUnavailable(error));
      }
    } finally {
      loaded.restore();
    }
  });
});

test('template category accounting propagates a central error from its secondary write', { concurrency: false }, async () => {
  await withNodeEnv('development', async () => {
    const centralError = adminUnavailableError();
    const config = unavailableConfig({
      rpc: async () => ({
        data: [{
          allowed: true,
          templates_used: 1,
          conversations_used: 0,
          overage_templates: 0,
          reason: 'OK',
        }],
        error: null,
      }),
      from() {
        throw centralError;
      },
    });
    const loaded = loadWithMocks('./usage.service', usageDependencies(config));

    try {
      await assert.rejects(
        loaded.exported.consumeTemplateUsageByCategory({
          companyId: 'company-1',
          templateCategory: 'marketing',
        }),
        (error) => error === centralError
      );
    } finally {
      loaded.restore();
    }
  });
});

test('ordinary billing and usage failures retain their existing fallbacks', { concurrency: false }, async () => {
  const ordinary = new Error('ordinary dependency failure');
  const ordinaryConfig = unavailableConfig({
    from() {
      throw ordinary;
    },
    rpc() {
      throw ordinary;
    },
  });

  const billing = loadWithMocks('./billing.service', billingDependencies(ordinaryConfig));

  try {
    const status = await billing.exported.getBillingStatus('company-1', 'client-1');
    assert.equal(status.plan, 'Starter');
    assert.equal(status.status, 'inactive');
  } finally {
    billing.restore();
  }

  await withNodeEnv('development', async () => {
    const usage = loadWithMocks('./usage.service', usageDependencies(ordinaryConfig));

    try {
      const result = await usage.exported.consumeUsage({
        clientId: 'client-1',
        isNewConversation: true,
        requiresTemplate: true,
        plan: { templates_limit: 10 },
      });

      assert.equal(result.allowed, true);
      assert.equal(result.degraded, true);
    } finally {
      usage.restore();
    }
  });
});
