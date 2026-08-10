import { useEffect } from "react";

/**
 * __AUTOATENDE_V4_R12C_R3_ADD_AGENT_FORM_VALIDATION_UX__
 *
 * Camada visual de validação para o fluxo de criação de agente.
 * Não altera backend, endpoint, banco ou regra de limite.
 */

const MARKER = "__AUTOATENDE_V4_R12C_R3_ADD_AGENT_FORM_VALIDATION_UX__";

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function textOf(node) {
  return normalize(node?.innerText || node?.textContent || "");
}

function isAgentCreateContext(node) {
  if (!node) return false;

  const text = textOf(node);

  const hasAgentMeaning =
    text.includes("adicionar agente") ||
    text.includes("novo agente") ||
    text.includes("criar agente") ||
    text.includes("cadastrar agente") ||
    text.includes("agente de atendimento");

  const hasFormMeaning =
    text.includes("email") ||
    text.includes("e-mail") ||
    text.includes("nome") ||
    text.includes("perfil") ||
    node.querySelector?.("input, select, textarea");

  const isDeleteContext =
    text.includes("excluir agente") ||
    text.includes("remover agente");

  return hasAgentMeaning && hasFormMeaning && !isDeleteContext;
}

function findAgentCreateContainer(start) {
  const candidates = [
    start?.closest?.("[role='dialog']"),
    start?.closest?.("dialog"),
    start?.closest?.("form"),
    start?.closest?.("[data-state='open']"),
    start?.closest?.("[class*='modal']"),
    start?.closest?.("[class*='dialog']")
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (isAgentCreateContext(candidate)) return candidate;
  }

  let current = start;

  for (let depth = 0; current && depth < 10; depth += 1) {
    if (isAgentCreateContext(current)) return current;
    current = current.parentElement;
  }

  return null;
}

function isCreateSubmitAction(node) {
  if (!node) return false;

  const text = textOf(node);
  const aria = normalize(node.getAttribute?.("aria-label") || "");
  const title = normalize(node.getAttribute?.("title") || "");
  const merged = `${text} ${aria} ${title}`;

  const actionWords =
    merged.includes("adicionar") ||
    merged.includes("criar") ||
    merged.includes("salvar") ||
    merged.includes("convidar") ||
    merged.includes("cadastrar");

  const agentWords =
    merged.includes("agente") ||
    merged.includes("usuario") ||
    merged.includes("usuário") ||
    merged.length <= 28;

  return actionWords && agentWords;
}

function fieldMeta(input) {
  const label =
    input.getAttribute("aria-label") ||
    input.getAttribute("placeholder") ||
    input.getAttribute("name") ||
    input.getAttribute("id") ||
    "";

  const normalized = normalize(label);

  return {
    label,
    normalized,
    type: normalize(input.getAttribute("type") || input.tagName || "")
  };
}

function findFields(container) {
  const all = Array.from(container.querySelectorAll("input, select, textarea"))
    .filter((field) => !field.disabled && isVisible(field))
    .filter((field) => {
      const type = normalize(field.getAttribute("type") || "");
      return !["hidden", "button", "submit", "checkbox", "radio"].includes(type);
    });

  let emailField = null;
  let nameField = null;
  let roleField = null;

  for (const field of all) {
    const meta = fieldMeta(field);
    const value = String(field.value || "").trim();

    if (!emailField && (
      meta.type === "email" ||
      meta.normalized.includes("email") ||
      meta.normalized.includes("e-mail") ||
      value.includes("@")
    )) {
      emailField = field;
      continue;
    }

    if (!roleField && field.tagName === "SELECT" && (
      meta.normalized.includes("perfil") ||
      meta.normalized.includes("role") ||
      meta.normalized.includes("cargo")
    )) {
      roleField = field;
      continue;
    }

    if (!nameField && (
      meta.normalized.includes("nome") ||
      meta.normalized.includes("name") ||
      meta.normalized.includes("agente")
    )) {
      nameField = field;
      continue;
    }
  }

  if (!nameField) {
    nameField = all.find((field) => {
      if (field === emailField || field === roleField) return false;
      const type = normalize(field.getAttribute("type") || "");
      return ["", "text"].includes(type) || field.tagName === "TEXTAREA";
    }) || null;
  }

  return {
    all,
    emailField,
    nameField,
    roleField
  };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
}

function removeFieldError(field) {
  if (!field) return;

  field.classList.remove("aa-r12c-r3-field-error");
  field.removeAttribute("aria-invalid");

  const next = field.nextElementSibling;

  if (next?.dataset?.aaR12cR3FieldError === "true") {
    next.remove();
  }
}

function markFieldError(field, message) {
  if (!field) return;

  removeFieldError(field);

  field.classList.add("aa-r12c-r3-field-error");
  field.setAttribute("aria-invalid", "true");

  const helper = document.createElement("div");
  helper.className = "aa-r12c-r3-field-message";
  helper.dataset.aaR12cR3FieldError = "true";
  helper.textContent = message;

  field.insertAdjacentElement("afterend", helper);
}

function showToast(message, variant = "warning") {
  const previous = document.querySelector("[data-aa-r12c-r3-toast='true']");
  previous?.remove();

  const toast = document.createElement("div");
  toast.className = `aa-r12c-r3-toast aa-r12c-r3-toast-${variant}`;
  toast.dataset.aaR12cR3Toast = "true";
  toast.textContent = message;

  document.body.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("aa-r12c-r3-toast-exit");
    window.setTimeout(() => toast.remove(), 260);
  }, 3800);
}

function clearErrors(container) {
  container.querySelectorAll(".aa-r12c-r3-field-error").forEach((field) => {
    removeFieldError(field);
  });

  container.querySelectorAll("[data-aa-r12c-r3-field-error='true']").forEach((node) => {
    node.remove();
  });
}

function validateAgentForm(container) {
  const { all, emailField, nameField, roleField } = findFields(container);

  if (!all.length) return true;

  clearErrors(container);

  const errors = [];

  if (nameField) {
    const value = String(nameField.value || "").trim();

    if (value.length < 2) {
      errors.push("Informe o nome do agente.");
      markFieldError(nameField, "Informe o nome do agente.");
    }
  }

  if (emailField) {
    const value = String(emailField.value || "").trim();

    if (!value) {
      errors.push("Informe o e-mail do agente.");
      markFieldError(emailField, "Informe o e-mail do agente.");
    } else if (!isValidEmail(value)) {
      errors.push("Informe um e-mail válido.");
      markFieldError(emailField, "Informe um e-mail válido.");
    }
  }

  if (roleField) {
    const value = String(roleField.value || "").trim();

    if (!value) {
      errors.push("Selecione o perfil do usuário.");
      markFieldError(roleField, "Selecione o perfil do usuário.");
    }
  }

  if (!errors.length) return true;

  showToast(errors[0], "warning");

  const firstInvalid = container.querySelector(".aa-r12c-r3-field-error");
  firstInvalid?.focus?.();

  window.dispatchEvent(
    new CustomEvent("autoatende:add-agent-validation-blocked", {
      detail: {
        marker: MARKER,
        errors
      }
    })
  );

  return false;
}

export default function AgentCreateFormGuard() {
  useEffect(() => {
    const onClickCapture = (event) => {
      const action = event.target?.closest?.("button, a, [role='button']");

      if (!action) return;
      if (!isCreateSubmitAction(action)) return;

      const container = findAgentCreateContainer(action);

      if (!container) return;

      const valid = validateAgentForm(container);

      if (valid) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    };

    const onSubmitCapture = (event) => {
      const form = event.target;

      if (!form || form.tagName !== "FORM") return;

      const container = findAgentCreateContainer(form);

      if (!container) return;

      const valid = validateAgentForm(container);

      if (valid) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    };

    const onInput = (event) => {
      const field = event.target;

      if (!field?.matches?.("input, select, textarea")) return;

      removeFieldError(field);
    };

    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("submit", onSubmitCapture, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);

    return () => {
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("submit", onSubmitCapture, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
    };
  }, []);

  return null;
}
