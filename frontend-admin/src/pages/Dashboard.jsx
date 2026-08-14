import React, { useCallback, useEffect, useMemo, useState } from 'react';

const DASHBOARD_VERSION = '__AUTOATENDE_DASHBOARD_CLEAN_SOURCE_RESET_V19__';
const DIRECT_VERSION = '__AUTOATENDE_DASHBOARD_DIRECT_LINK_SOURCE_V19__';

function readAccessToken() {
  const candidates = [];
  try {
    candidates.push(localStorage.getItem('supabase.auth.token'));
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        candidates.push(localStorage.getItem(key));
      }
    }
  } catch (_) {
    return '';
  }

  for (const raw of candidates.filter(Boolean)) {
    try {
      const parsed = JSON.parse(raw);
      const token =
        parsed?.currentSession?.access_token ||
        parsed?.session?.access_token ||
        parsed?.access_token ||
        parsed?.user?.access_token;
      if (token) return token;
    } catch (_) {
      if (typeof raw === 'string' && raw.split('.').length === 3) return raw;
    }
  }
  return '';
}

async function apiGet(path) {
  const token = readAccessToken();
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(path, {
    method: 'GET',
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${path} -> ${response.status} ${text.slice(0, 180)}`);
  }

  return response.json();
}

function firstValue(source, keys, fallback = 0) {
  for (const key of keys) {
    const value = key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), source);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function toArray(payload) {
  if (Array.isArray(payload)) return payload;
  return (
    payload?.items ||
    payload?.data ||
    payload?.rows ||
    payload?.queue ||
    payload?.followups ||
    payload?.pending ||
    []
  );
}

function getId(row) {
  return (
    row?.conversation_id ||
    row?.conversationId ||
    row?.conversation?.id ||
    row?.conversation?.conversation_id ||
    row?.contact_id ||
    row?.contactId ||
    row?.contact?.id ||
    row?.id ||
    ''
  );
}

function getConversationId(row) {
  return (
    row?.conversation_id ||
    row?.conversationId ||
    row?.conversation?.id ||
    row?.conversation?.conversation_id ||
    ''
  );
}

function getContactId(row) {
  return row?.contact_id || row?.contactId || row?.contact?.id || '';
}

function getName(row) {
  return (
    row?.contact_name ||
    row?.contactName ||
    row?.name ||
    row?.contact?.name ||
    row?.profile_name ||
    row?.pushname ||
    'Contato sem nome'
  );
}

function getPhone(row) {
  return row?.phone || row?.whatsapp || row?.contact_phone || row?.contact?.phone || row?.from || '';
}

function getNote(row) {
  return (
    row?.note ||
    row?.notes ||
    row?.reason ||
    row?.description ||
    row?.followup_note ||
    row?.context ||
    row?.title ||
    'Sem contexto adicional.'
  );
}

function getDueAt(row) {
  return (
    row?.due_at ||
    row?.scheduled_at ||
    row?.followup_at ||
    row?.return_at ||
    row?.next_action_at ||
    row?.remind_at ||
    row?.created_at ||
    null
  );
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function relativeDue(value) {
  const date = parseDate(value);
  if (!date) return 'Sem prazo';
  const diffMs = date.getTime() - Date.now();
  const absMinutes = Math.max(1, Math.round(Math.abs(diffMs) / 60000));
  if (diffMs < 0) {
    if (absMinutes < 60) return `Atrasado há ${absMinutes} min`;
    const hours = Math.round(absMinutes / 60);
    if (hours < 48) return `Atrasado há ${hours} h`;
    return `Atrasado há ${Math.round(hours / 24)} dias`;
  }
  if (absMinutes < 60) return `Em ${absMinutes} min`;
  const hours = Math.round(absMinutes / 60);
  if (hours < 48) return `Em ${hours} h`;
  return `Em ${Math.round(hours / 24)} dias`;
}

function bucketRows(rows) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const sevenDaysEnd = new Date(todayEnd);
  sevenDaysEnd.setDate(sevenDaysEnd.getDate() + 7);

  const buckets = {
    overdue: [],
    today: [],
    week: [],
    later: [],
  };

  for (const row of rows) {
    const due = parseDate(getDueAt(row));
    if (!due) {
      buckets.later.push(row);
    } else if (due < todayStart) {
      buckets.overdue.push(row);
    } else if (due <= todayEnd) {
      buckets.today.push(row);
    } else if (due <= sevenDaysEnd) {
      buckets.week.push(row);
    } else {
      buckets.later.push(row);
    }
  }

  for (const key of Object.keys(buckets)) {
    buckets[key].sort((a, b) => {
      const da = parseDate(getDueAt(a))?.getTime() || 0;
      const db = parseDate(getDueAt(b))?.getTime() || 0;
      return da - db;
    });
  }

  return buckets;
}

function inboxHref(row) {
  const conversationId = getConversationId(row);
  const contactId = getContactId(row);
  const params = new URLSearchParams();
  if (conversationId) params.set('conversation_id', conversationId);
  if (contactId) params.set('contact_id', contactId);
  params.set('source', 'dashboard_followup');
  params.set('open', '1');
  params.set('direct', DIRECT_VERSION);
  return `/inbox?${params.toString()}`;
}

function attendanceHref(row) {
  const conversationId = getConversationId(row);
  const contactId = getContactId(row);
  const params = new URLSearchParams();
  if (conversationId) params.set('conversation_id', conversationId);
  if (contactId) params.set('contact_id', contactId);
  params.set('source', 'dashboard_followup');
  return `/attendance?${params.toString()}`;
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="aa-dash-v19-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}


// __AUTOATENDE_PHASE6B6E_PREMIUM_MODAL_TOAST_V2__:BEGIN
function aa6b6eDashboardEnsureFeedbackStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('aa6b6e-dashboard-feedback-style')) return;

  const style = document.createElement('style');
  style.id = 'aa6b6e-dashboard-feedback-style';
  style.textContent = `
    .aa6b6e-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: radial-gradient(circle at 50% 0%, rgba(31, 213, 140, 0.12), transparent 38%), rgba(0, 8, 6, 0.72);
      backdrop-filter: blur(10px);
    }

    .aa6b6e-modal-card {
      width: min(430px, calc(100vw - 32px));
      border: 1px solid rgba(56, 229, 155, 0.24);
      border-radius: 24px;
      background: linear-gradient(180deg, rgba(5, 32, 24, 0.98), rgba(1, 14, 11, 0.98));
      box-shadow: 0 28px 90px rgba(0, 0, 0, 0.58), 0 0 0 1px rgba(255, 255, 255, 0.025) inset;
      color: #f2fff8;
      overflow: hidden;
      transform: translateY(4px) scale(0.985);
      animation: aa6b6eModalIn 150ms ease forwards;
    }

    .aa6b6e-modal-card::before {
      content: "";
      display: block;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(55, 236, 160, 0.64), transparent);
    }

    .aa6b6e-modal-content {
      padding: 22px;
    }

    .aa6b6e-modal-eyebrow {
      margin: 0 0 8px;
      color: #35e89d;
      font-size: 11px;
      font-weight: 800;
      line-height: 1;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .aa6b6e-modal-title {
      margin: 0;
      color: #f8fffb;
      font-size: 19px;
      font-weight: 800;
      letter-spacing: -0.03em;
    }

    .aa6b6e-modal-message {
      margin: 10px 0 0;
      color: rgba(225, 255, 240, 0.74);
      font-size: 14px;
      font-weight: 500;
      line-height: 1.55;
    }

    .aa6b6e-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 0 22px 22px;
    }

    .aa6b6e-modal-button {
      min-height: 40px;
      border: 1px solid rgba(70, 230, 160, 0.2);
      border-radius: 999px;
      padding: 0 17px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      transition: transform 120ms ease, border-color 120ms ease, background 120ms ease, opacity 120ms ease;
    }

    .aa6b6e-modal-button:hover {
      transform: translateY(-1px);
    }

    .aa6b6e-modal-cancel {
      color: rgba(232, 255, 243, 0.8);
      background: rgba(255, 255, 255, 0.045);
    }

    .aa6b6e-modal-confirm {
      color: #04140d;
      border-color: rgba(67, 244, 164, 0.72);
      background: linear-gradient(180deg, #57f2aa, #21c97d);
      box-shadow: 0 12px 34px rgba(33, 201, 125, 0.22);
    }

    .aa6b6e-toast-stack {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 100000;
      display: grid;
      gap: 10px;
      max-width: min(390px, calc(100vw - 32px));
      pointer-events: none;
    }

    .aa6b6e-toast {
      pointer-events: auto;
      border: 1px solid rgba(69, 230, 157, 0.22);
      border-radius: 18px;
      padding: 13px 15px;
      background: linear-gradient(180deg, rgba(5, 31, 23, 0.98), rgba(1, 15, 11, 0.98));
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.02) inset;
      color: rgba(241, 255, 247, 0.92);
      font-size: 13px;
      font-weight: 700;
      line-height: 1.4;
      animation: aa6b6eToastIn 160ms ease forwards;
    }

    .aa6b6e-toast[data-variant="error"] {
      border-color: rgba(255, 136, 136, 0.34);
      color: #ffecec;
    }

    .aa6b6e-toast[data-variant="success"] {
      border-color: rgba(69, 230, 157, 0.42);
      color: #eafff3;
    }

    @keyframes aa6b6eModalIn {
      to { transform: translateY(0) scale(1); }
    }

    @keyframes aa6b6eToastIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

function aa6b6eDashboardMessage(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || 'Ocorreu um erro inesperado.';
  return String(value);
}

function aa6b6eDashboardToast(message, variant = 'info') {
  if (typeof document === 'undefined') return;
  aa6b6eDashboardEnsureFeedbackStyles();

  let stack = document.getElementById('aa6b6e-dashboard-toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'aa6b6e-dashboard-toast-stack';
    stack.className = 'aa6b6e-toast-stack';
    document.body.appendChild(stack);
  }

  const toast = document.createElement('div');
  toast.className = 'aa6b6e-toast';
  toast.dataset.variant = variant;
  toast.textContent = aa6b6eDashboardMessage(message);
  stack.appendChild(toast);

  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    toast.style.transition = 'opacity 160ms ease, transform 160ms ease';
    window.setTimeout(() => {
      toast.remove();
      if (stack && stack.children.length === 0) stack.remove();
    }, 180);
  }, variant === 'error' ? 4200 : 2600);
}

function aa6b6eDashboardConfirm(options = {}) {
  if (typeof document === 'undefined') return Promise.resolve(false);
  aa6b6eDashboardEnsureFeedbackStyles();

  const title = options.title || 'Confirmar ação';
  const message = options.message || 'Deseja continuar?';
  const confirmLabel = options.confirmLabel || 'Confirmar';
  const cancelLabel = options.cancelLabel || 'Cancelar';

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'aa6b6e-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');

    const card = document.createElement('div');
    card.className = 'aa6b6e-modal-card';

    const content = document.createElement('div');
    content.className = 'aa6b6e-modal-content';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'aa6b6e-modal-eyebrow';
    eyebrow.textContent = 'AutoAtendeAI';

    const heading = document.createElement('h2');
    heading.className = 'aa6b6e-modal-title';
    heading.textContent = title;

    const copy = document.createElement('p');
    copy.className = 'aa6b6e-modal-message';
    copy.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'aa6b6e-modal-actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'aa6b6e-modal-button aa6b6e-modal-cancel';
    cancel.textContent = cancelLabel;

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'aa6b6e-modal-button aa6b6e-modal-confirm';
    confirm.textContent = confirmLabel;

    let settled = false;

    const close = (value) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeyDown);
      backdrop.style.opacity = '0';
      backdrop.style.transition = 'opacity 140ms ease';
      window.setTimeout(() => backdrop.remove(), 150);
      resolve(value);
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') close(false);
      if (event.key === 'Enter') close(true);
    };

    cancel.addEventListener('click', () => close(false));
    confirm.addEventListener('click', () => close(true));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close(false);
    });
    document.addEventListener('keydown', onKeyDown);

    content.appendChild(eyebrow);
    content.appendChild(heading);
    content.appendChild(copy);
    actions.appendChild(cancel);
    actions.appendChild(confirm);
    card.appendChild(content);
    card.appendChild(actions);
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    window.setTimeout(() => confirm.focus(), 40);
  });
}
// __AUTOATENDE_PHASE6B6E_PREMIUM_MODAL_TOAST_V2__:END


function FollowupCard({ row }) {
  return (
    <article className="aa-dash-v19-followup-card" data-contact-id={getContactId(row)} data-conversation-id={getConversationId(row)}>
      <div>
        <h4>{getName(row)}</h4>
        <p>{getPhone(row) || 'Telefone não informado'}</p>
      </div>
      <p className="aa-dash-v19-note">{getNote(row)}</p>
      <div className="aa-dash-v19-date-row">
        <strong>{formatDateTime(getDueAt(row))}</strong>
        <span>{relativeDue(getDueAt(row))}</span>
      </div>
      <div className="aa-dash-v19-actions">
        <a href={inboxHref(row)} aria-label={`Abrir Inbox de ${getName(row)}`}>Abrir Inbox</a>
        <a href={attendanceHref(row)} aria-label={`Abrir Atendimento de ${getName(row)}`}>Atendimento</a>
      </div>
    
      {aa6b6bCanCompleteDashboardFollowup(row) ? (
        <div className="aa-dash-v19-followup-complete-row">
          <button
            type="button"
            className="aa-dash-v19-followup-complete"
            onClick={(event) => aa6b6bCompleteFollowupFromDashboard(row, event)}
            title="Marcar este retorno como concluido"
          >
            Concluir
          </button>
        </div>
      ) : null}

</article>
  );
}

function BucketColumn({ title, description, rows }) {
  const visibleRows = rows.slice(0, 12);
  return (
    <section className="aa-dash-v19-bucket">
      <header>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span>{rows.length}</span>
      </header>
      <div className="aa-dash-v19-bucket-scroll">
        {visibleRows.length ? (
          visibleRows.map((row, index) => <FollowupCard key={`${getId(row)}-${index}`} row={row} />)
        ) : (
          <div className="aa-dash-v19-empty">Nenhum retorno nesta faixa.</div>
        )}
      </div>
    </section>
  );
}

function QuickAction({ href, label, text }) {
  return (
    <a className="aa-dash-v19-quick" href={href}>
      <strong>{label}</strong>
      <span>{text}</span>
    </a>
  );
}


/* __AUTOATENDE_PHASE6B6B_DASHBOARD_COMPLETE_FOLLOWUP_V4__:BEGIN */
function aa6b6bGetFollowupConversationId(row) {
  const value =
    row?.conversation_id ||
    row?.conversationId ||
    row?.conversation?.id ||
    row?.conversation_uuid ||
    row?.conversationUuid ||
    '';

  return value ? String(value) : '';
}

function aa6b6bCanCompleteDashboardFollowup(row) {
  if (!row) return false;

  const conversationId = aa6b6bGetFollowupConversationId(row);
  if (!conversationId) return false;

  const status = String(row?.status || 'pending').toLowerCase();
  if (status && status !== 'pending' && status !== 'open' && status !== 'scheduled') return false;

  if (row?.completed_at || row?.completedAt || row?.done_at || row?.doneAt) return false;

  return true;
}

/* __AUTOATENDE_PHASE6B6C_COMPLETE_AUTH_UNIFY_V1__:BEGIN */
function aa6b6bFindAccessToken() {
  return readAccessToken() || '';
}
/* __AUTOATENDE_PHASE6B6C_COMPLETE_AUTH_UNIFY_V1__:END */

async function aa6b6bReadResponseMessage(response) {
  try {
    const payload = await response.json();
    return payload?.message || payload?.error || payload?.code || '';
  } catch {
    return '';
  }
}

async function aa6b6bCompleteFollowupFromDashboard(row, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  const conversationId = aa6b6bGetFollowupConversationId(row);

  if (!conversationId) {
    aa6b6eDashboardToast('Nao foi possivel identificar a conversa deste retorno.', 'error');
    return;
  }

  const contactLabel =
    row?.contact_name ||
    row?.contactName ||
    row?.name ||
    row?.phone ||
    'este contato';

  const confirmed = (await aa6b6eDashboardConfirm({
    title: 'Concluir retorno',
    message: 'Concluir o retorno deste contato?',
    confirmLabel: 'Concluir',
    cancelLabel: 'Cancelar',
  }));
  if (!confirmed) return;

  const accessToken = aa6b6bFindAccessToken();

  if (!accessToken) {
    aa6b6eDashboardToast('Sessao nao encontrada. Entre novamente e tente concluir o retorno.', 'success');
    return;
  }

  const button = event?.currentTarget;

  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Concluindo...';
    }

    const response = await fetch(
      `/api/inbox/conversations/${encodeURIComponent(conversationId)}/followup/complete`,
      {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'dashboard_followup_queue',
        }),
      }
    );

    if (!response.ok) {
      const message = await aa6b6bReadResponseMessage(response);
      throw new Error(message || `Nao foi possivel concluir o retorno (${response.status}).`);
    }

    window.setTimeout(() => {
      window.location.reload();
    }, 220);
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = 'Concluir';
    }

    aa6b6eDashboardToast(error?.message || 'Nao foi possivel concluir o retorno agora.', 'success');
  }
}
/* __AUTOATENDE_PHASE6B6B_DASHBOARD_COMPLETE_FOLLOWUP_V4__:END */

export default function Dashboard() {
  const [queuePayload, setQueuePayload] = useState(null);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('loading');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const [queueResult, summaryResult] = await Promise.allSettled([
        apiGet('/api/inbox/followups/queue?limit=160'),
        apiGet('/api/dashboard/summary'),
      ]);

      if (queueResult.status === 'fulfilled') {
        setQueuePayload(queueResult.value);
      } else {
        throw queueResult.reason;
      }

      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value);
      }

      setUpdatedAt(new Date());
      setStatus('ready');
    } catch (err) {
      setError(err?.message || 'Não foi possível carregar os dados do dashboard.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const timer = window.setInterval(loadDashboard, 60000);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  const rows = useMemo(() => toArray(queuePayload), [queuePayload]);
  const buckets = useMemo(() => bucketRows(rows), [rows]);

  const queueSummary = queuePayload?.summary || queuePayload?.totals || {};
  const totalPending = firstValue(queueSummary, ['total_pending', 'totalPending', 'pending', 'total'], rows.length);
  const overdueTotal = firstValue(queueSummary, ['overdue', 'late', 'atrasados'], buckets.overdue.length);
  const todayTotal = firstValue(queueSummary, ['today', 'due_today', 'hoje'], buckets.today.length);
  const weekTotal = firstValue(queueSummary, ['week', 'next_7_days', 'next7Days', 'seven_days'], buckets.week.length);

  // __AUTOATENDE_PHASE6B5D_DASHBOARD_CONSUME_QUEUE_SUMMARY_FIX1__
  const dashboardSummary = {
    ...(summary && typeof summary === 'object' ? summary : {}),
    ...(queueSummary && typeof queueSummary === 'object' ? queueSummary : {}),
    ...(queuePayload?.summary && typeof queuePayload.summary === 'object' ? queuePayload.summary : {}),
    ...(queuePayload?.daily_summary && typeof queuePayload.daily_summary === 'object' ? queuePayload.daily_summary : {}),
    ...(queuePayload?.dailySummary && typeof queuePayload.dailySummary === 'object' ? queuePayload.dailySummary : {}),
  };

  const conversationsToday = firstValue(dashboardSummary, ['conversations_today', 'conversationsToday', 'today.conversations', 'conversations.today'], 0);
  const botToday = firstValue(dashboardSummary, ['bot_responses_today', 'botResponsesToday', 'today.bot_responses', 'bot.today'], 0);
  const humanToday = firstValue(dashboardSummary, ['human_today', 'humanToday', 'human_interactions_today', 'currentHumanConversations', 'current_human_conversations', 'today.human', 'human.today'], 0);
  const sendsToday = firstValue(dashboardSummary, ['templates_today', 'templateSendsToday', 'template_sends_today', 'dispatches_today', 'today.dispatches'], 0);

  const updatedLabel = updatedAt
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(updatedAt)
    : 'Aguardando leitura';

  return (
    <div className="aa-dashboard-clean-v19" data-aa-dashboard-version={DASHBOARD_VERSION}>
      <header className="aa-dash-v19-header">
        <div>
          <span>Dashboard</span>
          <h1>Operação do dia</h1>
          <p>Retornos, conversas e ações essenciais em uma visão limpa para conduzir a equipe.</p>
        </div>
        <button type="button" onClick={loadDashboard} disabled={status === 'loading'}>
          {status === 'loading' ? 'Atualizando...' : 'Atualizar'}
        </button>
      </header>

      <section className="aa-dash-v19-queue" aria-label="Retornos programados">
        <header className="aa-dash-v19-section-head">
          <div>
            <span>Retornos programados</span>
            <h2>Fila operacional da equipe</h2>
            <p>Contatos atrasados, de hoje e dos próximos dias sem abrir conversa por conversa.</p>
          </div>
          <small>Atualizado em {updatedLabel}</small>
        </header>

        {error ? <div className="aa-dash-v19-alert">{error}</div> : null}

        <div className="aa-dash-v19-metrics aa-dash-v19-queue-metrics">
          <MetricCard label="Total pendente" value={totalPending} />
          <MetricCard label="Atrasados" value={overdueTotal} />
          <MetricCard label="Hoje" value={todayTotal} />
          <MetricCard label="7 dias" value={weekTotal} />
        </div>

        <div className="aa-dash-v19-buckets">
          <BucketColumn title="Atrasados" description="Prioridade imediata." rows={buckets.overdue} />
          <BucketColumn title="Hoje" description="Exigem ação ainda hoje." rows={buckets.today} />
          <BucketColumn title="Próximos 7 dias" description="Agenda curta comercial." rows={buckets.week} />
          <BucketColumn title="Mais tarde" description="Retornos futuros." rows={buckets.later} />
        </div>
      </section>

      <section className="aa-dash-v19-grid-two">
        <div className="aa-dash-v19-panel">
          <header className="aa-dash-v19-section-head compact">
            <div>
              <span>Leitura rápida</span>
              <h2>Indicadores do dia</h2>
              <p>Valores operacionais lidos da API quando disponíveis.</p>
            </div>
          </header>
          <div className="aa-dash-v19-metrics">
            <MetricCard label="Conversas hoje" value={conversationsToday} hint="entradas do dia" />
            <MetricCard label="Respostas do bot" value={botToday} hint="automação" />
            <MetricCard label="Atendimento humano" value={humanToday} hint="assumidas" />
            <MetricCard label="Disparos hoje" value={sendsToday} hint="envios" />
          </div>
        </div>

        <div className="aa-dash-v19-panel aa-dash-v19-actions-panel">
          <header className="aa-dash-v19-section-head compact">
            <div>
              <span>Acesso rápido</span>
              <h2>Próxima ação</h2>
              <p>Atalhos para os módulos realmente usados na operação.</p>
            </div>
          </header>
          <div className="aa-dash-v19-quick-grid">
            <QuickAction href="/inbox" label="Inbox" text="Conversas e contexto" />
            <QuickAction href="/attendance" label="Atendimento" text="Fila humana" />
            <QuickAction href="/disparos" label="Disparos" text="Templates e lotes" />
            <QuickAction href="/leads" label="Leads" text="Entrada comercial" />
          </div>
        </div>
      </section>
    </div>
  );
}
