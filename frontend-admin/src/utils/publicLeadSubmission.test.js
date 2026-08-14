import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PUBLIC_LEAD_OUTCOMES,
  classifyPublicLeadResponse,
  getPublicLeadUiPolicy,
  isValidPublicLeadUuid,
  submitPublicLead,
} from "./publicLeadSubmission.js";

const LEAD_ID = "11111111-1111-4111-8111-111111111111";

function rawResponse(status, bodyText, onText) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      onText?.();
      return bodyText;
    },
  };
}

function jsonResponse(status, body, onText) {
  return rawResponse(status, JSON.stringify(body), onText);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("publicLeadSubmission behavioral contract", () => {
  it("accepts and normalizes valid RFC variant version 1-5 UUIDs", () => {
    expect(isValidPublicLeadUuid(`  ${LEAD_ID.toUpperCase()}  `)).toBe(true);
    expect(isValidPublicLeadUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });

  it("rejects invalid, partial, nil, version-zero and non-string UUIDs", () => {
    const invalid = [
      "00000000-0000-0000-0000-000000000000",
      "11111111-1111-0111-8111-111111111111",
      "11111111-1111-4111-7111-111111111111",
      "11111111-1111-4111-8111",
      "not-a-uuid",
      "",
      null,
      [],
    ];

    for (const value of invalid) {
      expect(isValidPublicLeadUuid(value)).toBe(false);
    }
  });

  it("confirms success only for exact HTTP 201 valid JSON and UUID", () => {
    expect(
      classifyPublicLeadResponse({
        status: 201,
        jsonValid: true,
        body: { ok: true, lead_id: ` ${LEAD_ID} ` },
      })
    ).toEqual({
      classification: PUBLIC_LEAD_OUTCOMES.SUCCESS,
      leadId: LEAD_ID,
    });
  });

  it("classifies HTTP 201 without exact ok true as ambiguous", () => {
    const outcome = classifyPublicLeadResponse({
      status: 201,
      jsonValid: true,
      body: { lead_id: LEAD_ID },
    });

    expect(outcome).toEqual({
      classification: PUBLIC_LEAD_OUTCOMES.AMBIGUOUS,
      leadId: null,
    });
  });

  it("classifies HTTP 201 with an invalid lead UUID as ambiguous", () => {
    const outcome = classifyPublicLeadResponse({
      status: 201,
      jsonValid: true,
      body: { ok: true, lead_id: "invalid" },
    });

    expect(outcome.classification).toBe(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
    expect(outcome.leadId).toBeNull();
  });

  it("classifies invalid JSON as ambiguous with one fetch and one body read", async () => {
    const onText = vi.fn();
    const fetchImpl = vi.fn(async () => rawResponse(201, "{invalid", onText));

    const outcome = await submitPublicLead({ name: "Unit" }, { fetchImpl });

    expect(outcome).toEqual({
      classification: PUBLIC_LEAD_OUTCOMES.AMBIGUOUS,
      leadId: null,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalledTimes(1);
  });

  it("keeps the HTTP 200 honeypot decoy out of confirmed success", () => {
    const outcome = classifyPublicLeadResponse({
      status: 200,
      jsonValid: true,
      body: { ok: true },
    });

    expect(outcome.classification).toBe(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
    expect(outcome.leadId).toBeNull();
  });

  it("does not confirm other successful-looking HTTP 2xx statuses", () => {
    for (const status of [202, 204, 206]) {
      const outcome = classifyPublicLeadResponse({
        status,
        jsonValid: true,
        body: { ok: true, lead_id: LEAD_ID },
      });
      expect(outcome.classification).toBe(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
    }
  });

  it("classifies HTTP 400 as a validation error", () => {
    const outcome = classifyPublicLeadResponse({
      status: 400,
      jsonValid: true,
      body: { ok: false, code: "invalid_lead_payload" },
    });

    expect(outcome.classification).toBe(PUBLIC_LEAD_OUTCOMES.VALIDATION_ERROR);
  });

  it("classifies HTTP 429 as rate limited", () => {
    const outcome = classifyPublicLeadResponse({
      status: 429,
      jsonValid: true,
      body: { ok: false, code: "rate_limited" },
    });

    expect(outcome.classification).toBe(PUBLIC_LEAD_OUTCOMES.RATE_LIMITED);
  });

  it("classifies HTTP 500 as ambiguous", () => {
    const outcome = classifyPublicLeadResponse({
      status: 500,
      jsonValid: true,
      body: { ok: false },
    });

    expect(outcome.classification).toBe(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
  });

  it("classifies HTTP 502 lead_capture_failed as unavailable", () => {
    const outcome = classifyPublicLeadResponse({
      status: 502,
      jsonValid: true,
      body: { ok: false, code: "lead_capture_failed" },
    });

    expect(outcome.classification).toBe(PUBLIC_LEAD_OUTCOMES.UNAVAILABLE);
  });

  it("classifies HTTP 502 lead_capture_unconfirmed as ambiguous", () => {
    const outcome = classifyPublicLeadResponse({
      status: 502,
      jsonValid: true,
      body: { ok: false, code: "lead_capture_unconfirmed" },
    });

    expect(outcome.classification).toBe(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
  });

  it("fails closed for unknown, malformed or invalid HTTP 502 inputs", () => {
    const cases = [
      { status: 502, jsonValid: true, body: { ok: false, code: "unknown" } },
      { status: 502, jsonValid: false, body: null },
      { status: 502, jsonValid: true, body: [] },
      null,
      undefined,
      [],
      {
        get status() {
          throw new Error("classifier status getter sentinel");
        },
      },
    ];

    for (const current of cases) {
      expect(classifyPublicLeadResponse(current)).toEqual({
        classification: PUBLIC_LEAD_OUTCOMES.AMBIGUOUS,
        leadId: null,
      });
    }
  });

  it("classifies HTTP 503 as unavailable regardless of body", () => {
    const outcome = classifyPublicLeadResponse({
      status: 503,
      jsonValid: false,
      body: null,
    });

    expect(outcome.classification).toBe(PUBLIC_LEAD_OUTCOMES.UNAVAILABLE);
  });

  it("fails closed when the response body is empty", async () => {
    const fetchImpl = vi.fn(async () => rawResponse(201, ""));

    const outcome = await submitPublicLead({ name: "Unit" }, { fetchImpl });

    expect(outcome.classification).toBe(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("classifies a network rejection as ambiguous with exactly one fetch", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network sentinel");
    });

    const outcome = await submitPublicLead({ name: "Unit" }, { fetchImpl });

    expect(outcome.classification).toBe(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails closed for invalid response interfaces and rejected body reads", async () => {
    const cases = [
      { response: null, expectedReads: 0 },
      { response: undefined, expectedReads: 0 },
      { response: { status: 201 }, expectedReads: 0 },
      { response: { status: 201, text: "not-a-function" }, expectedReads: 0 },
      {
        createResponse: (onRead) => ({
          status: Symbol("invalid-status"),
          async text() {
            onRead();
            return "{}";
          },
        }),
        expectedReads: 0,
      },
      {
        response: {
          get status() {
            throw new Error("status getter sentinel");
          },
          async text() {
            return "{}";
          },
        },
        expectedReads: 0,
      },
      {
        response: {
          status: 201,
          get text() {
            throw new Error("text getter sentinel");
          },
        },
        expectedReads: 0,
      },
      {
        createResponse: (onRead) => ({
          status: 201,
          async text() {
            onRead();
            throw new Error("body read sentinel");
          },
        }),
        expectedReads: 1,
      },
    ];

    for (const current of cases) {
      const onRead = vi.fn();
      const response = current.createResponse
        ? current.createResponse(onRead)
        : current.response;
      const fetchImpl = vi.fn(async () => response);
      const outcome = await submitPublicLead({ name: "Unit" }, { fetchImpl });

      expect(outcome).toEqual({
        classification: PUBLIC_LEAD_OUTCOMES.AMBIGUOUS,
        leadId: null,
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(onRead).toHaveBeenCalledTimes(current.expectedReads);
    }
  });

  it("performs exactly one POST with the expected payload and one body read", async () => {
    const payload = { name: "Unit", whatsapp: "5511999990000" };
    const onText = vi.fn();
    const fetchImpl = vi.fn(async () =>
      jsonResponse(201, { ok: true, lead_id: LEAD_ID }, onText)
    );

    const outcome = await submitPublicLead(payload, { fetchImpl });

    expect(outcome.classification).toBe(PUBLIC_LEAD_OUTCOMES.SUCCESS);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("/api/public/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("does not retry or read twice after a non-success response", async () => {
    const onText = vi.fn();
    const fetchImpl = vi.fn(async () => jsonResponse(500, { ok: false }, onText));

    const outcome = await submitPublicLead({ name: "Unit" }, { fetchImpl });

    expect(outcome.classification).toBe(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalledTimes(1);
  });

  it("keeps success and validation policies aligned with form behavior", () => {
    const success = getPublicLeadUiPolicy(PUBLIC_LEAD_OUTCOMES.SUCCESS);
    const validation = getPublicLeadUiPolicy(PUBLIC_LEAD_OUTCOMES.VALIDATION_ERROR);

    expect(success).toMatchObject({
      clearForm: true,
      preserveForm: false,
      allowImmediateSubmit: false,
      blockScope: "modal",
    });
    expect(validation).toMatchObject({
      clearForm: false,
      preserveForm: true,
      allowImmediateSubmit: true,
      blockScope: "none",
    });
  });

  it("keeps rate-limited and unavailable policies preserving and modal-scoped", () => {
    for (const classification of [
      PUBLIC_LEAD_OUTCOMES.RATE_LIMITED,
      PUBLIC_LEAD_OUTCOMES.UNAVAILABLE,
    ]) {
      expect(getPublicLeadUiPolicy(classification)).toMatchObject({
        clearForm: false,
        preserveForm: true,
        allowImmediateSubmit: false,
        blockScope: "modal",
      });
    }
  });

  it("keeps AMBIGUOUS preserving, page-scoped and sanitized without retry language", async () => {
    const rawSentinel = "sensitive raw response sentinel";
    const policy = getPublicLeadUiPolicy(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
    const fetchImpl = vi.fn(async () =>
      rawResponse(
        502,
        JSON.stringify({ code: "lead_capture_unconfirmed", raw: rawSentinel })
      )
    );

    const outcome = await submitPublicLead(
      { privateValue: "sensitive request sentinel" },
      { fetchImpl }
    );

    expect(policy).toMatchObject({
      clearForm: false,
      preserveForm: true,
      allowImmediateSubmit: false,
      blockScope: "page",
    });
    expect(policy.message).not.toContain("tente novamente");
    expect(policy.message).not.toContain("reenvie");
    expect(Object.keys(outcome).sort()).toEqual(["classification", "leadId"]);
    expect(JSON.stringify(outcome)).not.toContain(rawSentinel);
    expect(JSON.stringify(outcome)).not.toContain("sensitive request sentinel");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
