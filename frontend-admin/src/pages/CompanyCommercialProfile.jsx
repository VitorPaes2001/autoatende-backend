import React, { useEffect, useMemo, useState } from "react";

import { resolveCompanyId } from "../utils/companyContext";
/* __AUTOATENDE_C1D1_COMPANY_COMMERCIAL_PROFILE_PAGE_POLISH__ */

function tryParseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

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

export default function CompanyCommercialProfile() {
  const resolvedCompanyId = resolveCompanyId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [source, setSource] = useState("");
  const [rawProfile, setRawProfile] = useState(null);
  const [faqJsonError, setFaqJsonError] = useState("");

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

  const sourceLabel = useMemo(() => sourceToLabel(source), [source]);

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const data = await apiRequest("/api/company-commercial-profiles/me");
      const profile = data?.profile || {};
      setRawProfile(profile);
      setSource(profile?.source || "");

      setForm({
        company_name: profile.company_name || "",
        company_context: profile.company_context || "",
        services_text: arrayToMultiline(profile.services),
        target_audience: profile.target_audience || "",
        tone: profile.tone || "",
        forbidden_topics_text: arrayToMultiline(profile.forbidden_topics),
        assistant_guidance: profile.assistant_guidance || "",
        faq_base_json: prettyJson(profile.faq_base || []),
        onboarding_completed: Boolean(profile.onboarding_completed),
      });

      setFaqJsonError("");
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const formatFaqJson = () => {
    const parsed = tryParseJson(form.faq_base_json, null);
    if (!Array.isArray(parsed)) {
      setFaqJsonError("O campo FAQ base precisa ser um JSON válido no formato de array.");
      return;
    }
    setFaqJsonError("");
    updateField("faq_base_json", prettyJson(parsed));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const faqBase = tryParseJson(form.faq_base_json, null);
      if (!Array.isArray(faqBase)) {
        setFaqJsonError("O campo FAQ base precisa ser um JSON válido no formato de array.");
        setSaving(false);
        return;
      }

      setFaqJsonError("");

      const payload = {
        company_name: form.company_name,
        company_context: form.company_context,
        services: multilineToArray(form.services_text),
        target_audience: form.target_audience,
        tone: form.tone,
        forbidden_topics: multilineToArray(form.forbidden_topics_text),
        assistant_guidance: form.assistant_guidance,
        faq_base: faqBase,
        onboarding_completed: Boolean(form.onboarding_completed),
      };

      const data = await apiRequest("/api/company-commercial-profiles/me", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      const profile = data?.profile || {};
      setRawProfile(profile);
      setSource(profile?.source || source);
      setSuccess("Perfil comercial salvo com sucesso.");
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Configuração Comercial</h1>
        <p>Carregando perfil comercial...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 8 }}>Configuração Comercial</h1>
        <p style={{ margin: 0 }}>
          Edite o contexto comercial da empresa que alimenta o assistente.
        </p>
        <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span
            style={{
              border: "1px solid #ddd",
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 13,
            }}
          >
            Fonte atual: <strong>{sourceLabel}</strong>
          </span>
          <span
            style={{
              border: "1px solid #ddd",
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 13,
            }}
          >
            Rota: <strong>/api/company-commercial-profiles/me</strong>
          </span>
        </div>
      </div>

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

      {faqJsonError ? (
        <div style={{ marginBottom: 16, padding: 12, border: "1px solid #f0ad4e", borderRadius: 8 }}>
          <strong>FAQ JSON:</strong> {faqJsonError}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 16 }}>
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Identidade da empresa</h2>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <label>
              <div>Nome da empresa</div>
              <input
                value={form.company_name}
                onChange={(e) => updateField("company_name", e.target.value)}
                style={{ width: "100%", padding: 10 }}
              />
            </label>

            <label>
              <div>Público-alvo</div>
              <input
                value={form.target_audience}
                onChange={(e) => updateField("target_audience", e.target.value)}
                style={{ width: "100%", padding: 10 }}
              />
            </label>

            <label>
              <div>Tom de voz</div>
              <input
                value={form.tone}
                onChange={(e) => updateField("tone", e.target.value)}
                style={{ width: "100%", padding: 10 }}
              />
            </label>
          </div>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Contexto comercial</h2>

          <label>
            <div>Contexto da empresa</div>
            <textarea
              value={form.company_context}
              onChange={(e) => updateField("company_context", e.target.value)}
              rows={6}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <div style={{ height: 12 }} />

          <label>
            <div>Serviços / produtos (1 por linha)</div>
            <textarea
              value={form.services_text}
              onChange={(e) => updateField("services_text", e.target.value)}
              rows={6}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

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
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Guidance e FAQ</h2>

          <label>
            <div>Guidance adicional</div>
            <textarea
              value={form.assistant_guidance}
              onChange={(e) => updateField("assistant_guidance", e.target.value)}
              rows={6}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <div style={{ height: 12 }} />

          <label>
            <div>FAQ base (JSON)</div>
            <textarea
              value={form.faq_base_json}
              onChange={(e) => updateField("faq_base_json", e.target.value)}
              rows={14}
              style={{ width: "100%", padding: 10, fontFamily: "monospace" }}
            />
          </label>

          <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={formatFaqJson}
              style={{ padding: "10px 16px", cursor: "pointer" }}
            >
              Formatar FAQ JSON
            </button>
          </div>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Estado</h2>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={Boolean(form.onboarding_completed)}
              onChange={(e) => updateField("onboarding_completed", e.target.checked)}
            />
            <span>Onboarding comercial concluído</span>
          </label>
        </section>

        <section style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ padding: "10px 18px", cursor: saving ? "not-allowed" : "pointer" }}
          >
            {saving ? "Salvando..." : "Salvar perfil comercial"}
          </button>

          <button
            type="button"
            onClick={loadProfile}
            disabled={loading || saving}
            style={{ padding: "10px 18px", cursor: loading || saving ? "not-allowed" : "pointer" }}
          >
            Recarregar
          </button>
        </section>

        <details style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Snapshot bruto atual</summary>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 16 }}>
            {JSON.stringify(rawProfile, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
