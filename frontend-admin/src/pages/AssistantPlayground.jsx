// __AUTOATENDE_C3C2B1_PLAYGROUND_COPY_REFINEMENT__
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { resolveCompanyId } from "../utils/companyContext";
/* __AUTOATENDE_C1E2_ASSISTANT_PLAYGROUND_POLISH__ */

const HISTORY_STORAGE_KEY = "autoatende_assistant_preview_history_v1";

const PRESET_GROUPS = [
  {
    title: "Funcionamento",
    items: [
      "Como a AutoAtendeAI funciona na prática?",
      "Como a plataforma ajuda no atendimento via WhatsApp?",
      "Como funciona a alternância entre bot e humano?",
    ],
  },
  {
    title: "Planos",
    items: [
      "Quais são os planos da AutoAtendeAI?",
      "Quais planos fazem mais sentido para uma equipe pequena?",
      "As conversas são ilimitadas ou existe franquia?",
    ],
  },
  {
    title: "Comercial",
    items: [
      "Quero falar com um humano.",
      "Atendemos pequenas e médias empresas. Como a plataforma pode ajudar?",
      "Como a solução ajuda a qualificar leads?",
    ],
  },
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

function sourceToLabel(source) {
  if (!source) return "desconhecida";
  if (source === "database") return "database";
  if (source === "json_file") return "json_file";
  if (source === "legacy_fallback") return "legacy_fallback";
  return source;
}

function safeReadHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function safeWriteHistory(history) {
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (_) {}
}

function formatTimestamp(dateValue) {
  try {
    const d = new Date(dateValue);
    return d.toLocaleString("pt-BR");
  } catch (_) {
    return "";
  }
}

function truncateText(value, max = 180) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

function InfoPill({ children }) {
  return (
    <span
      style={{
        border: "1px solid #ddd",
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 13,
      }}
    >
      {children}
    </span>
  );
}

export default function AssistantPlayground() {
  const resolvedCompanyId = resolveCompanyId();
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState(PRESET_GROUPS[0].items[0]);
  const [previewReply, setPreviewReply] = useState("");
  const [previewMeta, setPreviewMeta] = useState(null);
  const [copiedQuestion, setCopiedQuestion] = useState(false);
  const [copiedReply, setCopiedReply] = useState(false);
  const [history, setHistory] = useState([]);

  const sourceLabel = useMemo(
    () => sourceToLabel(profile?.source || ""),
    [profile]
  );

  const loadProfile = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/api/company-commercial-profiles/me");
      setProfile(data?.profile || null);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    setHistory(safeReadHistory());
  }, []);

  const persistHistory = (nextHistory) => {
    setHistory(nextHistory);
    safeWriteHistory(nextHistory);
  };

  const pushHistoryEntry = (entry) => {
    const next = [entry, ...history].slice(0, 12);
    persistHistory(next);
  };

  const handleCopyQuestion = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedQuestion(true);
      window.setTimeout(() => setCopiedQuestion(false), 1800);
    } catch (_) {
      setCopiedQuestion(false);
    }
  };

  const handleCopyReply = async () => {
    try {
      await navigator.clipboard.writeText(previewReply || "");
      setCopiedReply(true);
      window.setTimeout(() => setCopiedReply(false), 1800);
    } catch (_) {
      setCopiedReply(false);
    }
  };

  const runPreview = async () => {
    setPreviewLoading(true);
    setError("");

    try {
      const data = await apiRequest("/api/assistant-preview/me", {
        method: "POST",
        body: JSON.stringify({
          company_id: resolvedCompanyId, message }),
      });

      const reply = data?.reply || "";
      const meta = data?.meta || null;

      setPreviewReply(reply);
      setPreviewMeta(meta);

      pushHistoryEntry({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        created_at: new Date().toISOString(),
        question: message,
        reply,
        meta,
      });
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setPreviewLoading(false);
    }
  };

  const clearHistory = () => {
    persistHistory([]);
  };

  const reuseHistoryQuestion = (item) => {
    setMessage(item?.question || "");
    setPreviewReply(item?.reply || "");
    setPreviewMeta(item?.meta || null);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 8 }}>Teste do Assistente</h1>
        <p style={{ margin: 0 }}>
          Área de preview para validar perguntas e verificar a resposta gerada pelo assistente com base no contexto comercial atual.
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

          <button
            type="button"
            onClick={loadProfile}
            style={{
              border: "1px solid #ddd",
              borderRadius: 999,
              padding: "8px 12px",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Recarregar dados
          </button>

          <button
            type="button"
            onClick={clearHistory}
            style={{
              border: "1px solid #ddd",
              borderRadius: 999,
              padding: "8px 12px",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Limpar histórico
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ marginBottom: 16, padding: 12, border: "1px solid #d9534f", borderRadius: 8 }}>
          <strong>Erro:</strong> {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 16 }}>
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Fonte ativa do assistente</h2>

          {loading ? (
            <p>Carregando contexto comercial...</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <InfoPill>
                  Fonte: <strong>{sourceLabel}</strong>
                </InfoPill>
                <InfoPill>
                  Empresa: <strong>{profile?.company_name || "não informado"}</strong>
                </InfoPill>
                <InfoPill>
                  Onboarding: <strong>{profile?.onboarding_completed ? "concluído" : "pendente"}</strong>
                </InfoPill>
              </div>
            </div>
          )}
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Pergunta de teste</h2>

          <div style={{ display: "grid", gap: 16 }}>
            {PRESET_GROUPS.map((group) => (
              <div key={group.title}>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>{group.title}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {group.items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setMessage(item)}
                      style={{
                        border: "1px solid #ddd",
                        borderRadius: 999,
                        padding: "8px 12px",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      Usar exemplo
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ height: 16 }} />

          <label>
            <div style={{ marginBottom: 8 }}>Mensagem para teste</div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={7}
              style={{ width: "100%", padding: 12 }}
            />
          </label>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <button
              type="button"
              onClick={runPreview}
              disabled={previewLoading}
              style={{
                padding: "10px 16px",
                border: "1px solid #ddd",
                borderRadius: 8,
                cursor: previewLoading ? "not-allowed" : "pointer",
                background: "transparent",
              }}
            >
              {previewLoading ? "Gerando preview..." : "Gerar prévia"}
            </button>

            <button
              type="button"
              onClick={handleCopyQuestion}
              style={{
                padding: "10px 16px",
                border: "1px solid #ddd",
                borderRadius: 8,
                cursor: "pointer",
                background: "transparent",
              }}
            >
              {copiedQuestion ? "Pergunta copiada" : "Copiar pergunta"}
            </button>

            <button
              type="button"
              onClick={() => setMessage("")}
              style={{
                padding: "10px 16px",
                border: "1px solid #ddd",
                borderRadius: 8,
                cursor: "pointer",
                background: "transparent",
              }}
            >
              Limpar
            </button>
          </div>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Prévia de resposta</h2>

          {previewReply ? (
            <div style={{ display: "grid", gap: 12 }}>
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
                {previewReply}
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleCopyReply}
                  style={{
                    padding: "10px 16px",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: "transparent",
                  }}
                >
                  {copiedReply ? "Resposta copiada" : "Copiar resposta"}
                </button>
              </div>

              {previewMeta ? (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <InfoPill>
                    Modo: <strong>{previewMeta.preview_mode || "desconhecido"}</strong>
                  </InfoPill>
                  <InfoPill>
                    Fallback: <strong>{previewMeta.used_fallback ? "sim" : "não"}</strong>
                  </InfoPill>
                  <InfoPill>
                    Fonte do perfil: <strong>{previewMeta.source_profile || "desconhecida"}</strong>
                  </InfoPill>
                </div>
              ) : null}
            </div>
          ) : (
            <p>A resposta de preview aparecerá aqui depois que você executar o teste.</p>
          )}
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ marginTop: 0, marginBottom: 0 }}>Histórico de testes</h2>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              Últimos {history.length} testes salvos neste navegador
            </div>
          </div>

          <div style={{ height: 12 }} />

          {history.length ? (
            <div style={{ display: "grid", gap: 12 }}>
              {history.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid #e5e5e5",
                    borderRadius: 10,
                    padding: 12,
                    background: "rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <strong>{truncateText(item.question, 110)}</strong>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>{formatTimestamp(item.created_at)}</span>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
                    {truncateText(item.reply, 240)}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => reuseHistoryQuestion(item)}
                      style={{
                        border: "1px solid #ddd",
                        borderRadius: 999,
                        padding: "6px 10px",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      Reusar
                    </button>

                    <InfoPill>
                      Modo: <strong>{item?.meta?.preview_mode || "desconhecido"}</strong>
                    </InfoPill>

                    <InfoPill>
                      Fallback: <strong>{item?.meta?.used_fallback ? "sim" : "não"}</strong>
                    </InfoPill>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>Nenhum teste salvo ainda. Gere uma resposta para começar o histórico local.</p>
          )}
        </section>

        <details style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Snapshot bruto do perfil atual</summary>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 16 }}>
            {JSON.stringify(profile, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
