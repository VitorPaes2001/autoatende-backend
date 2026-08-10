'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const centralSupabase = require('../config/supabase');

const SERVICE_PATH = require.resolve('./publicLeads.service');
const CANONICAL_URL = 'https://tenant.supabase.test/';
const CANONICAL_KEY = 'service_role_key_for_public_lead_tests_123';
const LEAD_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_LEAD_ID = '22222222-2222-4222-8222-222222222222';
const ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_SERVICE_ROLE',
  'SUPABASE_SECRET_KEY',
  'SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'PUBLIC_LEADS_IP_HASH_SALT',
  'JWT_SECRET',
  'SESSION_SECRET',
  'SUPABASE_JWT_SECRET'
];

function validBody(overrides = {}) {
  return {
    name: 'Unit Lead',
    company_name: 'Unit Company',
    whatsapp: '5511999990000',
    email: 'unit@example.test',
    message: 'Unit message',
    source: 'unit_test',
    page_path: '/unit',
    ...overrides
  };
}

function requestStub() {
  return {
    headers: {
      'x-forwarded-for': '192.0.2.10',
      'user-agent': 'unit-agent'
    },
    ip: '192.0.2.10',
    socket: {}
  };
}

function rawResponse(status, bodyText, onText) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      if (onText) onText();
      return bodyText;
    }
  };
}

function jsonResponse(status, body, onText) {
  return rawResponse(status, JSON.stringify(body), onText);
}

async function withEnv(overrides, callback) {
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

function createCentralConfigHarness(configExports = null) {
  const state = { calls: 0 };

  return {
    state,
    exports: configExports || {
      getSupabaseAdminConfig() {
        state.calls += 1;
        return centralSupabase.getSupabaseAdminConfig();
      }
    }
  };
}

async function withLoadedService(
  { configExports, failServiceImport = false, failCentralImport = false },
  callback
) {
  const previousCacheEntry = require.cache[SERVICE_PATH];
  const originalLoad = Module._load;
  const moduleState = { loads: 0 };

  delete require.cache[SERVICE_PATH];

  Module._load = function controlledLoad(request, parent, isMain) {
    if (
      failServiceImport &&
      request === 'crypto' &&
      parent?.filename === SERVICE_PATH
    ) {
      throw new Error('service import failure sentinel');
    }

    if (
      request === '../config/supabase' &&
      parent?.filename === SERVICE_PATH
    ) {
      moduleState.loads += 1;

      if (failCentralImport) {
        throw new Error('central import failure sentinel');
      }

      return configExports;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const service = require(SERVICE_PATH);
    return await callback({ service, moduleState });
  } finally {
    Module._load = originalLoad;
    delete require.cache[SERVICE_PATH];
    if (previousCacheEntry) require.cache[SERVICE_PATH] = previousCacheEntry;
  }
}

async function withService({ env = {}, fetchImpl, configExports }, callback) {
  return withEnv(env, async () => {
    const fetchWasPresent = Object.prototype.hasOwnProperty.call(global, 'fetch');
    const originalFetch = global.fetch;
    const harness = createCentralConfigHarness(configExports);

    global.fetch = fetchImpl || (async () => {
      throw new Error('unexpected fetch');
    });

    try {
      return await withLoadedService(
        { configExports: harness.exports },
        async ({ service, moduleState }) => callback({
          service,
          configState: harness.state,
          moduleState
        })
      );
    } finally {
      if (fetchWasPresent) global.fetch = originalFetch;
      else delete global.fetch;
    }
  });
}

async function assertHarnessRestoresImportFailures() {
  const originalLoad = Module._load;
  const originalCacheEntry = require.cache[SERVICE_PATH];
  const sentinelCacheEntry = {
    id: SERVICE_PATH,
    filename: SERVICE_PATH,
    loaded: true,
    exports: { sentinel: true },
    children: [],
    paths: []
  };

  require.cache[SERVICE_PATH] = sentinelCacheEntry;

  try {
    await assert.rejects(
      withLoadedService(
        { configExports: {}, failServiceImport: true },
        async () => undefined
      ),
      /service import failure sentinel/
    );
    assert.equal(Module._load, originalLoad);
    assert.equal(require.cache[SERVICE_PATH], sentinelCacheEntry);

    await assert.rejects(
      withLoadedService(
        { configExports: {}, failCentralImport: true },
        async ({ service }) => service.insertPublicLead(requestStub(), validBody())
      ),
      /central import failure sentinel/
    );
    assert.equal(Module._load, originalLoad);
    assert.equal(require.cache[SERVICE_PATH], sentinelCacheEntry);
  } finally {
    delete require.cache[SERVICE_PATH];
    if (originalCacheEntry) require.cache[SERVICE_PATH] = originalCacheEntry;
    Module._load = originalLoad;
  }
}

function canonicalEnv(overrides = {}) {
  return {
    SUPABASE_URL: CANONICAL_URL,
    SUPABASE_SERVICE_ROLE_KEY: CANONICAL_KEY,
    PUBLIC_LEADS_IP_HASH_SALT: 'unit-public-leads-salt',
    ...overrides
  };
}

function assertCentralError(error) {
  assert.equal(error.name, 'SupabaseAdminUnavailableError');
  assert.equal(error.message, 'Supabase admin indisponível.');
  assert.equal(error.code, 'SUPABASE_ADMIN_UNAVAILABLE');
  assert.equal(error.statusCode, 503);
  assert.equal(error.stack, undefined);
  assert.deepEqual(
    Object.getOwnPropertyNames(error).sort(),
    ['code', 'message', 'name', 'statusCode']
  );
  return true;
}

function assertLocalError(error, code, message) {
  assert.equal(error.name, 'Error');
  assert.equal(error.code, code);
  assert.equal(error.message, message);
  assert.equal(error.statusCode, 502);
  assert.equal(error.stack, undefined);
  assert.equal(error.cause, undefined);
  assert.equal(error.details, undefined);
  assert.deepEqual(
    Object.getOwnPropertyNames(error).sort(),
    ['code', 'message', 'statusCode']
  );
  return true;
}

function assertUnconfirmed(error) {
  return assertLocalError(
    error,
    'PUBLIC_LEAD_PERSISTENCE_UNCONFIRMED',
    'Persistência do lead não confirmada.'
  );
}

function assertUpstreamFailed(error) {
  return assertLocalError(
    error,
    'PUBLIC_LEAD_UPSTREAM_FAILED',
    'Serviço de captação de leads temporariamente indisponível.'
  );
}

test('service import is lazy with zero config lookup and zero fetch', { concurrency: false }, async () => {
  let fetchCalls = 0;

  await withService({
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('fetch must not run');
    }
  }, async ({ service, configState, moduleState }) => {
    assert.equal(typeof service.insertPublicLead, 'function');
    assert.equal(moduleState.loads, 0);
    assert.equal(configState.calls, 0);
    assert.equal(fetchCalls, 0);
  });

  await assertHarnessRestoresImportFailures();
});

test('fully missing canonical config preserves central error and performs zero fetch', { concurrency: false }, async () => {
  let fetchCalls = 0;

  await withService({
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('fetch must not run');
    }
  }, async ({ service, configState }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertCentralError
    );
    assert.equal(configState.calls, 1);
    assert.equal(fetchCalls, 0);
  });
});

test('missing canonical URL preserves central error', { concurrency: false }, async () => {
  await withService({
    env: { SUPABASE_SERVICE_ROLE_KEY: CANONICAL_KEY }
  }, async ({ service, configState }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertCentralError
    );
    assert.equal(configState.calls, 1);
  });
});

test('missing canonical service role key preserves central error', { concurrency: false }, async () => {
  await withService({
    env: { SUPABASE_URL: CANONICAL_URL }
  }, async ({ service, configState }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertCentralError
    );
    assert.equal(configState.calls, 1);
  });
});

test('legacy URL and service key aliases are ignored', { concurrency: false }, async () => {
  await withService({
    env: {
      VITE_SUPABASE_URL: CANONICAL_URL,
      SUPABASE_SERVICE_KEY: CANONICAL_KEY
    }
  }, async ({ service }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertCentralError
    );
  });
});

test('public URL alias is ignored even with canonical service role key', { concurrency: false }, async () => {
  await withService({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: CANONICAL_URL,
      SUPABASE_SERVICE_ROLE_KEY: CANONICAL_KEY
    }
  }, async ({ service }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertCentralError
    );
  });
});

test('legacy service role alias is ignored with canonical URL', { concurrency: false }, async () => {
  await withService({
    env: {
      SUPABASE_URL: CANONICAL_URL,
      SUPABASE_SERVICE_ROLE: CANONICAL_KEY
    }
  }, async ({ service }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertCentralError
    );
  });
});

test('anon key fallback is ignored with canonical URL', { concurrency: false }, async () => {
  await withService({
    env: {
      SUPABASE_URL: CANONICAL_URL,
      SUPABASE_ANON_KEY: CANONICAL_KEY
    }
  }, async ({ service }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertCentralError
    );
  });
});

test('invalid payload returns before config with zero fetch and zero write', { concurrency: false }, async () => {
  let fetchCalls = 0;

  await withService({
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('fetch must not run');
    }
  }, async ({ service, configState, moduleState }) => {
    const result = await service.insertPublicLead(requestStub(), {
      name: 'x',
      whatsapp: '1'
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(result.publicCode, 'invalid_lead_payload');
    assert.deepEqual(result.errors, ['name_invalid', 'whatsapp_invalid']);
    assert.equal(moduleState.loads, 0);
    assert.equal(configState.calls, 0);
    assert.equal(fetchCalls, 0);
  });
});

test('honeypot returns exact decoy result before config with zero fetch and zero write', { concurrency: false }, async () => {
  let fetchCalls = 0;

  await withService({
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('fetch must not run');
    }
  }, async ({ service, configState, moduleState }) => {
    const result = await service.insertPublicLead(
      requestStub(),
      validBody({ website: 'filled.example' })
    );

    assert.deepEqual(result, { honeypot: true });
    assert.equal(moduleState.loads, 0);
    assert.equal(configState.calls, 0);
    assert.equal(fetchCalls, 0);
  });
});

test('eligible request uses exact select=id URL headers body and one POST', { concurrency: false }, async () => {
  const requests = [];

  await withService({
    env: canonicalEnv(),
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse(201, [{ id: LEAD_ID }]);
    }
  }, async ({ service, configState, moduleState }) => {
    await service.insertPublicLead(requestStub(), validBody());

    assert.equal(moduleState.loads, 1);
    assert.equal(configState.calls, 1);
    assert.equal(requests.length, 1);

    const request = requests[0];
    const url = new URL(request.url);
    const body = JSON.parse(request.options.body);

    assert.equal(url.origin, new URL(CANONICAL_URL).origin);
    assert.equal(url.pathname, '/rest/v1/public_leads');
    assert.equal(url.searchParams.get('select'), 'id');
    assert.equal(request.options.method, 'POST');
    assert.deepEqual(request.options.headers, {
      apikey: CANONICAL_KEY,
      Authorization: `Bearer ${CANONICAL_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation'
    });
    assert.equal(body.name, 'Unit Lead');
    assert.equal(body.whatsapp, '5511999990000');
    assert.equal(body.status, 'new');
  });
});

test('one valid returned row yields only ok and leadId', { concurrency: false }, async () => {
  await withService({
    env: canonicalEnv(),
    fetchImpl: async () => jsonResponse(201, [{ id: `  ${LEAD_ID.toUpperCase()}  ` }])
  }, async ({ service }) => {
    const result = await service.insertPublicLead(requestStub(), validBody());

    assert.deepEqual(result, {
      ok: true,
      leadId: LEAD_ID.toUpperCase()
    });
    assert.deepEqual(Object.keys(result).sort(), ['leadId', 'ok']);
  });
});

test('empty upstream body is persistence unconfirmed', { concurrency: false }, async () => {
  await withService({
    env: canonicalEnv(),
    fetchImpl: async () => rawResponse(201, '')
  }, async ({ service }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertUnconfirmed
    );
  });
});

test('invalid upstream JSON is persistence unconfirmed', { concurrency: false }, async () => {
  await withService({
    env: canonicalEnv(),
    fetchImpl: async () => rawResponse(201, '{invalid')
  }, async ({ service }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertUnconfirmed
    );
  });
});

test('null upstream JSON is persistence unconfirmed', { concurrency: false }, async () => {
  await withService({
    env: canonicalEnv(),
    fetchImpl: async () => jsonResponse(201, null)
  }, async ({ service }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertUnconfirmed
    );
  });
});

test('object upstream JSON is persistence unconfirmed', { concurrency: false }, async () => {
  await withService({
    env: canonicalEnv(),
    fetchImpl: async () => jsonResponse(201, { id: LEAD_ID })
  }, async ({ service }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertUnconfirmed
    );
  });
});

test('empty upstream array is persistence unconfirmed', { concurrency: false }, async () => {
  await withService({
    env: canonicalEnv(),
    fetchImpl: async () => jsonResponse(201, [])
  }, async ({ service }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertUnconfirmed
    );
  });
});

test('returned row without ID is persistence unconfirmed', { concurrency: false }, async () => {
  await withService({
    env: canonicalEnv(),
    fetchImpl: async () => jsonResponse(201, [{}])
  }, async ({ service }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertUnconfirmed
    );
  });
});

test('returned row with null ID is persistence unconfirmed', { concurrency: false }, async () => {
  await withService({
    env: canonicalEnv(),
    fetchImpl: async () => jsonResponse(201, [{ id: null }])
  }, async ({ service }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertUnconfirmed
    );
  });
});

test('returned row with invalid UUID is persistence unconfirmed', { concurrency: false }, async () => {
  await withService({
    env: canonicalEnv(),
    fetchImpl: async () => jsonResponse(201, [{ id: 'not-a-uuid' }])
  }, async ({ service }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertUnconfirmed
    );
  });
});

test('multiple returned rows are persistence unconfirmed without choosing first', { concurrency: false }, async () => {
  await withService({
    env: canonicalEnv(),
    fetchImpl: async () => jsonResponse(201, [
      { id: LEAD_ID },
      { id: SECOND_LEAD_ID }
    ])
  }, async ({ service }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertUnconfirmed
    );
  });
});

test('network rejection is sanitized persistence unconfirmed with one fetch', { concurrency: false }, async () => {
  let fetchCalls = 0;

  await withService({
    env: canonicalEnv(),
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('network raw sentinel');
    }
  }, async ({ service }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertUnconfirmed
    );
    assert.equal(fetchCalls, 1);
  });
});

test('body read rejection is sanitized persistence unconfirmed with no second fetch', { concurrency: false }, async () => {
  let fetchCalls = 0;
  let bodyReads = 0;

  await withService({
    env: canonicalEnv(),
    fetchImpl: async () => {
      fetchCalls += 1;
      return {
        ok: true,
        status: 201,
        async text() {
          bodyReads += 1;
          throw new Error('raw body read sentinel');
        }
      };
    }
  }, async ({ service }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertUnconfirmed
    );
    assert.equal(fetchCalls, 1);
    assert.equal(bodyReads, 1);
  });
});

test('non-2xx is upstream failed and never reads response body', { concurrency: false }, async () => {
  let fetchCalls = 0;
  let bodyReads = 0;

  await withService({
    env: canonicalEnv(),
    fetchImpl: async () => {
      fetchCalls += 1;
      return rawResponse(500, 'raw upstream sentinel', () => {
        bodyReads += 1;
      });
    }
  }, async ({ service }) => {
    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      assertUpstreamFailed
    );
    assert.equal(fetchCalls, 1);
    assert.equal(bodyReads, 0);
  });
});

test('all local errors expose only sanitized contract without PII', { concurrency: false }, async () => {
  const sensitiveValues = [
    CANONICAL_URL,
    CANONICAL_KEY,
    'Authorization',
    'apikey',
    'Unit Lead',
    '5511999990000',
    'unit@example.test',
    'Unit message',
    'metadata',
    'raw upstream sentinel'
  ];

  await withService({
    env: canonicalEnv(),
    fetchImpl: async () => rawResponse(503, 'raw upstream sentinel')
  }, async ({ service }) => {
    const unconfirmed = service.createPublicLeadPersistenceUnconfirmedError();
    assertUnconfirmed(unconfirmed);

    for (const value of sensitiveValues) {
      assert.equal(JSON.stringify(unconfirmed).includes(value), false);
    }

    await assert.rejects(
      service.insertPublicLead(requestStub(), validBody()),
      (error) => {
        assertUpstreamFailed(error);
        const rendered = [
          error.message,
          error.code,
          error.statusCode,
          error.stack,
          error.cause,
          error.details,
          JSON.stringify(error)
        ].join('|');

        for (const value of sensitiveValues) {
          assert.equal(rendered.includes(value), false);
        }

        return true;
      }
    );
  });
});

test('central unavailable error identity is propagated without mutation', { concurrency: false }, async () => {
  const centralError = centralSupabase.createSupabaseAdminUnavailableError();
  const beforeNames = Object.getOwnPropertyNames(centralError).sort();
  let configCalls = 0;
  let fetchCalls = 0;

  await withService({
    configExports: {
      getSupabaseAdminConfig() {
        configCalls += 1;
        throw centralError;
      }
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('fetch must not run');
    }
  }, async ({ service }) => {
    let received;

    try {
      await service.insertPublicLead(requestStub(), validBody());
    } catch (error) {
      received = error;
    }

    assert.equal(received, centralError);
    assert.deepEqual(Object.getOwnPropertyNames(received).sort(), beforeNames);
    assertCentralError(received);
    assert.equal(configCalls, 1);
    assert.equal(fetchCalls, 0);
  });
});
