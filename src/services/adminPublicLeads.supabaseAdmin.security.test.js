'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const centralSupabase = require('../config/supabase');

const SERVICE_PATH = require.resolve('./adminPublicLeads.service');
const CANONICAL_URL = 'https://tenant.supabase.test/';
const CANONICAL_KEY = 'service_role_key_for_unit_tests_123';
const CANONICAL_ENV = {
  SUPABASE_URL: CANONICAL_URL,
  SUPABASE_SERVICE_ROLE_KEY: CANONICAL_KEY
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
const SELECT_COLUMNS =
  'id,created_at,updated_at,name,company_name,whatsapp,email,message,source,page_path,status,utm_source,utm_medium,utm_campaign,metadata';
const LEAD_ID_A = '11111111-1111-4111-8111-111111111111';
const LEAD_ID_B = '22222222-2222-4222-8222-222222222222';
const LEAD_ID_C = '33333333-3333-4333-8333-333333333333';
const RAW_SENSITIVE = [
  'raw-body-sentinel',
  CANONICAL_URL,
  CANONICAL_KEY,
  'Authorization',
  'apikey',
  'Sensitive Unit Name',
  '5511999990000',
  'sensitive@example.test',
  'Sensitive message',
  'metadata'
].join('|');
const SERVICE_ERROR_MESSAGES = Object.freeze({
  ADMIN_LEADS_UPSTREAM_FAILED: 'Serviço de leads temporariamente indisponível.',
  ADMIN_LEADS_RESPONSE_INVALID: 'Resposta inválida do serviço de leads.',
  ADMIN_LEAD_UPDATE_NOT_CONFIRMED: 'Atualização do lead não confirmada.'
});

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

function createCentralConfigHarness() {
  const state = { calls: 0 };

  return {
    state,
    exports: {
      getSupabaseAdminConfig() {
        state.calls += 1;
        return centralSupabase.getSupabaseAdminConfig();
      }
    }
  };
}

function loadService(configExports) {
  const previousCacheEntry = require.cache[SERVICE_PATH];
  const originalLoad = Module._load;
  let exported;

  delete require.cache[SERVICE_PATH];

  Module._load = function mockedLoad(request, parent, isMain) {
    if (
      request === '../config/supabase' &&
      parent?.filename === SERVICE_PATH
    ) {
      return configExports;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    exported = require(SERVICE_PATH);
  } finally {
    Module._load = originalLoad;
  }

  return {
    service: exported,
    restore() {
      delete require.cache[SERVICE_PATH];
      if (previousCacheEntry) require.cache[SERVICE_PATH] = previousCacheEntry;
    }
  };
}

async function withLoadedService({ env = {}, fetchImpl }, callback) {
  return withSupabaseEnv(env, async () => {
    const fetchWasPresent = Object.prototype.hasOwnProperty.call(global, 'fetch');
    const originalFetch = global.fetch;
    const configHarness = createCentralConfigHarness();
    let loaded = null;

    global.fetch = fetchImpl;

    try {
      loaded = loadService(configHarness.exports);
      return await callback({
        service: loaded.service,
        configState: configHarness.state
      });
    } finally {
      if (loaded) loaded.restore();

      if (fetchWasPresent) global.fetch = originalFetch;
      else delete global.fetch;
    }
  });
}

function rawResponse(status, bodyText) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return bodyText;
    }
  };
}

function jsonResponse(status, body) {
  return rawResponse(
    status,
    body === undefined ? '' : JSON.stringify(body)
  );
}

function lead(overrides = {}) {
  return {
    id: LEAD_ID_A,
    created_at: '2026-07-17T10:00:00.000Z',
    updated_at: '2026-07-17T10:00:00.000Z',
    name: 'Alpha',
    company_name: 'Unit Company',
    whatsapp: '5511000000000',
    email: 'unit@example.test',
    message: 'Unit message',
    source: 'unit_test',
    page_path: '/unit',
    status: 'new',
    utm_source: 'source',
    utm_medium: 'medium',
    utm_campaign: 'campaign',
    metadata: { safe: true },
    ...overrides
  };
}

function assertAdminUnavailable(error) {
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

function assertServiceError(error, code) {
  assert.equal(error.name, 'Error');
  assert.equal(error.code, code);
  assert.equal(error.statusCode, 502);
  assert.equal(error.message, SERVICE_ERROR_MESSAGES[code]);
  assert.equal(error.stack, undefined);
  assert.equal(error.details, undefined);
  assert.equal(error.internalPreview, undefined);
  assert.deepEqual(
    Object.getOwnPropertyNames(error).sort(),
    ['code', 'message', 'statusCode']
  );
  assert.deepEqual(Object.getOwnPropertySymbols(error), []);
  return true;
}

function assertSanitized(error) {
  const rendered = [
    error.name,
    error.message,
    error.code,
    error.statusCode,
    error.status,
    JSON.stringify(error.details),
    error.stack,
    String(error)
  ].join('|');
  const forbidden = [
    CANONICAL_URL,
    CANONICAL_KEY,
    'Authorization',
    'apikey',
    'raw-body-sentinel',
    'Sensitive Unit Name',
    '5511999990000',
    'sensitive@example.test',
    'Sensitive message',
    'metadata'
  ];

  for (const value of forbidden) {
    assert.equal(rendered.includes(value), false, `error exposed ${value}`);
  }
}

function assertListRequest(request) {
  const url = new URL(request.url);

  assert.equal(url.origin, new URL(CANONICAL_URL).origin);
  assert.equal(url.pathname, '/rest/v1/public_leads');
  assert.equal(url.searchParams.get('select'), SELECT_COLUMNS);
  assert.equal(url.searchParams.get('order'), 'created_at.desc');
  assert.equal(url.searchParams.get('limit'), '300');
  assert.equal(request.options.method || 'GET', 'GET');
  assert.deepEqual(request.options.headers, {
    apikey: CANONICAL_KEY,
    Authorization: `Bearer ${CANONICAL_KEY}`,
    Accept: 'application/json'
  });
}

function assertPatchRequest(request, expectedStatus) {
  const url = new URL(request.url);
  const body = JSON.parse(request.options.body);

  assert.equal(url.origin, new URL(CANONICAL_URL).origin);
  assert.equal(url.pathname, '/rest/v1/public_leads');
  assert.equal(url.searchParams.get('id'), `eq.${LEAD_ID_A}`);
  assert.equal(url.searchParams.get('select'), SELECT_COLUMNS);
  assert.equal(request.options.method, 'PATCH');
  assert.deepEqual(request.options.headers, {
    apikey: CANONICAL_KEY,
    Authorization: `Bearer ${CANONICAL_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  });
  assert.deepEqual(Object.keys(body).sort(), ['status', 'updated_at']);
  assert.equal(body.status, expectedStatus);
  assert.match(body.updated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
}

test('service import is lazy and does not resolve config or call fetch', { concurrency: false }, async () => {
  let fetchCalls = 0;

  await withLoadedService({
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('fetch must not run during import');
    }
  }, async ({ service, configState }) => {
    assert.equal(typeof service.listAdminPublicLeads, 'function');
    assert.equal(typeof service.updateAdminPublicLeadStatus, 'function');
    assert.equal(configState.calls, 0);
    assert.equal(fetchCalls, 0);
  });
});

test('missing canonical config rejects list with central identity before fetch', { concurrency: false }, async () => {
  let fetchCalls = 0;

  await withLoadedService({
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('fetch must not run');
    }
  }, async ({ service, configState }) => {
    await assert.rejects(
      service.listAdminPublicLeads(),
      assertAdminUnavailable
    );
    assert.equal(configState.calls, 1);
    assert.equal(fetchCalls, 0);
  });
});

test('missing canonical config rejects patch with zero fetch and zero write', { concurrency: false }, async () => {
  let fetchCalls = 0;

  await withLoadedService({
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('write must not run');
    }
  }, async ({ service, configState }) => {
    await assert.rejects(
      service.updateAdminPublicLeadStatus(LEAD_ID_A, 'qualified'),
      assertAdminUnavailable
    );
    assert.equal(configState.calls, 1);
    assert.equal(fetchCalls, 0);
  });
});

test('legacy alias-only config is rejected for list and patch before fetch', { concurrency: false }, async () => {
  let fetchCalls = 0;

  await withLoadedService({
    env: {
      SUPABASE_URL: CANONICAL_URL,
      SUPABASE_SERVICE_KEY: 'legacy_service_key_for_unit_tests',
      SUPABASE_SERVICE_ROLE: 'legacy_service_role_for_unit_tests'
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('aliases must not authorize fetch');
    }
  }, async ({ service, configState }) => {
    const operations = [
      () => service.listAdminPublicLeads(),
      () => service.updateAdminPublicLeadStatus(LEAD_ID_A, 'contacted')
    ];

    for (const operation of operations) {
      await assert.rejects(operation, assertAdminUnavailable);
    }

    assert.equal(configState.calls, 2);
    assert.equal(fetchCalls, 0);
  });
});

test('public URL-only config is rejected for list and patch before fetch', { concurrency: false }, async () => {
  let fetchCalls = 0;

  await withLoadedService({
    env: {
      VITE_SUPABASE_URL: 'https://vite.supabase.test',
      NEXT_PUBLIC_SUPABASE_URL: 'https://next.supabase.test',
      SUPABASE_SERVICE_ROLE_KEY: CANONICAL_KEY
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('public URLs must not authorize fetch');
    }
  }, async ({ service, configState }) => {
    const operations = [
      () => service.listAdminPublicLeads(),
      () => service.updateAdminPublicLeadStatus(LEAD_ID_A, 'contacted')
    ];

    for (const operation of operations) {
      await assert.rejects(operation, assertAdminUnavailable);
    }

    assert.equal(configState.calls, 2);
    assert.equal(fetchCalls, 0);
  });
});

test('canonical list preserves REST request filters pagination and summary', { concurrency: false }, async () => {
  const requests = [];
  const rows = [
    lead({ id: LEAD_ID_A, name: 'Alpha', status: 'new' }),
    lead({ id: LEAD_ID_B, name: 'Beta', status: 'contacted' }),
    lead({ id: LEAD_ID_C, name: 'Gamma', status: 'new' })
  ];

  await withLoadedService({
    env: CANONICAL_ENV,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse(200, rows);
    }
  }, async ({ service, configState }) => {
    const result = await service.listAdminPublicLeads({
      limit: 1,
      offset: 1,
      status: 'new',
      search: 'a'
    });

    assert.equal(requests.length, 1);
    assertListRequest(requests[0]);
    assert.equal(configState.calls, 1);
    assert.equal(result.ok, true);
    assert.deepEqual(result.leads.map((item) => item.id), [LEAD_ID_C]);
    assert.equal(result.total, 2);
    assert.equal(result.limit, 1);
    assert.equal(result.offset, 1);
    assert.deepEqual(result.summary, {
      total: 3,
      new: 2,
      contacted: 1,
      qualified: 0,
      discarded: 0
    });
    assert.deepEqual(result.filters, { status: 'new', search: 'a' });
  });
});

test('canonical empty list remains a legitimate success', { concurrency: false }, async () => {
  await withLoadedService({
    env: CANONICAL_ENV,
    fetchImpl: async () => jsonResponse(200, [])
  }, async ({ service, configState }) => {
    const result = await service.listAdminPublicLeads();

    assert.equal(configState.calls, 1);
    assert.equal(result.ok, true);
    assert.deepEqual(result.leads, []);
    assert.equal(result.total, 0);
    assert.equal(result.limit, 50);
    assert.equal(result.offset, 0);
    assert.deepEqual(result.summary, {
      total: 0,
      new: 0,
      contacted: 0,
      qualified: 0,
      discarded: 0
    });
  });
});

test('malformed list responses reject instead of becoming an empty list', { concurrency: false }, async () => {
  const cases = [
    ['missing body', () => rawResponse(200, '')],
    ['invalid JSON', () => rawResponse(200, 'not-json')],
    ['object', () => jsonResponse(200, { id: LEAD_ID_A })],
    ['null', () => jsonResponse(200, null)],
    ['row without id', () => jsonResponse(200, [lead({ id: null })])],
    ['row with invalid id', () => jsonResponse(200, [lead({ id: 'invalid-id' })])]
  ];

  for (const [name, makeResponse] of cases) {
    let fetchCalls = 0;

    await withLoadedService({
      env: CANONICAL_ENV,
      fetchImpl: async () => {
        fetchCalls += 1;
        return makeResponse();
      }
    }, async ({ service, configState }) => {
      await assert.rejects(
        service.listAdminPublicLeads(),
        (error) => assertServiceError(error, 'ADMIN_LEADS_RESPONSE_INVALID'),
        name
      );
      assert.equal(configState.calls, 1, name);
      assert.equal(fetchCalls, 1, name);
    });
  }
});

test('multiple valid list rows remain successful', { concurrency: false }, async () => {
  await withLoadedService({
    env: CANONICAL_ENV,
    fetchImpl: async () => jsonResponse(200, [
      lead({ id: LEAD_ID_A }),
      lead({ id: LEAD_ID_B, status: 'qualified' })
    ])
  }, async ({ service, configState }) => {
    const result = await service.listAdminPublicLeads();

    assert.equal(configState.calls, 1);
    assert.deepEqual(result.leads.map((item) => item.id), [LEAD_ID_A, LEAD_ID_B]);
    assert.equal(result.total, 2);
    assert.deepEqual(result.summary, {
      total: 2,
      new: 1,
      contacted: 0,
      qualified: 1,
      discarded: 0
    });
  });
});

test('empty patch representation preserves domain not found', { concurrency: false }, async () => {
  let fetchCalls = 0;

  await withLoadedService({
    env: CANONICAL_ENV,
    fetchImpl: async () => {
      fetchCalls += 1;
      return jsonResponse(200, []);
    }
  }, async ({ service, configState }) => {
    await assert.rejects(
      service.updateAdminPublicLeadStatus(LEAD_ID_A, 'contacted'),
      (error) => {
        assert.equal(error.message, 'ADMIN_PUBLIC_LEAD_NOT_FOUND');
        assert.equal(error.status, 404);
        return true;
      }
    );
    assert.equal(configState.calls, 1);
    assert.equal(fetchCalls, 1);
  });
});

test('canonical patch confirms identity status and summary with one config lookup', { concurrency: false }, async () => {
  const requests = [];
  const updated = lead({
    id: LEAD_ID_A,
    status: 'qualified',
    updated_at: '2026-07-17T12:00:00.000Z'
  });

  await withLoadedService({
    env: CANONICAL_ENV,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });

      if (requests.length === 1) {
        return jsonResponse(200, [updated]);
      }

      return jsonResponse(200, [
        updated,
        lead({ id: LEAD_ID_B, status: 'new' })
      ]);
    }
  }, async ({ service, configState }) => {
    const result = await service.updateAdminPublicLeadStatus(
      LEAD_ID_A,
      'qualified'
    );

    assert.equal(requests.length, 2);
    assertPatchRequest(requests[0], 'qualified');
    assertListRequest(requests[1]);
    assert.equal(configState.calls, 1);
    assert.equal(result.ok, true);
    assert.equal(result.lead.id, LEAD_ID_A);
    assert.equal(result.lead.status, 'qualified');
    assert.deepEqual(result.summary, {
      total: 2,
      new: 1,
      contacted: 0,
      qualified: 1,
      discarded: 0
    });
  });
});

test('malformed patch bodies reject as unconfirmed and skip summary', { concurrency: false }, async () => {
  const cases = [
    ['missing body', () => rawResponse(200, '')],
    ['invalid JSON', () => rawResponse(200, 'not-json')],
    ['object', () => jsonResponse(200, { id: LEAD_ID_A })],
    ['null', () => jsonResponse(200, null)]
  ];

  for (const [name, makeResponse] of cases) {
    let fetchCalls = 0;

    await withLoadedService({
      env: CANONICAL_ENV,
      fetchImpl: async () => {
        fetchCalls += 1;
        return makeResponse();
      }
    }, async ({ service, configState }) => {
      await assert.rejects(
        service.updateAdminPublicLeadStatus(LEAD_ID_A, 'contacted'),
        (error) => assertServiceError(error, 'ADMIN_LEAD_UPDATE_NOT_CONFIRMED'),
        name
      );
      assert.equal(configState.calls, 1, name);
      assert.equal(fetchCalls, 1, name);
    });
  }
});

test('patch requires one row with matching id and normalized status', { concurrency: false }, async () => {
  const cases = [
    [
      'missing id',
      [lead({ id: null, status: 'contacted' })]
    ],
    [
      'different id',
      [lead({ id: LEAD_ID_B, status: 'contacted' })]
    ],
    [
      'different status',
      [lead({ id: LEAD_ID_A, status: 'discarded' })]
    ],
    [
      'multiple rows',
      [
        lead({ id: LEAD_ID_A, status: 'contacted' }),
        lead({ id: LEAD_ID_B, status: 'contacted' })
      ]
    ]
  ];

  for (const [name, rows] of cases) {
    let fetchCalls = 0;

    await withLoadedService({
      env: CANONICAL_ENV,
      fetchImpl: async () => {
        fetchCalls += 1;
        return jsonResponse(200, rows);
      }
    }, async ({ service, configState }) => {
      await assert.rejects(
        service.updateAdminPublicLeadStatus(LEAD_ID_A, 'contacted'),
        (error) => assertServiceError(error, 'ADMIN_LEAD_UPDATE_NOT_CONFIRMED'),
        name
      );
      assert.equal(configState.calls, 1, name);
      assert.equal(fetchCalls, 1, name);
    });
  }
});

test('summary network and HTTP failures remain best effort after confirmed patch', { concurrency: false }, async () => {
  const cases = [
    [
      'network',
      async () => {
        throw new Error('summary network sentinel');
      }
    ],
    [
      'HTTP',
      async () => jsonResponse(503, { error: 'summary unavailable' })
    ]
  ];

  for (const [name, summaryResponse] of cases) {
    let fetchCalls = 0;
    const updated = lead({ id: LEAD_ID_A, status: 'qualified' });

    await withLoadedService({
      env: CANONICAL_ENV,
      fetchImpl: async () => {
        fetchCalls += 1;

        if (fetchCalls === 1) {
          return jsonResponse(200, [updated]);
        }

        return summaryResponse();
      }
    }, async ({ service, configState }) => {
      const result = await service.updateAdminPublicLeadStatus(
        LEAD_ID_A,
        'qualified'
      );

      assert.equal(result.ok, true, name);
      assert.equal(result.lead.id, LEAD_ID_A, name);
      assert.equal(result.lead.status, 'qualified', name);
      assert.equal(result.summary, null, name);
      assert.equal(configState.calls, 1, name);
      assert.equal(fetchCalls, 2, name);
    });
  }
});

test('list network and HTTP failures use one sanitized upstream contract', { concurrency: false }, async () => {
  const cases = [
    [
      'network',
      async () => {
        throw new Error('network dependency detail');
      }
    ],
    [
      'HTTP',
      async () => jsonResponse(503, { error: RAW_SENSITIVE })
    ]
  ];

  for (const [name, fetchFailure] of cases) {
    let fetchCalls = 0;

    await withLoadedService({
      env: CANONICAL_ENV,
      fetchImpl: async () => {
        fetchCalls += 1;
        return fetchFailure();
      }
    }, async ({ service, configState }) => {
      await assert.rejects(
        service.listAdminPublicLeads(),
        (error) => {
          assertServiceError(error, 'ADMIN_LEADS_UPSTREAM_FAILED');
          assertSanitized(error);
          return true;
        },
        name
      );
      assert.equal(configState.calls, 1, name);
      assert.equal(fetchCalls, 1, name);
    });
  }
});

test('list and patch errors never expose transport config raw body or PII', { concurrency: false }, async () => {
  const cases = [
    {
      name: 'list invalid response',
      code: 'ADMIN_LEADS_RESPONSE_INVALID',
      response: () => rawResponse(200, RAW_SENSITIVE),
      operation: (service) => service.listAdminPublicLeads()
    },
    {
      name: 'list HTTP failure',
      code: 'ADMIN_LEADS_UPSTREAM_FAILED',
      response: () => rawResponse(503, RAW_SENSITIVE),
      operation: (service) => service.listAdminPublicLeads()
    },
    {
      name: 'patch invalid response',
      code: 'ADMIN_LEAD_UPDATE_NOT_CONFIRMED',
      response: () => rawResponse(200, RAW_SENSITIVE),
      operation: (service) => service.updateAdminPublicLeadStatus(
        LEAD_ID_A,
        'contacted'
      )
    }
  ];

  for (const item of cases) {
    let fetchCalls = 0;

    await withLoadedService({
      env: CANONICAL_ENV,
      fetchImpl: async () => {
        fetchCalls += 1;
        return item.response();
      }
    }, async ({ service, configState }) => {
      await assert.rejects(
        item.operation(service),
        (error) => {
          assertServiceError(error, item.code);
          assertSanitized(error);
          return true;
        },
        item.name
      );
      assert.equal(configState.calls, 1, item.name);
      assert.equal(fetchCalls, 1, item.name);
    });
  }
});
