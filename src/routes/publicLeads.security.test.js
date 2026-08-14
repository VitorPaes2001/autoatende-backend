"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const centralSupabase = require("../config/supabase");
const realService = require("../services/publicLeads.service");

const ROUTE_PATH = require.resolve("./publicLeads.routes");
const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const CONTROL_URL = "https://tenant.supabase.test/";
const CONTROL_KEY = "service_role_key_for_route_tests_123";

function validBody() {
  return {
    name: "Route Unit Lead",
    whatsapp: "5511999990000",
    email: "route@example.test"
  };
}

function serviceRequestStub() {
  return {
    headers: {
      "x-forwarded-for": "192.0.2.50",
      "user-agent": "route-unit-agent"
    },
    ip: "192.0.2.50",
    socket: {}
  };
}

async function createRealUpstreamError() {
  const envKeys = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PUBLIC_LEADS_IP_HASH_SALT"
  ];
  const previousEnv = new Map();
  const fetchWasPresent = Object.prototype.hasOwnProperty.call(global, "fetch");
  const originalFetch = global.fetch;

  for (const key of envKeys) {
    previousEnv.set(key, {
      present: Object.prototype.hasOwnProperty.call(process.env, key),
      value: process.env[key]
    });
  }

  process.env.SUPABASE_URL = CONTROL_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = CONTROL_KEY;
  process.env.PUBLIC_LEADS_IP_HASH_SALT = "route-test-ip-salt";
  global.fetch = async () => ({
    ok: false,
    status: 503,
    async text() {
      throw new Error("non-2xx body must not be read");
    }
  });

  try {
    await realService.insertPublicLead(serviceRequestStub(), validBody());
  } catch (error) {
    assert.equal(realService.isPublicLeadServiceError(error), true);
    assert.equal(
      error.code,
      realService.PUBLIC_LEAD_ERROR_CODES.UPSTREAM_FAILED
    );
    return error;
  } finally {
    if (fetchWasPresent) global.fetch = originalFetch;
    else delete global.fetch;

    for (const [key, state] of previousEnv) {
      if (state.present) process.env[key] = state.value;
      else delete process.env[key];
    }
  }

  throw new Error("real upstream error was not produced");
}

function createExpressHarness() {
  const routes = [];

  return {
    routes,
    exports: {
      Router() {
        return {
          get(path, ...handlers) {
            routes.push({ method: "get", path, handlers });
          },
          post(path, ...handlers) {
            routes.push({ method: "post", path, handlers });
          }
        };
      }
    }
  };
}

async function withLoadedRoute({ insertImpl }, callback) {
  const previousCacheEntry = require.cache[ROUTE_PATH];
  const originalLoad = Module._load;
  const expressHarness = createExpressHarness();
  const serviceExports = {
    insertPublicLead: insertImpl,
    isValidPublicLeadUuid: realService.isValidPublicLeadUuid,
    createPublicLeadPersistenceUnconfirmedError:
      realService.createPublicLeadPersistenceUnconfirmedError,
    isPublicLeadServiceError: realService.isPublicLeadServiceError,
    PUBLIC_LEAD_ERROR_CODES: realService.PUBLIC_LEAD_ERROR_CODES
  };
  const centralExports = {
    isSupabaseAdminUnavailableError:
      centralSupabase.isSupabaseAdminUnavailableError
  };

  delete require.cache[ROUTE_PATH];

  Module._load = function controlledLoad(request, parent, isMain) {
    if (request === "express" && parent?.filename === ROUTE_PATH) {
      return expressHarness.exports;
    }

    if (
      request === "../services/publicLeads.service" &&
      parent?.filename === ROUTE_PATH
    ) {
      return serviceExports;
    }

    if (
      request === "../config/supabase" &&
      parent?.filename === ROUTE_PATH
    ) {
      return centralExports;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const router = require(ROUTE_PATH);
    return await callback({ router, routes: expressHarness.routes });
  } finally {
    Module._load = originalLoad;
    delete require.cache[ROUTE_PATH];
    if (previousCacheEntry) require.cache[ROUTE_PATH] = previousCacheEntry;
  }
}

function responseHarness() {
  const state = {
    statusCalls: 0,
    jsonCalls: 0,
    nextCalls: 0,
    statusCode: undefined,
    body: undefined,
    nextErrors: []
  };

  function assertResponseAllowed() {
    if (state.nextCalls > 0) {
      throw new Error("response attempted after next");
    }
  }

  return {
    state,
    response: {
      status(code) {
        assertResponseAllowed();
        state.statusCalls += 1;
        if (state.statusCalls > 1) {
          throw new Error("multiple status calls");
        }
        state.statusCode = code;
        return this;
      },
      json(body) {
        assertResponseAllowed();
        state.jsonCalls += 1;
        if (state.jsonCalls > 1) {
          throw new Error("multiple json calls");
        }
        state.body = body;
        return this;
      }
    },
    next(error) {
      if (state.statusCalls > 0 || state.jsonCalls > 0) {
        throw new Error("next attempted after response");
      }

      state.nextCalls += 1;
      if (state.nextCalls > 1) {
        throw new Error("multiple next calls");
      }
      state.nextErrors.push(error);
    }
  };
}

async function invokePost(options) {
  return withLoadedRoute(options, async ({ routes }) => {
    const route = routes.find(
      (entry) => entry.method === "post" && entry.path === "/"
    );

    assert.ok(route, "real post route must be registered");

    const handler = route.handlers[route.handlers.length - 1];
    const harness = responseHarness();
    const req = {
      body: options.body || {},
      headers: {},
      ip: "192.0.2.50",
      socket: {}
    };

    await handler(req, harness.response, harness.next);

    return harness.state;
  });
}

function assertSingleResponse(result, statusCode, body) {
  assert.equal(result.statusCalls, 1);
  assert.equal(result.jsonCalls, 1);
  assert.equal(result.nextCalls, 0);
  assert.equal(result.statusCode, statusCode);
  assert.deepEqual(result.body, body);
}

function assertNextOnly(result, error) {
  assert.equal(result.statusCalls, 0);
  assert.equal(result.jsonCalls, 0);
  assert.equal(result.nextCalls, 1);
  assert.equal(result.statusCode, undefined);
  assert.equal(result.body, undefined);
  assert.equal(result.nextErrors[0], error);
}

function assertHarnessRejectsMultipleFlows() {
  const repeatedStatus = responseHarness();
  repeatedStatus.response.status(400);
  assert.throws(
    () => repeatedStatus.response.status(400),
    /multiple status calls/
  );

  const repeatedJson = responseHarness();
  repeatedJson.response.json({ ok: false });
  assert.throws(
    () => repeatedJson.response.json({ ok: false }),
    /multiple json calls/
  );

  const responseAfterNext = responseHarness();
  responseAfterNext.next(new Error("next sentinel"));
  assert.throws(
    () => responseAfterNext.response.status(500),
    /response attempted after next/
  );

  const nextAfterResponse = responseHarness();
  nextAfterResponse.response.status(500);
  assert.throws(
    () => nextAfterResponse.next(new Error("late next sentinel")),
    /next attempted after response/
  );
}

test("invalid payload maps to exact sanitized 400 envelope", { concurrency: false }, async () => {
  const result = await invokePost({
    insertImpl: async () => ({
      ok: false,
      status: 400,
      publicCode: "invalid_lead_payload",
      errors: ["name_invalid", "whatsapp_invalid"]
    })
  });

  assertSingleResponse(result, 400, {
    ok: false,
    code: "invalid_lead_payload",
    errors: ["name_invalid", "whatsapp_invalid"]
  });
  assertHarnessRejectsMultipleFlows();
});

test("honeypot maps to exact 200 decoy without lead ID", { concurrency: false }, async () => {
  const result = await invokePost({
    insertImpl: async () => ({ honeypot: true })
  });

  assertSingleResponse(result, 200, { ok: true });
  assert.equal(Object.prototype.hasOwnProperty.call(result.body, "lead_id"), false);
});

test("central unavailable error maps to 503 without mutating identity", { concurrency: false }, async () => {
  const centralError = centralSupabase.createSupabaseAdminUnavailableError();
  const before = Object.getOwnPropertyDescriptors(centralError);
  const result = await invokePost({
    insertImpl: async () => {
      throw centralError;
    }
  });

  assertSingleResponse(result, 503, {
    ok: false,
    code: "lead_capture_unavailable"
  });
  assert.deepEqual(Object.getOwnPropertyDescriptors(centralError), before);
});

test("upstream failure maps to exact sanitized 502 envelope", { concurrency: false }, async () => {
  const upstreamError = await createRealUpstreamError();
  const result = await invokePost({
    insertImpl: async () => {
      throw upstreamError;
    }
  });

  assertSingleResponse(result, 502, {
    ok: false,
    code: "lead_capture_failed"
  });
});

test("unconfirmed persistence maps to exact sanitized 502 envelope", { concurrency: false }, async () => {
  const unconfirmedError =
    realService.createPublicLeadPersistenceUnconfirmedError();
  const result = await invokePost({
    insertImpl: async () => {
      throw unconfirmedError;
    }
  });

  assertSingleResponse(result, 502, {
    ok: false,
    code: "lead_capture_unconfirmed"
  });
});

test("unexpected error is passed to next with no mutation", { concurrency: false }, async () => {
  const unexpected = new Error("unexpected sentinel");
  const before = Object.getOwnPropertyDescriptors(unexpected);
  const result = await invokePost({
    insertImpl: async () => {
      throw unexpected;
    }
  });

  assertNextOnly(result, unexpected);
  assert.deepEqual(Object.getOwnPropertyDescriptors(unexpected), before);
});

test("null service result never produces 201", { concurrency: false }, async () => {
  const result = await invokePost({
    insertImpl: async () => null
  });

  assertSingleResponse(result, 502, {
    ok: false,
    code: "lead_capture_unconfirmed"
  });
});

test("ok true without leadId never produces 201", { concurrency: false }, async () => {
  const result = await invokePost({
    insertImpl: async () => ({ ok: true })
  });

  assertSingleResponse(result, 502, {
    ok: false,
    code: "lead_capture_unconfirmed"
  });
});

test("invalid UUID never produces 201", { concurrency: false }, async () => {
  const result = await invokePost({
    insertImpl: async () => ({
      ok: true,
      leadId: "invalid-id"
    })
  });

  assertSingleResponse(result, 502, {
    ok: false,
    code: "lead_capture_unconfirmed"
  });
});

test("confirmed service result maps to exact 201 envelope", { concurrency: false }, async () => {
  const result = await invokePost({
    insertImpl: async () => ({
      ok: true,
      leadId: `  ${LEAD_ID}  `
    })
  });

  assertSingleResponse(result, 201, {
    ok: true,
    lead_id: LEAD_ID
  });
});

test("table of malformed internal results never produces 201", { concurrency: false }, async () => {
  const malformed = [
    undefined,
    [],
    "success",
    { ok: false },
    { ok: true, leadId: null },
    { ok: true, leadId: "" },
    { ok: true, leadId: "00000000-0000-0000-0000-000000000000" },
    { ok: true, leadId: "11111111-1111-0111-8111-111111111111" },
    { ok: true, leadId: [LEAD_ID] }
  ];

  for (const value of malformed) {
    const result = await invokePost({
      insertImpl: async () => value
    });

    assertSingleResponse(result, 502, {
      ok: false,
      code: "lead_capture_unconfirmed"
    });
  }
});

test("all public envelopes remain free of PII and internal fields", { concurrency: false }, async () => {
  const upstreamError = await createRealUpstreamError();
  const scenarios = [
    {
      expectedStatus: 400,
      insertImpl: async () => ({
        ok: false,
        status: 400,
        publicCode: "invalid_lead_payload",
        errors: ["email_invalid", "Sensitive Unit Name"]
      })
    },
    {
      expectedStatus: 502,
      insertImpl: async () => {
        throw upstreamError;
      }
    },
    {
      expectedStatus: 502,
      insertImpl: async () => {
        throw realService.createPublicLeadPersistenceUnconfirmedError();
      }
    },
    {
      expectedStatus: 201,
      insertImpl: async () => ({
        ok: true,
        leadId: LEAD_ID,
        name: "Sensitive Unit Name",
        whatsapp: "5511999990000",
        email: "sensitive-email-sentinel",
        message: "Sensitive message",
        internalPreview: "raw-body-sentinel",
        key: "service-role-sentinel"
      })
    }
  ];
  const forbiddenValues = [
    "Sensitive Unit Name",
    "5511999990000",
    "sensitive-email-sentinel",
    "Sensitive message",
    "raw-body-sentinel",
    "service-role-sentinel"
  ];

  for (const scenario of scenarios) {
    const result = await invokePost(scenario);
    const rendered = JSON.stringify(result.body);

    assert.equal(result.statusCalls, 1);
    assert.equal(result.jsonCalls, 1);
    assert.equal(result.nextCalls, 0);
    assert.equal(result.statusCode, scenario.expectedStatus);

    for (const value of forbiddenValues) {
      assert.equal(rendered.includes(value), false);
    }
  }
});
