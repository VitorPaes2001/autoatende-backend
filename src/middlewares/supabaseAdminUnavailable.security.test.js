'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const CONFIG_PATH = require.resolve('../config/supabase');
const BASE_AGENT_PATH = require.resolve('./agentSeatLimit.middleware');

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

function unavailableConfig() {
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
  };
}

function cacheEntry(filename, exports) {
  return {
    id: filename,
    filename,
    loaded: true,
    exports,
    children: [],
    paths: [],
  };
}

function loadMiddleware(relativePath, { baseMock } = {}) {
  const targetPath = require.resolve(relativePath);
  const paths = [CONFIG_PATH, targetPath, BASE_AGENT_PATH];
  const previous = new Map(paths.map((path) => [path, require.cache[path]]));

  require.cache[CONFIG_PATH] = cacheEntry(CONFIG_PATH, unavailableConfig());
  delete require.cache[targetPath];

  if (baseMock) {
    require.cache[BASE_AGENT_PATH] = cacheEntry(BASE_AGENT_PATH, baseMock);
  } else if (targetPath !== BASE_AGENT_PATH) {
    delete require.cache[BASE_AGENT_PATH];
  }

  const exported = require(targetPath);

  return {
    exported,
    restore() {
      for (const [path, entry] of previous) {
        delete require.cache[path];
        if (entry) require.cache[path] = entry;
      }
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

async function withSeatEnv(callback) {
  const keys = ['AGENT_SEAT_ENFORCEMENT_MODE', 'AGENT_SEAT_UNRESOLVED_LIMIT_POLICY'];
  const previous = new Map(keys.map((key) => [
    key,
    {
      present: Object.prototype.hasOwnProperty.call(process.env, key),
      value: process.env[key],
    },
  ]));

  process.env.AGENT_SEAT_ENFORCEMENT_MODE = 'report';
  process.env.AGENT_SEAT_UNRESOLVED_LIMIT_POLICY = 'allow';

  try {
    return await callback();
  } finally {
    for (const [key, state] of previous) {
      if (state.present) process.env[key] = state.value;
      else delete process.env[key];
    }
  }
}

const scenarios = [
  {
    label: 'auth middleware',
    path: './auth.middleware',
    middleware(exported) {
      return exported;
    },
    request() {
      return {
        headers: { authorization: 'Bearer test-token' },
        query: {},
        body: {},
      };
    },
  },
  {
    label: 'effective billing tenant middleware',
    path: './effectiveBillingTenantForAgent.middleware',
    middleware(exported) {
      return exported;
    },
    request() {
      return {
        user: {
          id: 'agent-1',
          role: 'agent',
          company_id: 'company-1',
        },
      };
    },
  },
  {
    label: 'platform owner middleware',
    path: './platformOwnerOnly.middleware',
    middleware(exported) {
      return exported.platformOwnerOnly;
    },
    request() {
      return {
        headers: { authorization: 'Bearer test-token' },
      };
    },
  },
  {
    label: 'agent seat middleware',
    path: './agentSeatLimit.middleware',
    middleware(exported) {
      return exported({ mode: 'report' });
    },
    request() {
      return {
        companyId: 'company-1',
        company: {
          id: 'company-1',
          client_id: 'client-1',
        },
        user: {},
      };
    },
  },
  {
    label: 'agent seat fail-soft middleware',
    path: './agentSeatLimitFailSoft.middleware',
    middleware(exported) {
      return exported();
    },
    request() {
      return {
        companyId: 'company-1',
        company: {
          id: 'company-1',
          client_id: 'client-1',
        },
        user: {},
      };
    },
  },
];

for (const scenario of scenarios) {
  test(scenario.label + ' returns the central 503 contract without calling next', { concurrency: false }, async () => {
    await withSeatEnv(async () => {
      const loaded = loadMiddleware(scenario.path);

      try {
        const response = responseRecorder();
        let nextCalls = 0;

        await scenario.middleware(loaded.exported)(
          scenario.request(),
          response,
          () => {
            nextCalls += 1;
          }
        );

        assert.equal(response.statusCode, 503);
        assert.equal(response.body.code, 'SUPABASE_ADMIN_UNAVAILABLE');
        assert.equal(nextCalls, 0);
      } finally {
        loaded.restore();
      }
    });
  });
}

test('fail-soft middleware keeps allowing an unrelated resolution failure in report mode', { concurrency: false }, async () => {
  await withSeatEnv(async () => {
    function baseMock() {}
    baseMock.resolveAgentSeatStatus = async () => {
      throw new Error('ordinary resolution failure');
    };

    const loaded = loadMiddleware('./agentSeatLimitFailSoft.middleware', { baseMock });
    const originalConsoleError = console.error;

    try {
      console.error = () => {};
      const response = responseRecorder();
      let nextCalls = 0;

      await loaded.exported()(
        { company: {}, user: {} },
        response,
        () => {
          nextCalls += 1;
        }
      );

      assert.equal(response.statusCode, null);
      assert.equal(response.body, null);
      assert.equal(nextCalls, 1);
    } finally {
      console.error = originalConsoleError;
      loaded.restore();
    }
  });
});
