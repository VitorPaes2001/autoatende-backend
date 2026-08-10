import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { resolveCompanyId } from "../utils/companyContext";
/* __AUTOATENDE_C2E_ONBOARDING_SUCCESS_STATE__ */

const STEPS = [
  { id: 0, title: "Empresa", description: "Identidade e público-alvo." },
  { id: 1, title: "Oferta", description: "Contexto comercial e serviços." },
  { id: 2, title: "Tom e regras", description: "Tom de voz, restrições e guidance." },
  { id: 3, title: "Resumo", description: "Revisão final e próximo passo recomendado." },
];

const TONE_PRESETS = [
  "profissional, claro e objetivo",
  "consultivo, confiável e direto",
  "comercial, cordial e persuasivo sem exageros",
  "acolhedor, rápido e seguro",
];

const GUIDANCE_PRESETS = [
  "Explique o valor da solução com clareza e sem prometer o que não foi configurado.",
  "Priorize respostas comerciais objetivas, evitando listas longas e linguagem robótica.",
  "Quando fizer sentido, conduza o lead para entender operação, equipe e volume de atendimento.",
];

function extractTokenCandidate(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const obj = JSON.parse(trimmed);
        return (
          obj?.access_token ||
          obj?.token ||
          obj?.session?.access_token ||
          obj?.currentSession?.access_token ||
          null
        );
      } catch (_) {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (typeof raw === "object") {
    return raw?.access_token || raw?.token || raw?.session?.access_token || null;
  }
  return null;
}

function getAuthToken() {
  const directKeys = [
    "token",
    "authToken",
    "access_token",
    "jwt",
    "supabase.auth.token",
    "sb-access-token",
  ];

  for (const key of directKeys) {
    const local = window.localStorage.getItem(key);
    const localToken = extractTokenCandidate(local);
    if (localToken) return localToken;

    const session = window.sessionStorage.getItem(key);
    const sessionToken = extractTokenCandidate(session);
    if (sessionToken) return sessionToken;
  }

  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key) continue;
      if (!/token|auth|jwt|supabase|session/i.test(key)) continue;
      const token = extractTokenCandidate(storage.getItem(key));
      if (token) return token;
    }
  }

  return null;
}

async function apiRequest(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = { raw: text };
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      data?.raw ||
      `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function arrayToMultiline(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function multilineToArray(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function prettyJson(value) {
  try {
    return JSON.stringify(value ?? [], null, 2);
  } catch (_) {
    return "[]";
  }
}

function sourceToLabel(source) {
  if (!source) return "desconhecida";
  if (source === "database") return "database";
  if (source === "json_file") return "json_file";
  if (source === "legacy_fallback") return "legacy_fallback";
  return source;
}

function StepPill({ active, complete, children }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 999,
        padding: "8px 12px",
        fontSize: 13,
        opacity: active ? 1 : 0.8,
        background: active ? "rgba(0,0,0,0.05)" : complete ? "rgba(0,128,0,0.08)" : "transparent",
      }}
    >
      {children}
    </div>
  );
}

function FieldHint({ children }) {
  return (
    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
      {children}
    </div>
  );
}

function ValidationBox({ items }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop: 16, padding: 12, border: "1px solid #f0ad4e", borderRadius: 8 }}>
      <strong>Para avançar nesta etapa, ajuste:</strong>
      <ul style={{ marginBottom: 0 }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function QuickStat({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 14,
        minWidth: 180,
        flex: 1,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function AutosavePill({ status, lastSavedAt }) {
  let label = "Sem alterações";
  let border = "#ddd";

  if (status === "dirty") {
    label = "Alterações pendentes";
    border = "#f0ad4e";
  } else if (status === "saving") {
    label = "Salvando rascunho...";
    border = "#5bc0de";
  } else if (status === "saved") {
    label = lastSavedAt
      ? `Rascunho salvo às ${lastSavedAt}`
      : "Rascunho salvo";
    border = "#5cb85c";
  } else if (status === "error") {
    label = "Falha no autosave";
    border = "#d9534f";
  }

  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 999,
        padding: "8px 12px",
        fontSize: 13,
      }}
    >
      {label}
    </div>
  );
}

function formatClock(date) {
  if (!date) return "";
  try {
    return new Date(date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return "";
  }
}

function SuccessPanel({ companyName, suggestedPrompt, onDismiss }) {
  return (
    <section
      style={{
        border: "1px solid #5cb85c",
        borderRadius: 14,
        padding: 18,
        background: "rgba(0,128,0,0.06)",
        marginBottom: 18,
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>Onboarding comercial concluído</h2>
      <p style={{ marginTop: 0, lineHeight: 1.7 }}>
        O perfil comercial de <strong>{companyName || "sua empresa"}</strong> foi salvo como concluído.
        Agora o melhor próximo passo é validar o comportamento do assistente com perguntas reais.
      </p>

      <div
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.7,
          padding: 14,
          borderRadius: 10,
          background: "rgba(255,255,255,0.7)",
          border: "1px dashed #9ad39a",
          marginBottom: 12,
        }}
      >
        Pergunta sugerida para começar o teste:
        {"\n\n"}
        {suggestedPrompt}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link
          to="/configuracoes/teste-assistente"
          style={{
            textDecoration: "none",
            padding: "10px 16px",
            border: "1px solid #5cb85c",
            borderRadius: 8,
            color: "inherit",
            background: "rgba(255,255,255,0.75)",
          }}
        >
          Testar o Assistente agora
        </Link>

        <Link
          to="/configuracoes/assistente-central"
          style={{
            textDecoration: "none",
            padding: "10px 16px",
            border: "1px solid #5cb85c",
            borderRadius: 8,
            color: "inherit",
            background: "rgba(255,255,255,0.75)",
          }}
        >
          Revisar Perfil Comercial
        </Link>

        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: "10px 16px",
            border: "1px solid #5cb85c",
            borderRadius: 8,
            cursor: "pointer",
            background: "rgba(255,255,255,0.75)",
          }}
        >
          Continuar no onboarding
        </button>
      </div>
    </section>
  );
}

export default function CommercialOnboardingWizard() {
  const resolvedCompanyId = resolveCompanyId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [step, setStep] = useState(0);
  const [profileSource, setProfileSource] = useState("");
  const [rawProfile, setRawProfile] = useState(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showCompletionPanel, setShowCompletionPanel] = useState(false);

  const [form, setForm] = useState({
    company_name: "",
    company_context: "",
    services_text: "",
    target_audience: "",
    tone: "",
    forbidden_topics_text: "",
    assistant_guidance: "",
    faq_base_json: "[]",
    onboarding_completed: false,
  });

  const initialLoadRef = useRef(true);
  const lastSavedPayloadRef = useRef("");
  const autosaveTimerRef = useRef(null);

  const sourceLabel = useMemo(() => sourceToLabel(profileSource), [profileSource]);

  const completion = useMemo(() => {
    return {
      company: Boolean(form.company_name.trim() && form.target_audience.trim()),
      offer: Boolean(form.company_context.trim() && multilineToArray(form.services_text).length),
      tone: Boolean(form.tone.trim()),
      summary: Boolean(
        form.company_name.trim() &&
        form.company_context.trim() &&
        multilineToArray(form.services_text).length &&
        form.tone.trim()
      ),
    };
  }, [form]);

  const servicesList = useMemo(() => multilineToArray(form.services_text), [form.services_text]);
  const forbiddenTopicsList = useMemo(() => multilineToArray(form.forbidden_topics_text), [form.forbidden_topics_text]);

  const completionRatio = useMemo(() => {
    const completed = [
      completion.company,
      completion.offer,
      completion.tone,
      Boolean(form.onboarding_completed || completion.summary),
    ].filter(Boolean).length;
    return Math.round((completed / 4) * 100);
  }, [completion, form.onboarding_completed]);

  const buildPayload = (markCompleted = false) => {
    let faqBase = [];
    try {
      faqBase = JSON.parse(form.faq_base_json || "[]");
      if (!Array.isArray(faqBase)) {
        throw new Error("FAQ base precisa ser um array JSON.");
      }
    } catch (err) {
      throw new Error("FAQ base precisa estar em JSON válido no formato de array.");
    }

    return {
      company_name: form.company_name,
      company_context: form.company_context,
      services: servicesList,
      target_audience: form.target_audience,
      tone: form.tone,
      forbidden_topics: forbiddenTopicsList,
      assistant_guidance: form.assistant_guidance,
      faq_base: faqBase,
      onboarding_completed: markCompleted ? true : Boolean(form.onboarding_completed),
    };
  };

  const serializedDraftPayload = useMemo(() => {
    try {
      return JSON.stringify(buildPayload(false));
    } catch (_) {
      return "__INVALID_PAYLOAD__";
    }
  }, [form, servicesList, forbiddenTopicsList]);

  const stepValidation = useMemo(() => {
    const map = {
      0: [],
      1: [],
      2: [],
      3: [],
    };

    if (!form.company_name.trim()) map[0].push("preencher o nome da empresa");
    if (!form.target_audience.trim()) map[0].push("definir o público-alvo");

    if (!form.company_context.trim()) map[1].push("descrever o contexto comercial da empresa");
    if (!servicesList.length) map[1].push("informar pelo menos um serviço ou produto");

    if (!form.tone.trim()) map[2].push("definir o tom de voz do assistente");

    try {
      const parsed = JSON.parse(form.faq_base_json || "[]");
      if (!Array.isArray(parsed)) {
        map[2].push("manter a FAQ base em formato JSON de array");
      }
    } catch (_) {
      map[2].push("corrigir o JSON da FAQ base");
    }

    if (!completion.summary) {
      map[3].push("concluir as etapas anteriores antes de finalizar");
    }

    return map;
  }, [form, completion.summary, servicesList]);

  const canAdvance = stepValidation[step].length === 0;
  const currentStepMeta = STEPS.find((item) => item.id === step) || STEPS[0];

  const generatedSummary = useMemo(() => {
    const company = form.company_name.trim() || "A empresa";
    const target = form.target_audience.trim() || "seu público";
    const context = form.company_context.trim();
    const tone = form.tone.trim() || "profissional";
    const services = servicesList.length ? servicesList.join(", ") : "serviços ainda não informados";
    const forbidden = forbiddenTopicsList.length ? forbiddenTopicsList.join(", ") : "sem tópicos proibidos informados";

    return `${company} atende ${target}. A proposta comercial configurada no assistente é: ${context || "contexto ainda não preenchido"}. Os principais serviços ou produtos informados são: ${services}. O assistente deve responder em tom ${tone} e evitar os seguintes tópicos: ${forbidden}.`;
  }, [form, servicesList, forbiddenTopicsList]);

  const suggestedPrompt = useMemo(() => {
    const company = form.company_name.trim() || "empresa";
    const firstService = servicesList[0] || "atendimento via WhatsApp";
    return `Como a ${company} pode ajudar uma empresa interessada em ${firstService}?`;
  }, [form.company_name, servicesList]);

  const recommendedNextAction = useMemo(() => {
    if (!completion.summary) return "Complete as etapas obrigatórias para liberar a conclusão do onboarding.";
    if (!form.onboarding_completed) return "Salve e conclua o onboarding para marcar a configuração comercial como pronta.";
    return "O próximo melhor passo é abrir o Teste do Assistente e validar perguntas comerciais reais.";
  }, [completion.summary, form.onboarding_completed]);

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const data = await apiRequest("/api/company-commercial-profiles/me");
      const profile = data?.profile || {};
      setRawProfile(profile);
      setProfileSource(profile?.source || "");

      const nextForm = {
        company_name: profile.company_name || "",
        company_context: profile.company_context || "",
        services_text: arrayToMultiline(profile.services),
        target_audience: profile.target_audience || "",
        tone: profile.tone || "",
        forbidden_topics_text: arrayToMultiline(profile.forbidden_topics),
        assistant_guidance: profile.assistant_guidance || "",
        faq_base_json: prettyJson(profile.faq_base || []),
        onboarding_completed: Boolean(profile.onboarding_completed),
      };

      setForm(nextForm);
      setShowCompletionPanel(Boolean(profile.onboarding_completed));

      try {
        const payload = {
          company_name: nextForm.company_name,
          company_context: nextForm.company_context,
          services: multilineToArray(nextForm.services_text),
          target_audience: nextForm.target_audience,
          tone: nextForm.tone,
          forbidden_topics: multilineToArray(nextForm.forbidden_topics_text),
          assistant_guidance: nextForm.assistant_guidance,
          faq_base: JSON.parse(nextForm.faq_base_json || "[]"),
          onboarding_completed: Boolean(nextForm.onboarding_completed),
        };
        lastSavedPayloadRef.current = JSON.stringify(payload);
        setAutosaveStatus("saved");
        setLastSavedAt(formatClock(new Date()));
      } catch (_) {
        lastSavedPayloadRef.current = "";
        setAutosaveStatus("idle");
      }

      initialLoadRef.current = false;
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key !== "onboarding_completed") {
      setShowCompletionPanel(false);
    }
  };

  const nextStep = () => {
    if (!canAdvance) return;
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const prevStep = () => setStep((prev) => Math.max(prev - 1, 0));

  const handleSave = async (markCompleted = false) => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = buildPayload(markCompleted);

      const data = await apiRequest("/api/company-commercial-profiles/me", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      const profile = data?.profile || {};
      setRawProfile(profile);
      setProfileSource(profile?.source || profileSource);
      setForm((prev) => ({
        ...prev,
        onboarding_completed: Boolean(profile?.onboarding_completed),
      }));

      const savedPayload = {
        ...payload,
        onboarding_completed: Boolean(profile?.onboarding_completed),
      };
      lastSavedPayloadRef.current = JSON.stringify(savedPayload);
      setAutosaveStatus("saved");
      setLastSavedAt(formatClock(new Date()));

      if (markCompleted) {
        setShowCompletionPanel(true);
        setStep(3);
      }

      setSuccess(markCompleted ? "Onboarding comercial salvo como concluído." : "Rascunho salvo com sucesso.");
    } catch (err) {
      setAutosaveStatus("error");
      setError(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (loading || initialLoadRef.current) return;
    if (serializedDraftPayload === "__INVALID_PAYLOAD__") {
      setAutosaveStatus("error");
      return;
    }
    if (serializedDraftPayload === lastSavedPayloadRef.current) {
      return;
    }

    setAutosaveStatus("dirty");

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        setAutosaveStatus("saving");
        const payload = buildPayload(false);

        await apiRequest("/api/company-commercial-profiles/me", {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        lastSavedPayloadRef.current = JSON.stringify(payload);
        setAutosaveStatus("saved");
        setLastSavedAt(formatClock(new Date()));
      } catch (_) {
        setAutosaveStatus("error");
      }
    }, 1200);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [serializedDraftPayload, loading]);

  const injectTonePreset = (preset) => {
    updateField("tone", preset);
  };

  const appendGuidancePreset = (preset) => {
    const current = String(form.assistant_guidance || "").trim();
    const next = current ? `${current}\n${preset}` : preset;
    updateField("assistant_guidance", next);
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(generatedSummary);
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 1800);
    } catch (_) {
      setCopiedSummary(false);
    }
  };

  const copySuggestedPrompt = async () => {
    try {
      await navigator.clipboard.writeText(suggestedPrompt);
      setCopiedPrompt(true);
      window.setTimeout(() => setCopiedPrompt(false), 1800);
    } catch (_) {
      setCopiedPrompt(false);
    }
  };

  const renderStep = () => {
    if (step === 0) {
      return (
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Etapa 1 — Empresa</h2>
          <p style={{ marginTop: 0, opacity: 0.8 }}>
            Defina os dados centrais do negócio que vão orientar o comportamento comercial do assistente.
          </p>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <label>
              <div>Nome da empresa</div>
              <input
                value={form.company_name}
                onChange={(e) => updateField("company_name", e.target.value)}
                style={{ width: "100%", padding: 10 }}
              />
              <FieldHint>Ex.: AutoAtendeAI</FieldHint>
            </label>

            <label>
              <div>Público-alvo</div>
              <input
                value={form.target_audience}
                onChange={(e) => updateField("target_audience", e.target.value)}
                style={{ width: "100%", padding: 10 }}
              />
              <FieldHint>Ex.: pequenas e médias empresas que atendem pelo WhatsApp</FieldHint>
            </label>
          </div>
        </section>
      );
    }

    if (step === 1) {
      return (
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Etapa 2 — Oferta</h2>
          <p style={{ marginTop: 0, opacity: 0.8 }}>
            Aqui você descreve o que a empresa vende, resolve ou entrega.
          </p>

          <label>
            <div>Contexto comercial da empresa</div>
            <textarea
              value={form.company_context}
              onChange={(e) => updateField("company_context", e.target.value)}
              rows={6}
              style={{ width: "100%", padding: 10 }}
            />
            <FieldHint>Descreva a proposta de valor principal com clareza.</FieldHint>
          </label>

          <div style={{ height: 12 }} />

          <label>
            <div>Serviços / produtos (1 por linha)</div>
            <textarea
              value={form.services_text}
              onChange={(e) => updateField("services_text", e.target.value)}
              rows={7}
              style={{ width: "100%", padding: 10 }}
            />
            <FieldHint>Ex.: automação de atendimento, inbox, transferência para humano, qualificação de leads</FieldHint>
          </label>
        </section>
      );
    }

    if (step === 2) {
      return (
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Etapa 3 — Tom e regras</h2>
          <p style={{ marginTop: 0, opacity: 0.8 }}>
            Ajuste a personalidade comercial do assistente e os limites de resposta.
          </p>

          <label>
            <div>Tom de voz</div>
            <input
              value={form.tone}
              onChange={(e) => updateField("tone", e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {TONE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => injectTonePreset(preset)}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 999,
                  padding: "8px 12px",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                Usar preset
              </button>
            ))}
          </div>

          <div style={{ height: 12 }} />

          <label>
            <div>Tópicos proibidos (1 por linha)</div>
            <textarea
              value={form.forbidden_topics_text}
              onChange={(e) => updateField("forbidden_topics_text", e.target.value)}
              rows={5}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <div style={{ height: 12 }} />

          <label>
            <div>Guidance adicional</div>
            <textarea
              value={form.assistant_guidance}
              onChange={(e) => updateField("assistant_guidance", e.target.value)}
              rows={6}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {GUIDANCE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => appendGuidancePreset(preset)}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 999,
                  padding: "8px 12px",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                Adicionar sugestão
              </button>
            ))}
          </div>

          <div style={{ height: 12 }} />

          <label>
            <div>FAQ base (JSON array)</div>
            <textarea
              value={form.faq_base_json}
              onChange={(e) => updateField("faq_base_json", e.target.value)}
              rows={10}
              style={{ width: "100%", padding: 10, fontFamily: "monospace" }}
            />
            <FieldHint>Mantenha esse campo em formato JSON de array.</FieldHint>
          </label>
        </section>
      );
    }

    return (
      <div style={{ display: "grid", gap: 16 }}>
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Etapa 4 — Resumo inteligente</h2>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <QuickStat label="Progresso" value={`${completionRatio}%`} />
            <QuickStat label="Serviços informados" value={String(servicesList.length)} />
            <QuickStat label="Tópicos proibidos" value={String(forbiddenTopicsList.length)} />
            <QuickStat label="Fonte atual" value={sourceLabel} />
          </div>

          <div
            style={{
              whiteSpace: "pre-wrap",
              lineHeight: 1.7,
              padding: 14,
              borderRadius: 10,
              background: "rgba(0,0,0,0.04)",
              border: "1px solid #e5e5e5",
            }}
          >
            {generatedSummary}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <button
              type="button"
              onClick={copySummary}
              style={{
                padding: "10px 16px",
                border: "1px solid #ddd",
                borderRadius: 8,
                cursor: "pointer",
                background: "transparent",
              }}
            >
              {copiedSummary ? "Resumo copiado" : "Copiar resumo"}
            </button>
          </div>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Próxima ação recomendada</h2>
          <p style={{ marginTop: 0 }}>{recommendedNextAction}</p>

          <div
            style={{
              whiteSpace: "pre-wrap",
              lineHeight: 1.7,
              padding: 14,
              borderRadius: 10,
              background: "rgba(0,0,0,0.03)",
              border: "1px dashed #d9d9d9",
            }}
          >
            Prompt sugerido para teste:
            {"\n\n"}
            {suggestedPrompt}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <button
              type="button"
              onClick={copySuggestedPrompt}
              style={{
                padding: "10px 16px",
                border: "1px solid #ddd",
                borderRadius: 8,
                cursor: "pointer",
                background: "transparent",
              }}
            >
              {copiedPrompt ? "Prompt copiado" : "Copiar prompt sugerido"}
            </button>

            <Link
              to="/configuracoes/teste-assistente"
              style={{
                textDecoration: "none",
                padding: "10px 16px",
                border: "1px solid #ddd",
                borderRadius: 8,
                color: "inherit",
              }}
            >
              Ir para Teste do Assistente
            </Link>

            <Link
              to="/configuracoes/assistente-central"
              style={{
                textDecoration: "none",
                padding: "10px 16px",
                border: "1px solid #ddd",
                borderRadius: 8,
                color: "inherit",
              }}
            >
              Revisar Perfil Comercial
            </Link>
          </div>
        </section>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Onboarding Comercial</h1>
        <p>Carregando dados do onboarding...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 8 }}>Onboarding Comercial</h1>
        <p style={{ margin: 0 }}>
          Configure a base comercial do assistente em etapas guiadas para deixar o bot pronto com mais rapidez.
        </p>

        <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            to="/configuracoes/assistente-central"
            style={{
              textDecoration: "none",
              border: "1px solid #ddd",
              borderRadius: 999,
              padding: "8px 12px",
              color: "inherit",
            }}
          >
            Ir para Perfil Comercial
          </Link>

          <Link
            to="/configuracoes/teste-assistente"
            style={{
              textDecoration: "none",
              border: "1px solid #ddd",
              borderRadius: 999,
              padding: "8px 12px",
              color: "inherit",
            }}
          >
            Ir para Teste do Assistente
          </Link>

          <AutosavePill status={autosaveStatus} lastSavedAt={lastSavedAt} />
        </div>
      </div>

      {showCompletionPanel ? (
        <SuccessPanel
          companyName={form.company_name}
          suggestedPrompt={suggestedPrompt}
          onDismiss={() => setShowCompletionPanel(false)}
        />
      ) : null}

      {error ? (
        <div style={{ marginBottom: 16, padding: 12, border: "1px solid #d9534f", borderRadius: 8 }}>
          <strong>Erro:</strong> {error}
        </div>
      ) : null}

      {success ? (
        <div style={{ marginBottom: 16, padding: 12, border: "1px solid #5cb85c", borderRadius: 8 }}>
          {success}
        </div>
      ) : null}

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          <strong>Progresso do onboarding</strong>
          <span>{completionRatio}% concluído</span>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
          <div
            style={{
              width: `${completionRatio}%`,
              height: "100%",
              background: "rgba(0,128,0,0.55)",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {STEPS.map((item) => (
          <StepPill
            key={item.id}
            active={step === item.id}
            complete={
              item.id === 0 ? completion.company :
              item.id === 1 ? completion.offer :
              item.id === 2 ? completion.tone :
              Boolean(form.onboarding_completed || completion.summary)
            }
          >
            {item.title}
          </StepPill>
        ))}
      </div>

      <div style={{ marginBottom: 12, opacity: 0.8 }}>
        <strong>{currentStepMeta.title}</strong> — {currentStepMeta.description}
      </div>

      {renderStep()}
      <ValidationBox items={stepValidation[step]} />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
        <button
          type="button"
          onClick={prevStep}
          disabled={step === 0}
          style={{
            padding: "10px 16px",
            border: "1px solid #ddd",
            borderRadius: 8,
            cursor: step === 0 ? "not-allowed" : "pointer",
            background: "transparent",
          }}
        >
          Voltar
        </button>

        <button
          type="button"
          onClick={nextStep}
          disabled={step === STEPS.length - 1 || !canAdvance}
          style={{
            padding: "10px 16px",
            border: "1px solid #ddd",
            borderRadius: 8,
            cursor: step === STEPS.length - 1 || !canAdvance ? "not-allowed" : "pointer",
            background: "transparent",
          }}
        >
          Próxima etapa
        </button>

        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={saving}
          style={{
            padding: "10px 16px",
            border: "1px solid #ddd",
            borderRadius: 8,
            cursor: saving ? "not-allowed" : "pointer",
            background: "transparent",
          }}
        >
          {saving ? "Salvando..." : "Salvar rascunho"}
        </button>

        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={saving || !completion.summary}
          style={{
            padding: "10px 16px",
            border: "1px solid #ddd",
            borderRadius: 8,
            cursor: saving || !completion.summary ? "not-allowed" : "pointer",
            background: "transparent",
          }}
        >
          {saving ? "Concluindo..." : "Concluir onboarding"}
        </button>
      </div>

      <details style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16, marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Snapshot bruto atual</summary>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 16 }}>
          {JSON.stringify(rawProfile, null, 2)}
        </pre>
      </details>
    </div>
  );
}
