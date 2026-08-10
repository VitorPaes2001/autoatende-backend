import React, { useCallback, useEffect, useMemo, useState } from 'react';

const STATUS_OPTIONS = [
  ['pending', 'Pendente'],
  ['contacted', 'Contatado'],
  ['in_progress', 'Em implantação'],
  ['configured', 'Configurado'],
  ['done', 'Concluído'],
  ['canceled', 'Cancelado'],
];

const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS);

function findTokenInObject(value, depth = 0) {
  if (!value || depth > 5) return '';

  if (typeof value === 'string') {
    return value.length > 20 ? value : '';
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTokenInObject(item, depth + 1);
      if (found) return found;
    }
    return '';
  }

  if (typeof value !== 'object') return '';

  const preferredKeys = [
    'access_token',
    'accessToken',
    'token',
    'jwt',
    'id_token',
    'idToken',
  ];

  for (const key of preferredKeys) {
    const found = findTokenInObject(value[key], depth + 1);
    if (found) return found;
  }

  for (const key of Object.keys(value)) {
    const nested = value[key];

    if (
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('session') ||
      key.toLowerCase().includes('auth') ||
      key.toLowerCase().includes('user')
    ) {
      const found = findTokenInObject(nested, depth + 1);
      if (found) return found;
    }
  }

  return '';
}

function getToken() {
  if (typeof window === 'undefined') return '';

  const globalToken =
    findTokenInObject(window.__AUTOATENDE_AUTH__) ||
    findTokenInObject(window.__AUTOATENDE_SESSION__) ||
    findTokenInObject(window.__AUTOATENDE_USER__);

  if (globalToken) return globalToken;

  const preferredKeys = [
    'auth_user',
    'autoatende_user',
    'sb-auth-token',
    'supabase.auth.token',
    'auth',
    'user',
    'session',
    'autoatende_auth',
    'token',
    'authToken',
    'accessToken',
    'access_token',
    'jwt',
    'aa_token',
  ];

  const storages = [window.localStorage, window.sessionStorage].filter(Boolean);

  for (const storage of storages) {
    for (const key of preferredKeys) {
      const raw = storage.getItem(key);
      if (!raw) continue;

      if (raw.length > 20 && !raw.trim().startsWith('{') && !raw.trim().startsWith('[')) {
        return raw.replace(/^"|"$/g, '');
      }

      try {
        const parsed = JSON.parse(raw);
        const found = findTokenInObject(parsed);
        if (found) return found;
      } catch (_) {}
    }
  }

  for (const storage of storages) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) continue;

      const raw = storage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        const found = findTokenInObject(parsed);
        if (found) return found;
      } catch (_) {
        if (
          key.toLowerCase().includes('token') &&
          raw.length > 20
        ) {
          return raw.replace(/^"|"$/g, '');
        }
      }
    }
  }

  return '';
}

function headers() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function money(cents, currency = 'brl') {
  const value = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: String(currency || 'brl').toUpperCase(),
    }).format(value);
  } catch (_) {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  }
}

function date(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch (_) {
    return '—';
  }
}

export default function AdminProvisioningQueuePage() {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({});
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (status !== 'all') params.set('status', status);
    if (q.trim()) params.set('q', q.trim());
    return params.toString();
  }, [status, q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/provisioning/queue?${query}`, {
        headers: headers(),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || (res.status === 401 ? 'Sessão não reconhecida. Atualize a página ou entre novamente.' : `Erro ${res.status} ao carregar fila`));
      }

      const nextRows = Array.isArray(json?.rows) ? json.rows : [];
      setRows(nextRows);
      setStats(json?.stats || {});
    } catch (err) {
      setError(err?.message || 'Não foi possível carregar a fila de implantação.');
      setRows([]);
      setStats({});
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  async function update(row, patch) {
    if (!row?.id) return;

    setSavingId(row.id);
    setError('');

    try {
      const res = await fetch(`/api/admin/provisioning/queue/${row.id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify(patch),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || (res.status === 401 ? 'Sessão não reconhecida. Atualize a página ou entre novamente.' : `Erro ${res.status} ao salvar`));
      }

      await load();
    } catch (err) {
      setError(err?.message || 'Não foi possível salvar a implantação.');
    } finally {
      setSavingId('');
    }
  }

  return (
    <div className="aa-provisioning-page">
      <style>{`
        .aa-provisioning-page {
          min-height: calc(100vh - 64px);
          padding: 28px;
          color: #eafff7;
          background: radial-gradient(circle at 15% 0%, rgba(35,191,124,.12), transparent 30%), #020b09;
        }
        .aa-provisioning-head {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          margin-bottom: 22px;
        }
        .aa-provisioning-kicker {
          color: #6ee7b7;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .aa-provisioning-title {
          margin: 0;
          color: #fff;
          font-size: clamp(28px, 3vw, 42px);
          letter-spacing: -.04em;
          line-height: 1.05;
        }
        .aa-provisioning-subtitle {
          color: rgba(218,255,241,.72);
          margin: 10px 0 0;
          max-width: 760px;
          line-height: 1.55;
        }
        .aa-provisioning-button {
          border: 1px solid rgba(110,231,183,.35);
          background: rgba(16,185,129,.16);
          color: #ecfff7;
          border-radius: 12px;
          padding: 11px 14px;
          font-weight: 900;
          cursor: pointer;
        }
        .aa-provisioning-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .aa-provisioning-stat,
        .aa-provisioning-card,
        .aa-provisioning-toolbar,
        .aa-provisioning-empty {
          border: 1px solid rgba(35,191,124,.17);
          background: linear-gradient(145deg, rgba(5,31,26,.94), rgba(2,15,13,.98));
          border-radius: 18px;
          box-shadow: 0 18px 54px rgba(0,0,0,.22);
        }
        .aa-provisioning-stat { padding: 16px; }
        .aa-provisioning-stat span {
          display: block;
          color: rgba(218,255,241,.62);
          font-size: 12px;
          margin-bottom: 7px;
        }
        .aa-provisioning-stat strong {
          color: #fff;
          font-size: 26px;
        }
        .aa-provisioning-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          padding: 14px;
          margin-bottom: 16px;
        }
        .aa-provisioning-toolbar input,
        .aa-provisioning-toolbar select,
        .aa-provisioning-card select,
        .aa-provisioning-card textarea {
          border: 1px solid rgba(35,191,124,.22);
          background: rgba(1,15,12,.96);
          color: #f8fffc;
          border-radius: 12px;
          outline: none;
        }
        .aa-provisioning-toolbar input {
          flex: 1 1 280px;
          min-height: 42px;
          padding: 0 13px;
        }
        .aa-provisioning-toolbar select,
        .aa-provisioning-card select {
          min-height: 42px;
          padding: 0 12px;
        }
        .aa-provisioning-grid {
          display: grid;
          gap: 14px;
        }
        .aa-provisioning-card {
          padding: 18px;
        }
        .aa-provisioning-card-top {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 14px;
        }
        .aa-provisioning-company {
          margin: 0;
          font-size: 18px;
          font-weight: 900;
          color: #fff;
        }
        .aa-provisioning-meta {
          color: rgba(218,255,241,.67);
          margin: 5px 0 0;
          font-size: 13px;
        }
        .aa-provisioning-badge {
          align-self: flex-start;
          border: 1px solid rgba(110,231,183,.28);
          background: rgba(16,185,129,.12);
          color: #a7f3d0;
          border-radius: 999px;
          padding: 7px 11px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }
        .aa-provisioning-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
          margin: 14px 0;
        }
        .aa-provisioning-detail {
          border: 1px solid rgba(255,255,255,.06);
          background: rgba(0,0,0,.18);
          border-radius: 13px;
          padding: 12px;
        }
        .aa-provisioning-detail span {
          display: block;
          color: rgba(218,255,241,.55);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .07em;
          margin-bottom: 5px;
        }
        .aa-provisioning-detail strong {
          color: #f8fffc;
          font-size: 13px;
          word-break: break-word;
        }
        .aa-provisioning-actions {
          display: grid;
          grid-template-columns: minmax(180px, 240px) 1fr auto;
          gap: 10px;
          align-items: stretch;
        }
        .aa-provisioning-card textarea {
          min-height: 42px;
          padding: 11px 12px;
          resize: vertical;
          font-family: inherit;
        }
        .aa-provisioning-empty {
          padding: 18px;
          color: rgba(218,255,241,.76);
        }
        .aa-provisioning-error {
          border: 1px solid rgba(248,113,113,.34);
          color: #fecaca;
          background: rgba(69,10,10,.25);
          border-radius: 14px;
          padding: 14px;
          margin-bottom: 14px;
        }
        @media (max-width: 780px) {
          .aa-provisioning-page { padding: 18px; }
          .aa-provisioning-head,
          .aa-provisioning-card-top { flex-direction: column; }
          .aa-provisioning-actions { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="aa-provisioning-head">
        <div>
          <div className="aa-provisioning-kicker">Implantação</div>
          <h1 className="aa-provisioning-title">Fila de provisionamento</h1>
          <p className="aa-provisioning-subtitle">
            Acompanhe contratações pagas que precisam de configuração inicial, onboarding e liberação operacional.
          </p>
        </div>

        <button className="aa-provisioning-button" type="button" onClick={load}>
          Atualizar
        </button>
      </div>

      <div className="aa-provisioning-stats">
        <div className="aa-provisioning-stat"><span>Total</span><strong>{stats.total ?? rows.length}</strong></div>
        <div className="aa-provisioning-stat"><span>Pendentes</span><strong>{stats.pending ?? 0}</strong></div>
        <div className="aa-provisioning-stat"><span>Em implantação</span><strong>{stats.in_progress ?? 0}</strong></div>
        <div className="aa-provisioning-stat"><span>Concluídos</span><strong>{stats.done ?? 0}</strong></div>
      </div>

      <div className="aa-provisioning-toolbar">
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar por empresa, e-mail, assinatura ou checkout" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Todos os status</option>
          {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {error ? <div className="aa-provisioning-error">{error}</div> : null}

      {loading ? (
        <div className="aa-provisioning-empty">Carregando fila de implantação...</div>
      ) : rows.length === 0 ? (
        <div className="aa-provisioning-empty">Nenhuma contratação encontrada para os filtros atuais.</div>
      ) : (
        <div className="aa-provisioning-grid">
          {rows.map((row) => {
            const statusId = `status-${row.id}`;
            const notesId = `notes-${row.id}`;

            return (
              <div className="aa-provisioning-card" key={row.id || row.checkout_session_id}>
                <div className="aa-provisioning-card-top">
                  <div>
                    <h2 className="aa-provisioning-company">{row.company_name || row.customer_name || 'Empresa sem nome'}</h2>
                    <p className="aa-provisioning-meta">
                      {row.customer_email || 'E-mail não informado'}{row.customer_phone ? ` · ${row.customer_phone}` : ''}
                    </p>
                  </div>
                  <span className="aa-provisioning-badge">{STATUS_LABELS[row.status] || row.status || '—'}</span>
                </div>

                <div className="aa-provisioning-details">
                  <div className="aa-provisioning-detail"><span>Plano</span><strong>{row.plan_name || row.plan_key || '—'}</strong></div>
                  <div className="aa-provisioning-detail"><span>Valor pago</span><strong>{money(row.amount_total, row.currency)}</strong></div>
                  <div className="aa-provisioning-detail"><span>Pagamento</span><strong>{row.payment_status || '—'}</strong></div>
                  <div className="aa-provisioning-detail"><span>Assinatura</span><strong>{row.subscription_status || '—'}</strong></div>
                  <div className="aa-provisioning-detail"><span>Criado em</span><strong>{date(row.created_at)}</strong></div>
                  <div className="aa-provisioning-detail"><span>Checkout</span><strong>{row.checkout_session_id || '—'}</strong></div>
                </div>

                <div className="aa-provisioning-actions">
                  <select id={statusId} defaultValue={row.status || 'pending'} disabled={savingId === row.id}>
                    {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>

                  <textarea id={notesId} defaultValue={row.notes || ''} placeholder="Observações internas da implantação" disabled={savingId === row.id} />

                  <button
                    className="aa-provisioning-button"
                    type="button"
                    disabled={savingId === row.id}
                    onClick={() => {
                      update(row, {
                        status: document.getElementById(statusId)?.value || row.status,
                        notes: document.getElementById(notesId)?.value || '',
                      });
                    }}
                  >
                    {savingId === row.id ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
