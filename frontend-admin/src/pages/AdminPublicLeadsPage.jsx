import { useCallback, useEffect, useMemo, useState } from "react";

const R37B_MARKER = "__AUTOATENDE_V4_R37B_LEAD_STATUS_MANAGEMENT_BACKEND_FRONTEND_SAFE__";
const R38B_MARKER = "__AUTOATENDE_V4_R38B_LEADS_FOLLOWUP_ACTIONS_FRONTEND_ONLY__";

const statusLabels = {
  new: "Novo",
  contacted: "Contatado",
  qualified: "Qualificado",
  discarded: "Descartado",
};

const statusOptions = [
  { value: "new", label: "Novo" },
  { value: "contacted", label: "Contatado" },
  { value: "qualified", label: "Qualificado" },
  { value: "discarded", label: "Descartado" },
];

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function getText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function onlyDigits(value) {
  return getText(value).replace(/\D/g, "");
}

function normalizeWhatsAppForLink(value) {
  const digits = onlyDigits(value);
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

async function copyToClipboard(value) {
  const text = getText(value);
  if (!text) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "true");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    area.style.top = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function findTokenInObject(value, depth = 0) {
  if (!value || depth > 5) return "";

  if (typeof value === "string") {
    return value.startsWith("eyJ") || value.startsWith("sbp_") ? value : "";
  }

  if (typeof value !== "object") return "";

  const directKeys = [
    "access_token",
    "accessToken",
    "token",
    "jwt",
    "id_token",
  ];

  for (const key of directKeys) {
    if (typeof value[key] === "string" && value[key]) {
      return value[key];
    }
  }

  const nestedKeys = [
    "session",
    "currentSession",
    "auth",
    "data",
    "user",
    "supabase",
  ];

  for (const key of nestedKeys) {
    const found = findTokenInObject(value[key], depth + 1);
    if (found) return found;
  }

  for (const nested of Object.values(value)) {
    const found = findTokenInObject(nested, depth + 1);
    if (found) return found;
  }

  return "";
}

function readAuthToken() {
  if (typeof window === "undefined") return "";

  const fromWindow =
    findTokenInObject(window.__AUTOATENDE_AUTH__) ||
    findTokenInObject(window.__AUTOATENDE_SESSION__) ||
    findTokenInObject(window.__AUTOATENDE_USER__);

  if (fromWindow) return fromWindow;

  const preferredKeys = [
    "autoatende_session",
    "autoatende_auth",
    "sb-auth-token",
    "supabase.auth.token",
    "auth_user",
    "autoatende_user",
  ];

  for (const key of preferredKeys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const found = findTokenInObject(parsed);
      if (found) return found;
    } catch {
      if (raw.startsWith("eyJ")) return raw;
    }
  }

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;

    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const found = findTokenInObject(parsed);
      if (found) return found;
    } catch {
      if (raw.startsWith("eyJ")) return raw;
    }
  }

  return "";
}

function normalizeSummary(summary, leads) {
  const safe = summary && typeof summary === "object" ? summary : {};
  return {
    total: Number(safe.total ?? leads.length ?? 0),
    new: Number(safe.new ?? 0),
    contacted: Number(safe.contacted ?? 0),
    qualified: Number(safe.qualified ?? 0),
    discarded: Number(safe.discarded ?? 0),
  };
}

export default function AdminPublicLeadsPage() {
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState({ total: 0, new: 0, contacted: 0, qualified: 0, discarded: 0 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusUpdateError, setStatusUpdateError] = useState("");
  const [savingStatusId, setSavingStatusId] = useState("");
  const [copiedAction, setCopiedAction] = useState("");

  const filteredLabel = useMemo(() => {
    if (!status) return "Todos";
    return statusLabels[status] || status;
  }, [status]);

  const loadLeads = useCallback(async () => {
    const token = readAuthToken();

    if (!token) {
      setLoading(false);
      setError("Sessão não encontrada. Faça login novamente para ver os leads.");
      return;
    }

    setLoading(true);
    setError("");
    setStatusUpdateError("");

    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);

      const response = await fetch(`/api/admin/public-leads?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.ok === false) {
        const message =
          response.status === 401 || response.status === 403
            ? "Seu usuário não tem permissão para acessar os leads."
            : "Não foi possível carregar os leads agora.";
        setError(message);
        setLeads([]);
        setSummary({ total: 0, new: 0, contacted: 0, qualified: 0, discarded: 0 });
        return;
      }

      const nextLeads = Array.isArray(payload.leads) ? payload.leads : [];
      setLeads(nextLeads);
      setSummary(normalizeSummary(payload.summary, nextLeads));
    } catch {
      setError("Falha de conexão ao carregar leads.");
      setLeads([]);
      setSummary({ total: 0, new: 0, contacted: 0, qualified: 0, discarded: 0 });
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  const handleLeadStatusChange = useCallback(async (lead, nextStatus) => {
    if (!lead?.id || !nextStatus || nextStatus === lead.status) return;

    const token = readAuthToken();

    if (!token) {
      setStatusUpdateError("Sessão não encontrada. Faça login novamente.");
      return;
    }

    setSavingStatusId(lead.id);
    setStatusUpdateError("");

    try {
      const response = await fetch(`/api/admin/public-leads/${lead.id}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.ok === false) {
        setStatusUpdateError("Não foi possível alterar o status deste lead.");
        return;
      }

      const updatedLead = payload.lead || null;

      setLeads((current) =>
        current.map((item) =>
          item.id === lead.id
            ? {
                ...item,
                ...(updatedLead || {}),
                status: updatedLead?.status || nextStatus,
              }
            : item
        )
      );

      if (payload.summary) {
        setSummary(normalizeSummary(payload.summary, leads));
      } else {
        loadLeads();
      }
    } catch {
      setStatusUpdateError("Falha de conexão ao alterar o status.");
    } finally {
      setSavingStatusId("");
    }
  }, [leads, loadLeads]);

  const handleCopyAction = useCallback(async (key, value) => {
    const ok = await copyToClipboard(value);
    if (!ok) return;

    setCopiedAction(key);
    window.setTimeout(() => {
      setCopiedAction((current) => (current === key ? "" : current));
    }, 1600);
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  return (
    <div className="aa-leads-page" data-aa-page="leads" data-aa-marker={`${R37B_MARKER} ${R38B_MARKER}`}>
      <section className="aa-leads-hero">
        <div>
          <span className="aa-leads-eyebrow">Captação pública</span>
          <h1>Leads</h1>
          <p>Contatos capturados pela landing pública da AutoAtendeAI.</p>
        </div>

        <button type="button" className="aa-leads-refresh" onClick={loadLeads} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </section>

      <section className="aa-leads-summary-grid" aria-label="Resumo de leads">
        <article>
          <span>Total</span>
          <strong>{summary.total}</strong>
        </article>
        <article>
          <span>Novos</span>
          <strong>{summary.new}</strong>
        </article>
        <article>
          <span>Contatados</span>
          <strong>{summary.contacted}</strong>
        </article>
        <article>
          <span>Qualificados</span>
          <strong>{summary.qualified}</strong>
        </article>
      </section>

      <section className="aa-leads-toolbar">
        <label>
          <span>Buscar</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, empresa, WhatsApp ou email"
          />
        </label>

        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <div className="aa-leads-toolbar__meta">
          <span>Filtro</span>
          <strong>{filteredLabel}</strong>
        </div>
      </section>

      {error ? (
        <section className="aa-leads-alert" role="alert">
          {error}
        </section>
      ) : null}

      {statusUpdateError ? (
        <section className="aa-leads-inline-error" role="alert">
          {statusUpdateError}
        </section>
      ) : null}

      <section className="aa-leads-table-card">
        <div className="aa-leads-table-head">
          <div>
            <h2>Leads capturados</h2>
            <p>{loading ? "Carregando contatos..." : `${leads.length} lead(s) na visualização atual.`}</p>
          </div>
        </div>

        {loading ? (
          <div className="aa-leads-empty">Carregando leads...</div>
        ) : leads.length === 0 ? (
          <div className="aa-leads-empty">Nenhum lead capturado ainda.</div>
        ) : (
          <div className="aa-leads-table-scroll">
            <table className="aa-leads-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Nome</th>
                  <th>Empresa</th>
                  <th>WhatsApp</th>
                  <th>Email</th>
                  <th>Mensagem</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const rowSaving = savingStatusId === lead.id;
                  const whatsappDigits = normalizeWhatsAppForLink(lead.whatsapp);
                  const rawWhatsApp = getText(lead.whatsapp);
                  const rawEmail = getText(lead.email);
                  const whatsappCopyKey = `${lead.id}:whatsapp`;
                  const emailCopyKey = `${lead.id}:email`;
                  const isQualified = (lead.status || "new") === "qualified";

                  return (
                    <tr key={lead.id} className={rowSaving ? "aa-leads-row-saving" : ""}>
                      <td>{formatDate(lead.created_at)}</td>
                      <td>
                        <strong>{getText(lead.name) || "—"}</strong>
                      </td>
                      <td>{getText(lead.company_name) || "—"}</td>
                      <td>
                        {rawWhatsApp ? (
                          <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noreferrer">
                            {rawWhatsApp}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{rawEmail || "—"}</td>
                      <td className="aa-leads-message">{getText(lead.message) || "—"}</td>
                      <td>
                        <div className="aa-leads-status-control">
                          <select
                            className={`aa-leads-status-select aa-leads-status-select--${lead.status || "new"}`}
                            value={lead.status || "new"}
                            disabled={rowSaving}
                            onChange={(event) => handleLeadStatusChange(lead, event.target.value)}
                            aria-label="Alterar status do lead"
                          >
                            {statusOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          {rowSaving ? <span>Salvando...</span> : null}
                        </div>
                      </td>
                      <td>
                        <div className="aa-leads-actions" data-qualified={isQualified ? "yes" : "no"}>
                          {whatsappDigits ? (
                            <a
                              className="aa-leads-action aa-leads-action--primary"
                              href={`https://wa.me/${whatsappDigits}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir WhatsApp
                            </a>
                          ) : null}

                          {rawWhatsApp ? (
                            <button
                              type="button"
                              className="aa-leads-action"
                              onClick={() => handleCopyAction(whatsappCopyKey, rawWhatsApp)}
                            >
                              {copiedAction === whatsappCopyKey ? "Copiado" : "Copiar WhatsApp"}
                            </button>
                          ) : null}

                          {rawEmail ? (
                            <button
                              type="button"
                              className="aa-leads-action"
                              onClick={() => handleCopyAction(emailCopyKey, rawEmail)}
                            >
                              {copiedAction === emailCopyKey ? "Copiado" : "Copiar email"}
                            </button>
                          ) : null}

                          {!whatsappDigits && !rawEmail ? (
                            <span className="aa-leads-actions-empty">Sem ação</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
