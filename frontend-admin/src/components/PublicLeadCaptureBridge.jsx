import { useEffect, useMemo, useRef, useState } from "react";
import {
  PUBLIC_LEAD_OUTCOMES,
  getPublicLeadUiPolicy,
  submitPublicLead,
} from "../utils/publicLeadSubmission";

const R36E_MARKER = "__AUTOATENDE_V4_R36E_R1_LANDING_PUBLIC_LEAD_CAPTURE_MODAL_FRONTEND_ONLY_DOCKER_BUILD__";

const initialForm = {
  name: "",
  company_name: "",
  whatsapp: "",
  email: "",
  message: "",
  website: "",
};

function getText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isPublicLanding() {
  return window.location.pathname === "/" || window.location.pathname === "";
}

function getUtmParams() {
  const params = new URLSearchParams(window.location.search || "");
  return {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
    utm_term: params.get("utm_term") || "",
  };
}

function shouldOpenLeadCapture(target) {
  if (!target || !isPublicLanding()) return false;

  const element = target.closest?.("a, button, [role='button']");
  if (!element) return false;

  const text = getText(element.innerText || element.textContent).toLowerCase();
  const href = getText(element.getAttribute?.("href")).toLowerCase();
  const aria = getText(element.getAttribute?.("aria-label")).toLowerCase();
  const combined = `${text} ${href} ${aria}`;

  if (/entrar|login|acessar painel|dashboard|política|politica|termos/.test(combined)) {
    return false;
  }

  return /falar com vendas|começar|comecar|demo|demonstração|demonstracao|contato|conhecer|assinar|quero testar|solicitar/.test(combined);
}

export default function PublicLeadCaptureBridge() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [submissionBlock, setSubmissionBlock] = useState("none");
  const inFlightRef = useRef(false);
  const submissionBlockRef = useRef("none");

  const disabled = status === "submitting" || submissionBlock !== "none";

  const utm = useMemo(() => {
    if (typeof window === "undefined") return {};
    return getUtmParams();
  }, []);

  useEffect(() => {
    function openModal() {
      if (inFlightRef.current) {
        setStatus("submitting");
        setOpen(true);
        return;
      }

      if (submissionBlockRef.current !== "page") {
        submissionBlockRef.current = "none";
        setSubmissionBlock("none");
        setStatus("idle");
        setMessage("");
      }

      setOpen(true);
    }

    function handleClick(event) {
      if (!shouldOpenLeadCapture(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      openModal();
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeydown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [open]);

  if (!open) return null;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function applySubmissionOutcome(outcome) {
    const policy = getPublicLeadUiPolicy(outcome.classification);

    if (policy.clearForm && outcome.classification === PUBLIC_LEAD_OUTCOMES.SUCCESS) {
      setForm(initialForm);
    }

    submissionBlockRef.current = policy.blockScope;
    setSubmissionBlock(policy.blockScope);
    setStatus(
      outcome.classification === PUBLIC_LEAD_OUTCOMES.SUCCESS
        ? "success"
        : "error"
    );
    setMessage(policy.message);
  }

  async function submitLead(event) {
    event.preventDefault();

    if (inFlightRef.current || submissionBlockRef.current !== "none") {
      return;
    }

    inFlightRef.current = true;
    setStatus("submitting");
    setMessage("");

    try {
      const payload = {
        ...form,
        ...utm,
        source: "public_landing",
        page_path: window.location.pathname || "/",
      };

      const outcome = await submitPublicLead(payload);
      applySubmissionOutcome(outcome);
    } catch {
      applySubmissionOutcome({
        classification: PUBLIC_LEAD_OUTCOMES.AMBIGUOUS,
        leadId: null,
      });
    } finally {
      inFlightRef.current = false;
    }
  }

  function submitButtonLabel() {
    if (status === "submitting") return "Enviando...";
    if (status === "success") return "Interesse enviado";
    if (submissionBlock === "page") return "Envio não confirmado";
    if (submissionBlock === "modal") return "Envio indisponível";
    return "Enviar interesse";
  }

  return (
    <div className="aa-r36e-lead-modal" data-marker={R36E_MARKER} role="dialog" aria-modal="true" aria-label="Falar com vendas">
      <button className="aa-r36e-lead-modal__backdrop" type="button" aria-label="Fechar formulário" onClick={() => setOpen(false)} />
      <div className="aa-r36e-lead-modal__panel">
        <div className="aa-r36e-lead-modal__header">
          <div>
            <span className="aa-r36e-lead-modal__eyebrow">AutoAtendeAI</span>
            <h2>Fale com vendas</h2>
            <p>Deixe seus dados para entendermos sua operação e indicar o melhor caminho.</p>
          </div>
          <button className="aa-r36e-lead-modal__close" type="button" onClick={() => setOpen(false)} aria-label="Fechar">
            ×
          </button>
        </div>

        <form className="aa-r36e-lead-modal__form" onSubmit={submitLead}>
          <label>
            <span>Nome</span>
            <input type="text" value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Seu nome" autoComplete="name" required minLength={2} maxLength={120} />
          </label>

          <label>
            <span>Empresa</span>
            <input type="text" value={form.company_name} onChange={(event) => updateField("company_name", event.target.value)} placeholder="Nome da empresa" autoComplete="organization" maxLength={160} />
          </label>

          <label>
            <span>WhatsApp</span>
            <input type="tel" value={form.whatsapp} onChange={(event) => updateField("whatsapp", event.target.value)} placeholder="DDD + número" autoComplete="tel" required minLength={10} maxLength={20} />
          </label>

          <label>
            <span>Email opcional</span>
            <input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="email@empresa.com" autoComplete="email" maxLength={180} />
          </label>

          <label className="aa-r36e-lead-modal__wide">
            <span>Mensagem opcional</span>
            <textarea value={form.message} onChange={(event) => updateField("message", event.target.value)} placeholder="Conte rapidamente como sua empresa usa o WhatsApp hoje" maxLength={1000} rows={4} />
          </label>

          <label className="aa-r36e-lead-modal__honeypot" aria-hidden="true">
            <span>Website</span>
            <input type="text" value={form.website} onChange={(event) => updateField("website", event.target.value)} tabIndex={-1} autoComplete="off" />
          </label>

          {message ? (
            <div className={`aa-r36e-lead-modal__message aa-r36e-lead-modal__message--${status}`} role="status">
              {message}
            </div>
          ) : null}

          <div className="aa-r36e-lead-modal__actions">
            <button type="button" className="aa-r36e-lead-modal__secondary" onClick={() => setOpen(false)}>
              Agora não
            </button>
            <button type="submit" className="aa-r36e-lead-modal__primary" disabled={disabled}>
              {submitButtonLabel()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
