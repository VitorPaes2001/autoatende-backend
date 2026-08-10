import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
