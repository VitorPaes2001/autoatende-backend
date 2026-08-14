export const PUBLIC_LEAD_OUTCOMES = Object.freeze({
  SUCCESS: "SUCCESS",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  AMBIGUOUS: "AMBIGUOUS",
  UNAVAILABLE: "UNAVAILABLE",
});

const PUBLIC_LEAD_UI_POLICIES = Object.freeze({
  [PUBLIC_LEAD_OUTCOMES.SUCCESS]: Object.freeze({
    message: "Recebemos seu interesse. Em breve entraremos em contato pelo WhatsApp informado.",
    clearForm: true,
    preserveForm: false,
    allowImmediateSubmit: false,
    blockScope: "modal",
  }),
  [PUBLIC_LEAD_OUTCOMES.VALIDATION_ERROR]: Object.freeze({
    message: "Revise nome, WhatsApp e e-mail para continuar.",
    clearForm: false,
    preserveForm: true,
    allowImmediateSubmit: true,
    blockScope: "none",
  }),
  [PUBLIC_LEAD_OUTCOMES.RATE_LIMITED]: Object.freeze({
    message: "Muitas solicitações foram recebidas. Aguarde antes de enviar novamente.",
    clearForm: false,
    preserveForm: true,
    allowImmediateSubmit: false,
    blockScope: "modal",
  }),
  [PUBLIC_LEAD_OUTCOMES.AMBIGUOUS]: Object.freeze({
    message: "Não foi possível confirmar o registro. Para evitar duplicidade, não envie novamente nesta página.",
    clearForm: false,
    preserveForm: true,
    allowImmediateSubmit: false,
    blockScope: "page",
  }),
  [PUBLIC_LEAD_OUTCOMES.UNAVAILABLE]: Object.freeze({
    message: "A captação está temporariamente indisponível. Seus dados foram preservados.",
    clearForm: false,
    preserveForm: true,
    allowImmediateSubmit: false,
    blockScope: "modal",
  }),
});

function createOutcome(classification, leadId = null) {
  return Object.freeze({
    classification,
    leadId,
  });
}

export function isValidPublicLeadUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
  );
}

export function classifyPublicLeadResponse(responseData = {}) {
  try {
    if (
      !responseData ||
      typeof responseData !== "object" ||
      Array.isArray(responseData)
    ) {
      return createOutcome(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
    }

    const { status, jsonValid, body } = responseData;
    const responseBody =
      body && typeof body === "object" && !Array.isArray(body)
        ? body
        : null;

    if (
      status === 201 &&
      jsonValid === true &&
      responseBody?.ok === true &&
      isValidPublicLeadUuid(responseBody.lead_id)
    ) {
      return createOutcome(
        PUBLIC_LEAD_OUTCOMES.SUCCESS,
        responseBody.lead_id.trim()
      );
    }

    if (status === 400) {
      return createOutcome(PUBLIC_LEAD_OUTCOMES.VALIDATION_ERROR);
    }

    if (status === 429) {
      return createOutcome(PUBLIC_LEAD_OUTCOMES.RATE_LIMITED);
    }

    if (status === 503) {
      return createOutcome(PUBLIC_LEAD_OUTCOMES.UNAVAILABLE);
    }

    if (
      status === 502 &&
      jsonValid === true &&
      responseBody?.code === "lead_capture_failed"
    ) {
      return createOutcome(PUBLIC_LEAD_OUTCOMES.UNAVAILABLE);
    }
  } catch {
    return createOutcome(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
  }

  return createOutcome(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
}

export function getPublicLeadUiPolicy(classification) {
  return (
    PUBLIC_LEAD_UI_POLICIES[classification] ||
    PUBLIC_LEAD_UI_POLICIES[PUBLIC_LEAD_OUTCOMES.AMBIGUOUS]
  );
}

export async function submitPublicLead(payload, options = {}) {
  let fetchImpl;

  try {
    fetchImpl = options?.fetchImpl || globalThis.fetch;
  } catch {
    return createOutcome(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
  }

  let response;

  try {
    response = await fetchImpl("/api/public/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return createOutcome(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
  }

  let status;
  let text;

  try {
    if (
      !response ||
      (typeof response !== "object" && typeof response !== "function")
    ) {
      return createOutcome(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
    }

    const rawStatus = response.status;
    const readText = response.text;

    status = Number(rawStatus);

    if (typeof readText !== "function") {
      return createOutcome(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
    }

    text = await readText.call(response);
  } catch {
    return createOutcome(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
  }

  let body = null;
  let jsonValid = false;

  if (text) {
    try {
      body = JSON.parse(text);
      jsonValid = true;
    } catch {
      body = null;
    }
  }

  try {
    return classifyPublicLeadResponse({
      status,
      jsonValid,
      body,
    });
  } catch {
    return createOutcome(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
  }
}
