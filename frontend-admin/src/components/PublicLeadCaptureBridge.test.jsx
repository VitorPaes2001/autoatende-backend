import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const utilityMock = vi.hoisted(() => ({
  submitPublicLead: vi.fn(),
}));

vi.mock("../utils/publicLeadSubmission", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    submitPublicLead: utilityMock.submitPublicLead,
  };
});

import PublicLeadCaptureBridge from "./PublicLeadCaptureBridge";
import AcquisitionRecentPage from "../pages/AcquisitionRecentPage";
import {
  PUBLIC_LEAD_OUTCOMES,
  getPublicLeadUiPolicy,
} from "../utils/publicLeadSubmission";

function outcome(classification) {
  return {
    classification,
    leadId:
      classification === PUBLIC_LEAD_OUTCOMES.SUCCESS
        ? "11111111-1111-4111-8111-111111111111"
        : null,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function resolveDeferred(control, value) {
  await act(async () => {
    control.resolve(value);
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderOpenBridge(search = "") {
  window.history.replaceState({}, "", `/${search}`);
  render(
    <>
      <button type="button">Falar com vendas</button>
      <PublicLeadCaptureBridge />
    </>
  );
  fireEvent.click(screen.getByRole("button", { name: "Falar com vendas" }));
  const dialog = screen.getByRole("dialog", { name: "Falar com vendas" });
  return { dialog, form: dialog.querySelector("form") };
}

function fillValidForm(values = {}) {
  const current = {
    name: "Pessoa Teste",
    company: "Empresa Exemplo",
    whatsapp: "5511999990000",
    email: "qa@example.test",
    message: "Quero conhecer o produto.",
    ...values,
  };
  fireEvent.change(screen.getByLabelText("Nome"), {
    target: { value: current.name },
  });
  fireEvent.change(screen.getByLabelText("Empresa"), {
    target: { value: current.company },
  });
  fireEvent.change(screen.getByLabelText("WhatsApp"), {
    target: { value: current.whatsapp },
  });
  fireEvent.change(screen.getByLabelText("Email opcional"), {
    target: { value: current.email },
  });
  fireEvent.change(screen.getByLabelText("Mensagem opcional"), {
    target: { value: current.message },
  });
  return current;
}

function getLeadControls() {
  return {
    name: screen.getByLabelText("Nome"),
    company: screen.getByLabelText("Empresa"),
    whatsapp: screen.getByLabelText("WhatsApp"),
    email: screen.getByLabelText("Email opcional"),
    message: screen.getByLabelText("Mensagem opcional"),
  };
}

function expectAllFieldsToMatch(values) {
  const controls = getLeadControls();
  expect(controls.name.value).toBe(values.name);
  expect(controls.company.value).toBe(values.company);
  expect(controls.whatsapp.value).toBe(values.whatsapp);
  expect(controls.email.value).toBe(values.email);
  expect(controls.message.value).toBe(values.message);
}

function expectAllFieldsToBeCleared() {
  const controls = getLeadControls();
  expect(controls.name.value).toBe("");
  expect(controls.company.value).toBe("");
  expect(controls.whatsapp.value).toBe("");
  expect(controls.email.value).toBe("");
  expect(controls.message.value).toBe("");
}

function expectPolicyMessage(classification) {
  expect(screen.getByText(getPublicLeadUiPolicy(classification).message)).toBeTruthy();
}

function closeAndReopen() {
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Falar com vendas" }));
  return screen.getByRole("dialog", { name: "Falar com vendas" });
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  utilityMock.submitPublicLead.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("PublicLeadCaptureBridge behavioral contract", () => {
  it("does not call the utility when required form fields are invalid", () => {
    utilityMock.submitPublicLead.mockResolvedValue(
      outcome(PUBLIC_LEAD_OUTCOMES.SUCCESS)
    );
    renderOpenBridge();

    const name = screen.getByLabelText("Nome");
    expect(name.validity.valid).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Enviar interesse" }));

    expect(utilityMock.submitPublicLead).toHaveBeenCalledTimes(0);
    expect(screen.getByRole("dialog", { name: "Falar com vendas" })).toBeTruthy();
    expect(screen.queryByText(getPublicLeadUiPolicy(PUBLIC_LEAD_OUTCOMES.SUCCESS).message)).toBeNull();
  });

  it("submits one valid payload with the real UTM and page metadata", async () => {
    utilityMock.submitPublicLead.mockResolvedValue(
      outcome(PUBLIC_LEAD_OUTCOMES.SUCCESS)
    );
    const { form } = renderOpenBridge(
      "?utm_source=qa&utm_medium=cpc&utm_campaign=launch&utm_content=hero&utm_term=bot"
    );
    const values = fillValidForm();

    fireEvent.submit(form);

    await waitFor(() => {
      expect(utilityMock.submitPublicLead).toHaveBeenCalledTimes(1);
    });
    expect(utilityMock.submitPublicLead).toHaveBeenCalledWith({
      name: values.name,
      company_name: values.company,
      whatsapp: values.whatsapp,
      email: values.email,
      message: values.message,
      website: "",
      utm_source: "qa",
      utm_medium: "cpc",
      utm_campaign: "launch",
      utm_content: "hero",
      utm_term: "bot",
      source: "public_landing",
      page_path: "/",
    });
    await act(async () => Promise.resolve());
    expect(utilityMock.submitPublicLead).toHaveBeenCalledTimes(1);
  });

  it("ignores a second rapid submit while the first promise is pending", async () => {
    const control = deferred();
    utilityMock.submitPublicLead.mockReturnValue(control.promise);
    const { form } = renderOpenBridge();
    fillValidForm();

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(utilityMock.submitPublicLead).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Enviando..." }).disabled).toBe(true);

    await resolveDeferred(
      control,
      outcome(PUBLIC_LEAD_OUTCOMES.VALIDATION_ERROR)
    );
    await waitFor(() => {
      expectPolicyMessage(PUBLIC_LEAD_OUTCOMES.VALIDATION_ERROR);
    });
  });

  it("keeps the in-flight block when the modal closes and reopens", async () => {
    const control = deferred();
    utilityMock.submitPublicLead.mockReturnValue(control.promise);
    const { form } = renderOpenBridge();
    const values = fillValidForm();
    fireEvent.submit(form);

    const reopened = closeAndReopen();
    expectAllFieldsToMatch(values);
    expect(screen.getByRole("button", { name: "Enviando..." }).disabled).toBe(true);
    fireEvent.submit(reopened.querySelector("form"));
    expect(utilityMock.submitPublicLead).toHaveBeenCalledTimes(1);

    await resolveDeferred(
      control,
      outcome(PUBLIC_LEAD_OUTCOMES.VALIDATION_ERROR)
    );
  });

  it("clears the form only after SUCCESS resolves", async () => {
    const control = deferred();
    utilityMock.submitPublicLead.mockReturnValue(control.promise);
    const { form } = renderOpenBridge();
    const values = fillValidForm();
    fireEvent.submit(form);

    expectAllFieldsToMatch(values);

    await resolveDeferred(control, outcome(PUBLIC_LEAD_OUTCOMES.SUCCESS));

    await waitFor(() => {
      expectAllFieldsToBeCleared();
    });
    expectPolicyMessage(PUBLIC_LEAD_OUTCOMES.SUCCESS);
    expect(screen.getByRole("button", { name: "Interesse enviado" }).disabled).toBe(true);
  });

  it("preserves data after VALIDATION_ERROR and permits one deliberate retry", async () => {
    utilityMock.submitPublicLead.mockResolvedValue(
      outcome(PUBLIC_LEAD_OUTCOMES.VALIDATION_ERROR)
    );
    const { form } = renderOpenBridge();
    const values = fillValidForm();
    fireEvent.submit(form);

    await waitFor(() => {
      expectPolicyMessage(PUBLIC_LEAD_OUTCOMES.VALIDATION_ERROR);
    });
    expectAllFieldsToMatch(values);
    expect(utilityMock.submitPublicLead).toHaveBeenCalledTimes(1);

    fireEvent.submit(form);
    await waitFor(() => {
      expect(utilityMock.submitPublicLead).toHaveBeenCalledTimes(2);
    });
  });

  it("preserves data and respects modal scope for RATE_LIMITED and UNAVAILABLE", async () => {
    for (const classification of [
      PUBLIC_LEAD_OUTCOMES.RATE_LIMITED,
      PUBLIC_LEAD_OUTCOMES.UNAVAILABLE,
    ]) {
      cleanup();
      utilityMock.submitPublicLead.mockReset();
      utilityMock.submitPublicLead.mockResolvedValue(outcome(classification));
      const { form } = renderOpenBridge();
      const values = fillValidForm({ name: `Pessoa ${classification}` });
      fireEvent.submit(form);

      await waitFor(() => {
        expectPolicyMessage(classification);
      });
      expectAllFieldsToMatch(values);
      expect(screen.getByRole("button", { name: "Envio indisponível" }).disabled).toBe(true);
      expect(utilityMock.submitPublicLead).toHaveBeenCalledTimes(1);

      const reopened = closeAndReopen();
      expectAllFieldsToMatch(values);
      expect(screen.getByRole("button", { name: "Enviar interesse" }).disabled).toBe(false);
      fireEvent.submit(reopened.querySelector("form"));
      await waitFor(() => {
        expect(utilityMock.submitPublicLead).toHaveBeenCalledTimes(2);
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
    }
  });

  it("preserves data and blocks immediate resubmission after AMBIGUOUS", async () => {
    utilityMock.submitPublicLead.mockResolvedValue(
      outcome(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS)
    );
    const { form } = renderOpenBridge();
    const values = fillValidForm();
    fireEvent.submit(form);

    await waitFor(() => {
      expectPolicyMessage(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
    });
    expectAllFieldsToMatch(values);
    expect(screen.getByRole("button", { name: "Envio não confirmado" }).disabled).toBe(true);
    fireEvent.submit(form);
    expect(utilityMock.submitPublicLead).toHaveBeenCalledTimes(1);
  });

  it("keeps AMBIGUOUS page-blocked after closing and reopening", async () => {
    utilityMock.submitPublicLead.mockResolvedValue(
      outcome(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS)
    );
    const { form } = renderOpenBridge();
    const values = fillValidForm();
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Envio não confirmado" })).toBeTruthy();
    });
    expectAllFieldsToMatch(values);
    const reopened = closeAndReopen();
    expectAllFieldsToMatch(values);
    expect(screen.getByRole("button", { name: "Envio não confirmado" }).disabled).toBe(true);
    fireEvent.submit(reopened.querySelector("form"));
    expect(utilityMock.submitPublicLead).toHaveBeenCalledTimes(1);
  });

  it("fails closed without retry when the utility rejects unexpectedly", async () => {
    utilityMock.submitPublicLead.mockRejectedValue(
      new Error("unexpected utility rejection sentinel")
    );
    const { form } = renderOpenBridge();
    const values = fillValidForm();
    fireEvent.submit(form);

    await waitFor(() => {
      expectPolicyMessage(PUBLIC_LEAD_OUTCOMES.AMBIGUOUS);
    });
    expectAllFieldsToMatch(values);
    expect(utilityMock.submitPublicLead).toHaveBeenCalledTimes(1);

    const reopened = closeAndReopen();
    expectAllFieldsToMatch(values);
    fireEvent.submit(reopened.querySelector("form"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(utilityMock.submitPublicLead).toHaveBeenCalledTimes(1);
  });
});
function acquisitionJsonResponse(body, status = 200) {
  const serialized = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => serialized,
    json: async () => body,
  };
}

function acquisitionTemplate(overrides = {}) {
  return {
    key: "approved_a::pt_BR",
    label: "Template aprovado A",
    name: "approved_a",
    language: "pt_BR",
    categoryKey: "utility_auth",
    previewText: "Prévia autoritativa A",
    defaultSendComponents: [],
    ...overrides,
  };
}

function createAcquisitionFetchMock(catalogResponse) {
  return vi.fn((url, options = {}) => {
    const target = String(url);
    const method = String(options?.method || "GET").toUpperCase();

    if (target === "/api/ops-surface/acquisition/templates") {
      return Promise.resolve(catalogResponse);
    }

    if (target.startsWith("/api/ops-surface/acquisition/recent")) {
      return Promise.resolve(acquisitionJsonResponse({
        data: {
          rows: [],
          filters: {},
          viewer: { resolved_role: "admin", is_admin_like: true },
        },
      }));
    }

    if (target === "/api/billing/status") {
      return Promise.resolve(acquisitionJsonResponse({
        limits: { marketingTemplates: 10, utilityAuthTemplates: 10 },
        usage: { marketingTemplates: 0, utilityAuthTemplates: 0 },
      }));
    }

    if (target === "/api/ops-surface/acquisition/send-template" && method === "POST") {
      const body = JSON.parse(String(options?.body || "{}"));
      return Promise.resolve(acquisitionJsonResponse({ data: { to: body.to } }));
    }

    throw new Error(`Unexpected acquisition test request: ${method} ${target}`);
  });
}

function renderAcquisitionPage(catalogResponse) {
  window.__AUTOATENDE_SESSION__ = {
    access_token: "header.payload.signature",
  };

  const fetchMock = createAcquisitionFetchMock(catalogResponse);
  vi.stubGlobal("fetch", fetchMock);

  render(
    <MemoryRouter>
      <AcquisitionRecentPage />
    </MemoryRouter>
  );

  return fetchMock;
}

function fillAcquisitionManualFields({
  phone = "5511999990000",
  templateName = "approved_a",
} = {}) {
  fireEvent.change(screen.getByPlaceholderText("Ex.: 5545999999999"), {
    target: { value: phone },
  });
  fireEvent.change(screen.getByPlaceholderText("Ex.: lembrete_pagamento"), {
    target: { value: templateName },
  });
}

function acquisitionTemplateSelect() {
  const heading = screen.getByText("Template aprovado");
  return heading.parentElement.querySelector("select");
}

function acquisitionSendCalls(fetchMock) {
  return fetchMock.mock.calls.filter(([url, options]) =>
    String(url) === "/api/ops-surface/acquisition/send-template" &&
    String(options?.method || "GET").toUpperCase() === "POST"
  );
}

async function forceDisabledAcquisitionSendAttempt() {
  const button = screen.getByRole("button", { name: "Enviar template" });
  expect(button.disabled).toBe(true);
  const reactPropsKey = Object.keys(button).find((key) =>
    key.startsWith("__reactProps$")
  );
  const onClick = reactPropsKey ? button[reactPropsKey]?.onClick : null;
  expect(onClick).toBeTypeOf("function");
  await act(async () => {
    await onClick({ preventDefault() {} });
  });
  return button;
}

describe("AcquisitionRecentPage latest approved-template authority", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.__AUTOATENDE_SESSION__;
  });

  afterEach(() => {
    delete window.__AUTOATENDE_SESSION__;
    vi.unstubAllGlobals();
  });

  it("blocks send while the approved catalog is loading, including a forced handler attempt", async () => {
    const catalogControl = deferred();
    const fetchMock = renderAcquisitionPage(catalogControl.promise);
    fillAcquisitionManualFields({ templateName: "not_approved" });

    await screen.findByRole("option", {
      name: "Carregando templates aprovados...",
    });
    await forceDisabledAcquisitionSendAttempt();

    await waitFor(() => {
      expect(acquisitionSendCalls(fetchMock)).toHaveLength(0);
    });
    expect(
      screen.getAllByText(
        "Aguarde o carregamento dos templates aprovados antes de enviar."
      ).length
    ).toBeGreaterThan(0);
  });

  it("blocks send when the approved catalog is unavailable, including a forced handler attempt", async () => {
    const fetchMock = renderAcquisitionPage(
      acquisitionJsonResponse({ message: "provider detail sentinel" }, 503)
    );
    fillAcquisitionManualFields({ templateName: "not_approved" });

    await screen.findByText(
      "O catálogo de templates aprovados está indisponível. O envio permanece bloqueado."
    );
    await forceDisabledAcquisitionSendAttempt();

    await waitFor(() => {
      expect(acquisitionSendCalls(fetchMock)).toHaveLength(0);
    });
  });

  it("blocks send when the approved catalog is empty, including a forced handler attempt", async () => {
    const fetchMock = renderAcquisitionPage(
      acquisitionJsonResponse({ items: [] })
    );
    fillAcquisitionManualFields({ templateName: "not_approved" });

    await screen.findByRole("option", {
      name: "Nenhum template aprovado carregado",
    });
    await screen.findByText(
      "Nenhum template aprovado está disponível. O envio permanece bloqueado."
    );
    await forceDisabledAcquisitionSendAttempt();

    await waitFor(() => {
      expect(acquisitionSendCalls(fetchMock)).toHaveLength(0);
    });
  });

  it("uses the latest catalog when it resolves after the send callback was rendered", async () => {
    const catalogControl = deferred();
    const fetchMock = renderAcquisitionPage(catalogControl.promise);
    fillAcquisitionManualFields();

    await resolveDeferred(
      catalogControl,
      acquisitionJsonResponse({ items: [acquisitionTemplate()] })
    );
    await screen.findByRole("option", { name: "Template aprovado A" });

    fireEvent.click(screen.getByRole("button", { name: "Enviar template" }));

    await waitFor(() => {
      expect(acquisitionSendCalls(fetchMock)).toHaveLength(1);
    });
    const requestBody = JSON.parse(acquisitionSendCalls(fetchMock)[0][1].body);
    expect(requestBody.templatePreviewText).toBe("Prévia autoritativa A");
  });

  it("uses the latest selected template after a previous callback render", async () => {
    const templateA = acquisitionTemplate();
    const templateB = acquisitionTemplate({
      key: "approved_b::pt_BR",
      label: "Template aprovado B",
      name: "approved_b",
      previewText: "Prévia autoritativa B",
    });
    const fetchMock = renderAcquisitionPage(
      acquisitionJsonResponse({ items: [templateA, templateB] })
    );

    await screen.findByRole("option", { name: "Template aprovado A" });
    fillAcquisitionManualFields({ templateName: "approved_a" });
    fireEvent.change(acquisitionTemplateSelect(), {
      target: { value: templateA.key },
    });
    fireEvent.change(acquisitionTemplateSelect(), {
      target: { value: templateB.key },
    });

    fireEvent.click(screen.getByRole("button", { name: "Enviar template" }));

    await waitFor(() => {
      expect(acquisitionSendCalls(fetchMock)).toHaveLength(1);
    });
    const requestBody = JSON.parse(acquisitionSendCalls(fetchMock)[0][1].body);
    expect(requestBody.template_name).toBe("approved_b");
    expect(requestBody.templatePreviewText).toBe("Prévia autoritativa B");
  });

  it("blocks an unapproved template after an asynchronously loaded catalog", async () => {
    const catalogControl = deferred();
    const fetchMock = renderAcquisitionPage(catalogControl.promise);
    fillAcquisitionManualFields({ templateName: "not_approved" });

    await resolveDeferred(
      catalogControl,
      acquisitionJsonResponse({ items: [acquisitionTemplate()] })
    );
    await screen.findByRole("option", { name: "Template aprovado A" });

    await forceDisabledAcquisitionSendAttempt();

    await screen.findByText(
      "Template/idioma não encontrado entre os templates aprovados da Meta."
    );
    expect(acquisitionSendCalls(fetchMock)).toHaveLength(0);
  });

  it("keeps the approved template success path after catalog load", async () => {
    const template = acquisitionTemplate();
    const fetchMock = renderAcquisitionPage(
      acquisitionJsonResponse({ items: [template] })
    );

    await screen.findByRole("option", { name: "Template aprovado A" });
    fillAcquisitionManualFields();
    fireEvent.change(acquisitionTemplateSelect(), {
      target: { value: template.key },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar template" }));

    await screen.findByText("Template enviado com sucesso para 5511999990000.");
    expect(acquisitionSendCalls(fetchMock)).toHaveLength(1);
  });
});
