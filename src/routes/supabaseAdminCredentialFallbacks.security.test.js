'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const centralSupabase = require('../config/supabase');

const ROUTE_PATH = require.resolve('./inboxLabels.routes');
const MARKER = '__AUTOATENDE_V4_R15A_R2C_FIX_INBOX_LABELS_ROUTE_MOUNT__';
const ADMIN_UNAVAILABLE_BODY = {
  error: 'Supabase admin indisponível.',
  code: 'SUPABASE_ADMIN_UNAVAILABLE'
};
const CANONICAL_ENV = {
  SUPABASE_URL: 'https://tenant.supabase.test/',
  SUPABASE_SERVICE_ROLE_KEY: 'service_role_key_for_unit_tests'
};
const ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_SERVICE_ROLE',
  'SUPABASE_SECRET_KEY',
  'SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'VITE_SUPABASE_URL'
];
const EXPECTED_CATALOG = [
  { key: 'novo_lead', label: 'Novo lead', tone: 'green' },
  { key: 'aguardando_cliente', label: 'Aguardando cliente', tone: 'blue' },
  { key: 'aguardando_equipe', label: 'Aguardando equipe', tone: 'amber' },
  { key: 'resolvido', label: 'Resolvido', tone: 'emerald' },
  { key: 'urgente', label: 'Urgente', tone: 'red' },
  { key: 'comercial', label: 'Comercial', tone: 'teal' },
  { key: 'suporte', label: 'Suporte', tone: 'slate' },
  { key: 'financeiro', label: 'Financeiro', tone: 'violet' }
];

function createExpressHarness() {
  const routes = new Map();
  const router = {
    get(path, ...handlers) {
      routes.set('GET ' + path, handlers);
      return this;
    },
    patch(path, ...handlers) {
      routes.set('PATCH ' + path, handlers);
      return this;
    }
  };

  return {
    express: {
      Router() {
        return router;
      }
    },
    routes
  };
}

function createCentralConfigHarness() {
  const state = { calls: 0 };

  return {
    state,
    exports: {
      getSupabaseAdminConfig() {
        state.calls += 1;
        return centralSupabase.getSupabaseAdminConfig();
      },
      isSupabaseAdminUnavailableError: centralSupabase.isSupabaseAdminUnavailableError
    }
  };
}

function loadRoute(configExports) {
  const previousCacheEntry = require.cache[ROUTE_PATH];
  const originalLoad = Module._load;
  const expressHarness = createExpressHarness();
  const trace = [];
  let allowedRoles = null;

  function authMiddleware(req, res, next) {
    trace.push('auth');
    req.user = {
      id: 'user-1',
      role: 'company',
      company_id: 'company-1'
    };
    req.companyId = 'company-1';
    return next();
  }

  function requireRole(roles) {
    allowedRoles = Array.isArray(roles) ? roles.slice() : roles;

    return (req, res, next) => {
      trace.push('role');

      if (!req.user || !req.user.role || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      return next();
    };
  }

  delete require.cache[ROUTE_PATH];

  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === 'express') return expressHarness.express;
    if (request === '../config/supabase') return configExports;
    if (request === '../middlewares/auth.middleware') return authMiddleware;
    if (request === '../middlewares/role.middleware') return requireRole;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    require(ROUTE_PATH);
  } finally {
    Module._load = originalLoad;
  }

  return {
    routes: expressHarness.routes,
    trace,
    getAllowedRoles() {
      return allowedRoles;
    },
    restore() {
      delete require.cache[ROUTE_PATH];
      if (previousCacheEntry) require.cache[ROUTE_PATH] = previousCacheEntry;
    }
  };
}

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    sent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.sent = true;
      return this;
    }
  };
}

function createRequest({ query = {}, body = {} } = {}) {
  return {
    headers: { authorization: 'Bearer unit-token' },
    query: { ...query },
    body: { ...body },
    originalUrl: '/api/inbox-labels'
  };
}

async function invokeHandlers(handlers, req, res) {
  assert.ok(Array.isArray(handlers), 'target route must be registered');

  let cursor = 0;
  let escapedNextCalls = 0;

  async function dispatch() {
    if (cursor >= handlers.length) {
      escapedNextCalls += 1;
      return;
    }

    const handler = handlers[cursor];
    cursor += 1;
    let nextPromise = null;

    const next = (error) => {
      if (error) return Promise.reject(error);
      nextPromise = dispatch();
      return nextPromise;
    };

    await handler(req, res, next);
    if (nextPromise) await nextPromise;
  }

  await dispatch();

  assert.equal(res.sent, true, 'target handler must send a response');
  return { escapedNextCalls };
}

async function invokeRoute(loaded, method, path, req) {
  const response = responseRecorder();
  const outcome = await invokeHandlers(
    loaded.routes.get(method + ' ' + path),
    req,
    response
  );

  return { response, outcome };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return body === undefined ? '' : JSON.stringify(body);
    }
  };
}

async function withSupabaseEnv(overrides, callback) {
  const previous = new Map();

  for (const key of ENV_KEYS) {
    previous.set(key, {
      present: Object.prototype.hasOwnProperty.call(process.env, key),
      value: process.env[key]
    });

    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      process.env[key] = String(overrides[key]);
    } else {
      delete process.env[key];
    }
  }

  try {
    return await callback();
  } finally {
    for (const [key, state] of previous) {
      if (state.present) process.env[key] = state.value;
      else delete process.env[key];
    }
  }
}

async function withLoadedRoute({ env = {}, fetchImpl }, callback) {
  return withSupabaseEnv(env, async () => {
    const fetchWasPresent = Object.prototype.hasOwnProperty.call(global, 'fetch');
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;
    const configHarness = createCentralConfigHarness();
    let loaded = null;

    global.fetch = fetchImpl;
    console.error = () => {};

    try {
      loaded = loadRoute(configHarness.exports);
      return await callback({
        ...loaded,
        configState: configHarness.state
      });
    } finally {
      if (loaded) loaded.restore();
      console.error = originalConsoleError;

      if (fetchWasPresent) global.fetch = originalFetch;
      else delete global.fetch;
    }
  });
}

test('router import is lazy and does not read admin config or call fetch', { concurrency: false }, async () => {
  let fetchCalls = 0;

  await withLoadedRoute({
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('fetch must not run during import');
    }
  }, async ({ configState, trace }) => {
    assert.equal(configState.calls, 0);
    assert.equal(fetchCalls, 0);
    assert.deepEqual(trace, []);
  });
});

test('missing canonical config returns central 503 for GET before fetch', { concurrency: false }, async () => {
  let fetchCalls = 0;

  await withLoadedRoute({
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('fetch must not run');
    }
  }, async (loaded) => {
    const { response, outcome } = await invokeRoute(
      loaded,
      'GET',
      '/',
      createRequest({ query: { contact: '55 (11) 99999-0000' } })
    );

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, ADMIN_UNAVAILABLE_BODY);
    assert.equal(loaded.configState.calls, 1);
    assert.equal(fetchCalls, 0);
    assert.equal(outcome.escapedNextCalls, 0);
    assert.deepEqual(loaded.trace, ['auth', 'role']);
    assert.deepEqual(loaded.getAllowedRoles(), ['company', 'admin', 'owner', 'manager', 'agent']);
  });
});

test('missing canonical config returns central 503 for PATCH without a write', { concurrency: false }, async () => {
  let fetchCalls = 0;

  await withLoadedRoute({
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('write must not run');
    }
  }, async (loaded) => {
    const { response, outcome } = await invokeRoute(
      loaded,
      'PATCH',
      '/',
      createRequest({
        body: {
          contact: '5511999990000',
          labels: ['Novo lead']
        }
      })
    );

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, ADMIN_UNAVAILABLE_BODY);
    assert.equal(loaded.configState.calls, 1);
    assert.equal(fetchCalls, 0);
    assert.equal(outcome.escapedNextCalls, 0);
  });
});

test('alias-only config is ignored for GET and PATCH with zero fetch', { concurrency: false }, async () => {
  let fetchCalls = 0;

  await withLoadedRoute({
    env: {
      SUPABASE_URL: 'https://tenant.supabase.test/',
      SUPABASE_SERVICE_KEY: 'legacy_service_key_for_unit_tests',
      SERVICE_ROLE_KEY: 'legacy_bare_service_role_key_for_unit_tests'
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('aliases must not authorize fetch');
    }
  }, async (loaded) => {
    const cases = [
      {
        method: 'GET',
        request: createRequest({ query: { contact: '5511999990000' } })
      },
      {
        method: 'PATCH',
        request: createRequest({
          body: {
            contact: '5511999990000',
            labels: ['Novo lead']
          }
        })
      }
    ];

    for (const item of cases) {
      const { response, outcome } = await invokeRoute(
        loaded,
        item.method,
        '/',
        item.request
      );

      assert.equal(response.statusCode, 503);
      assert.deepEqual(response.body, ADMIN_UNAVAILABLE_BODY);
      assert.equal(outcome.escapedNextCalls, 0);
    }

    assert.equal(loaded.configState.calls, 2);
    assert.equal(fetchCalls, 0);
  });
});

test('canonical GET preserves endpoint, headers, sanitization, and found true', { concurrency: false }, async () => {
  const calls = [];

  await withLoadedRoute({
    env: CANONICAL_ENV,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse(200, [{
        id: 'state-1',
        company_id: 'company-1',
        contact: '5511999990000',
        labels: ['Novo lead', '<VIP>', 'Novo lead', '', 'financeiro', 'extra1', 'extra2'],
        updated_at: '2026-07-17T10:00:00.000Z'
      }]);
    }
  }, async (loaded) => {
    const { response, outcome } = await invokeRoute(
      loaded,
      'GET',
      '/',
      createRequest({ query: { contact: '55 (11) 99999-0000' } })
    );

    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      'https://tenant.supabase.test/rest/v1/conversation_states?select=id,company_id,contact,labels,updated_at&company_id=eq.company-1&contact=eq.5511999990000&limit=1'
    );
    assert.equal(calls[0].options.method || 'GET', 'GET');
    assert.deepEqual(calls[0].options.headers, {
      apikey: CANONICAL_ENV.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + CANONICAL_ENV.SUPABASE_SERVICE_ROLE_KEY,
      Accept: 'application/json'
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      ok: true,
      marker: MARKER,
      contact: '5511999990000',
      labels: ['novo_lead', 'VIP', 'financeiro', 'extra1', 'extra2'],
      found: true,
      updated_at: '2026-07-17T10:00:00.000Z'
    });
    assert.equal(loaded.configState.calls, 1);
    assert.equal(outcome.escapedNextCalls, 0);
  });
});

test('canonical GET preserves empty rows as 200 found false', { concurrency: false }, async () => {
  await withLoadedRoute({
    env: CANONICAL_ENV,
    fetchImpl: async () => jsonResponse(200, [])
  }, async (loaded) => {
    const { response, outcome } = await invokeRoute(
      loaded,
      'GET',
      '/',
      createRequest({ query: { contact: '5511999990000' } })
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      ok: true,
      marker: MARKER,
      contact: '5511999990000',
      labels: [],
      found: false,
      updated_at: null
    });
    assert.equal(outcome.escapedNextCalls, 0);
  });
});

test('canonical PATCH preserves query, headers, body, label limit, and success', { concurrency: false }, async () => {
  const calls = [];

  await withLoadedRoute({
    env: CANONICAL_ENV,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse(200, [{
        id: 'state-1',
        company_id: 'company-1',
        contact: '5511999990000',
        labels: ['Novo lead', 'financeiro'],
        updated_at: '2026-07-17T11:00:00.000Z'
      }]);
    }
  }, async (loaded) => {
    const { response, outcome } = await invokeRoute(
      loaded,
      'PATCH',
      '/',
      createRequest({
        body: {
          contact: '55 (11) 99999-0000',
          labels: ['Novo lead', '<VIP>', 'Novo lead', 'financeiro', 'extra1', 'extra2', 'extra3']
        }
      })
    );

    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      'https://tenant.supabase.test/rest/v1/conversation_states?company_id=eq.company-1&contact=eq.5511999990000&select=id,company_id,contact,labels,updated_at'
    );
    assert.equal(calls[0].options.method, 'PATCH');
    assert.deepEqual(calls[0].options.headers, {
      apikey: CANONICAL_ENV.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + CANONICAL_ENV.SUPABASE_SERVICE_ROLE_KEY,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    });

    const payload = JSON.parse(calls[0].options.body);
    assert.deepEqual(payload.labels, ['novo_lead', 'VIP', 'financeiro', 'extra1', 'extra2']);
    assert.deepEqual(Object.keys(payload).sort(), ['labels', 'updated_at']);
    assert.match(payload.updated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      ok: true,
      marker: MARKER,
      contact: '5511999990000',
      labels: ['novo_lead', 'financeiro'],
      updated_at: '2026-07-17T11:00:00.000Z'
    });
    assert.equal(outcome.escapedNextCalls, 0);
  });
});

test('canonical PATCH preserves empty rows as 404', { concurrency: false }, async () => {
  await withLoadedRoute({
    env: CANONICAL_ENV,
    fetchImpl: async () => jsonResponse(200, [])
  }, async (loaded) => {
    const { response, outcome } = await invokeRoute(
      loaded,
      'PATCH',
      '/',
      createRequest({
        body: {
          contact: '5511999990000',
          labels: ['Novo lead']
        }
      })
    );

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, {
      error: 'Conversation state not found',
      contact: '5511999990000'
    });
    assert.equal(outcome.escapedNextCalls, 0);
  });
});

test('non-central HTTP failure preserves status and existing envelope', { concurrency: false }, async () => {
  await withLoadedRoute({
    env: CANONICAL_ENV,
    fetchImpl: async () => jsonResponse(429, { message: 'rate limited' })
  }, async (loaded) => {
    const { response, outcome } = await invokeRoute(
      loaded,
      'GET',
      '/',
      createRequest({ query: { contact: '5511999990000' } })
    );

    assert.equal(response.statusCode, 429);
    assert.deepEqual(response.body, {
      error: 'Failed to fetch conversation labels',
      details: { message: 'rate limited' }
    });
    assert.equal(outcome.escapedNextCalls, 0);
  });
});

test('non-central network failure preserves generic 500 contract', { concurrency: false }, async () => {
  await withLoadedRoute({
    env: CANONICAL_ENV,
    fetchImpl: async () => {
      throw new Error('unit network failure');
    }
  }, async (loaded) => {
    const { response, outcome } = await invokeRoute(
      loaded,
      'GET',
      '/',
      createRequest({ query: { contact: '5511999990000' } })
    );

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, {
      error: 'Failed to fetch conversation labels',
      details: 'unit network failure'
    });
    assert.equal(outcome.escapedNextCalls, 0);
  });
});

test('static catalog remains available without admin config or fetch', { concurrency: false }, async () => {
  let fetchCalls = 0;

  await withLoadedRoute({
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('catalog must not call fetch');
    }
  }, async (loaded) => {
    const { response, outcome } = await invokeRoute(
      loaded,
      'GET',
      '/catalog',
      createRequest()
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      ok: true,
      marker: MARKER,
      labels: EXPECTED_CATALOG
    });
    assert.equal(loaded.configState.calls, 0);
    assert.equal(fetchCalls, 0);
    assert.equal(outcome.escapedNextCalls, 0);
    assert.deepEqual(loaded.trace, ['auth', 'role']);
  });
});
