'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const CONFIG_PATH = require.resolve('./supabase');
const ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_SERVICE_ROLE',
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
];

async function withEnv(overrides, callback) {
  const previous = new Map();

  for (const key of ENV_KEYS) {
    previous.set(key, {
      present: Object.prototype.hasOwnProperty.call(process.env, key),
      value: process.env[key],
    });

    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
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

function loadConfig(createClient) {
  const previousCacheEntry = require.cache[CONFIG_PATH];
  const originalLoad = Module._load;

  delete require.cache[CONFIG_PATH];

  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === '@supabase/supabase-js') return { createClient };
    return originalLoad.call(this, request, parent, isMain);
  };

  let config;

  try {
    config = require(CONFIG_PATH);
  } finally {
    Module._load = originalLoad;
  }

  return {
    config,
    restore() {
      delete require.cache[CONFIG_PATH];
      if (previousCacheEntry) require.cache[CONFIG_PATH] = previousCacheEntry;
    },
  };
}

function captureError(callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }

  assert.fail('Expected callback to throw');
}

function assertAdminUnavailable(error) {
  assert.equal(error.name, 'SupabaseAdminUnavailableError');
  assert.equal(error.code, 'SUPABASE_ADMIN_UNAVAILABLE');
  assert.equal(error.statusCode, 503);
  assert.equal(error.message, 'Supabase admin indisponível.');
  assert.equal(error.stack, undefined);
  assert.deepEqual(
    Object.getOwnPropertyNames(error).sort(),
    ['code', 'message', 'name', 'statusCode']
  );
}

function validClient(calls) {
  return {
    from(table) {
      calls.push(['from', table]);
      return { table };
    },
    rpc(name, args) {
      calls.push(['rpc', name, args]);
      return { name, args };
    },
    auth: {
      getUser(token) {
        calls.push(['getUser', token]);
        return { token };
      },
      admin: {
        createUser(payload) {
          calls.push(['createUser', payload]);
          return { payload };
        },
        deleteUser(id) {
          calls.push(['deleteUser', id]);
          return { id };
        },
      },
    },
    storage: {
      from(bucket) {
        calls.push(['storageFrom', bucket]);
        return { bucket };
      },
    },
  };
}

test('module import is lazy when administrative configuration is absent', { concurrency: false }, async () => {
  await withEnv({}, async () => {
    let createCalls = 0;
    const loaded = loadConfig(() => {
      createCalls += 1;
      return validClient([]);
    });

    try {
      assert.equal(createCalls, 0);
      assert.equal(typeof loaded.config.from, 'function');
      assert.equal(typeof loaded.config.getSupabaseAdminClient, 'function');
      assert.equal(typeof loaded.config.getSupabaseAdminConfig, 'function');
    } finally {
      loaded.restore();
    }
  });
});

test('first use rejects missing, invalid, and alias-only configuration with one sanitized contract', { concurrency: false }, async () => {
  const cases = [
    {},
    {
      SUPABASE_URL: 'not-a-url',
      SUPABASE_SERVICE_ROLE_KEY: 'x'.repeat(32),
    },
    {
      SUPABASE_URL: 'https://tenant.supabase.test',
      SUPABASE_SERVICE_KEY: 'alias_key_that_must_not_be_accepted',
      SUPABASE_ANON_KEY: 'anon_key_that_must_not_be_accepted',
    },
  ];

  for (const env of cases) {
    await withEnv(env, async () => {
      let createCalls = 0;
      const loaded = loadConfig(() => {
        createCalls += 1;
        return validClient([]);
      });

      try {
        const error = captureError(() => loaded.config.from('clients'));
        assertAdminUnavailable(error);
        assert.equal(createCalls, 0);
      } finally {
        loaded.restore();
      }
    });
  }
});

test('client creation failures and unusable clients expose no dependency details', { concurrency: false }, async () => {
  const env = {
    SUPABASE_URL: 'https://tenant.supabase.test',
    SUPABASE_SERVICE_ROLE_KEY: 'service_role_key_for_unit_tests',
  };

  for (const createClient of [
    () => {
      throw new Error('dependency detail that must not escape');
    },
    () => ({ from() {} }),
  ]) {
    await withEnv(env, async () => {
      const loaded = loadConfig(createClient);

      try {
        const error = captureError(() => loaded.config.getSupabaseAdminClient());
        assertAdminUnavailable(error);
        assert.doesNotMatch(error.message, /dependency detail|service_role_key/i);
      } finally {
        loaded.restore();
      }
    });
  }
});

test('valid canonical configuration is cached and the facade preserves supported calls', { concurrency: false }, async () => {
  const env = {
    SUPABASE_URL: 'https://tenant.supabase.test/',
    SUPABASE_SERVICE_ROLE_KEY: 'service_role_key_for_unit_tests',
  };

  await withEnv(env, async () => {
    const calls = [];
    let createCalls = 0;
    const client = validClient(calls);
    const loaded = loadConfig((url, key, options) => {
      createCalls += 1;
      assert.equal(url, env.SUPABASE_URL);
      assert.equal(key, env.SUPABASE_SERVICE_ROLE_KEY);
      assert.deepEqual(options, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      return client;
    });

    try {
      assert.deepEqual(loaded.config.getSupabaseAdminConfig(), {
        url: env.SUPABASE_URL,
        key: env.SUPABASE_SERVICE_ROLE_KEY,
      });
      assert.equal(loaded.config.getSupabaseAdminClient(), client);
      assert.equal(loaded.config.getSupabaseAdminClient(), client);
      assert.equal(createCalls, 1);

      assert.deepEqual(loaded.config.from('clients'), { table: 'clients' });
      assert.deepEqual(loaded.config.rpc('fn', { value: 1 }), {
        name: 'fn',
        args: { value: 1 },
      });
      assert.deepEqual(loaded.config.auth.getUser('token'), { token: 'token' });
      assert.deepEqual(loaded.config.auth.admin.createUser({ email: 'a@b.test' }), {
        payload: { email: 'a@b.test' },
      });
      assert.deepEqual(loaded.config.auth.admin.deleteUser('user-1'), { id: 'user-1' });
      assert.deepEqual(loaded.config.storage.from('avatars'), { bucket: 'avatars' });
      assert.equal(createCalls, 1);
    } finally {
      loaded.restore();
    }
  });
});
