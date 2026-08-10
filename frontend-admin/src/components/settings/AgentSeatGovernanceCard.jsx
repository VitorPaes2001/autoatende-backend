import React from 'react';

const PLAN_ENDPOINT_TEMPLATES = [
  '/api/company/current/plan',
  '/api/company/plan',
  '/api/companies/current/plan',
  '/api/companies/plan',
  '/api/company/:companyId/plan',
  '/api/companies/:companyId/plan',
  '/api/billing/status',
];

const BILLING_PORTAL_ENDPOINT = '/api/billing/portal';

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function firstString(values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function tryGet(obj, path) {
  try {
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  } catch {
    return undefined;
  }
}

function resolveAccessToken() {
  const supabaseToken = safeJsonParse(window.localStorage.getItem('supabase.auth.token'));
  const authUser = safeJsonParse(window.localStorage.getItem('auth_user'));
  const autoUser = safeJsonParse(window.localStorage.getItem('autoatende_user'));

  return firstString([
    tryGet(window, '__AUTOATENDE_SESSION__.access_token'),
    tryGet(window, '__AUTOATENDE_AUTH__.session.access_token'),
    tryGet(authUser, 'session.access_token'),
    tryGet(autoUser, 'session.access_token'),
    tryGet(supabaseToken, 'currentSession.access_token'),
    tryGet(supabaseToken, 'access_token'),
    tryGet(supabaseToken, 'data.session.access_token')
  ]);
}

function resolveCompanyId() {
  const authUser = safeJsonParse(window.localStorage.getItem('auth_user'));
  const autoUser = safeJsonParse(window.localStorage.getItem('autoatende_user'));

  return firstString([
    tryGet(window, '__AUTOATENDE_AUTH__.companyId'),
    tryGet(window, '__AUTOATENDE_AUTH__.currentCompanyId'),
    tryGet(window, '__AUTOATENDE_USER__.companyId'),
    tryGet(authUser, 'companyId'),
    tryGet(autoUser, 'companyId'),
    window.localStorage.getItem('current_company_id') || '',
    window.localStorage.getItem('company_id') || ''
  ]);
}

function buildHeaders(withJson = false) {
  const headers = { Accept: 'application/json' };
  const token = resolveAccessToken();
  const companyId = resolveCompanyId();

  if (withJson) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (companyId) headers['x-company-id'] = companyId;

  return headers;
}

function materializeTemplate(template, companyId) {
  if (!template) return '';
  return template.replace(':companyId', companyId || '');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers || buildHeaders(),
    body: options.body,
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

function normalizePlanString(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function planLimitFromText(value) {
  const text = normalizePlanString(value);
  if (!text) return null;
  if (text.includes('essencial') || text.includes('essential')) return 1;
  if (text.includes('profissional') || text.includes('professional')) return 4;
  if (text.includes('business')) return 8;
  return null;
}

function findNumberDeep(obj, maxDepth = 4) {
  const KEYS = ['agentLimit', 'maxAgents', 'agentsIncluded', 'includedAgents', 'max_agents', 'agent_limit'];
  const visited = new Set();

  function inner(value, depth) {
    if (depth > maxDepth || value == null || typeof value !== 'object') return null;
    if (visited.has(value)) return null;
    visited.add(value);

    for (const key of Object.keys(value)) {
      const raw = value[key];
      if (KEYS.includes(key) && typeof raw === 'number' && Number.isFinite(raw)) {
        return raw;
      }
    }

    for (const key of Object.keys(value)) {
      const raw = value[key];
      if (raw && typeof raw === 'object') {
        const found = inner(raw, depth + 1);
        if (typeof found === 'number') return found;
      }
    }

    return null;
  }

  return inner(obj, 0);
}

function findPlanTextDeep(obj, maxDepth = 4) {
  const KEYS = [
    'plan', 'planName', 'planKey', 'activePlan', 'currentPlan',
    'commercialPlan', 'commercialPlanKey', 'subscriptionPlan'
  ];
  const visited = new Set();

  function inner(value, depth) {
    if (depth > maxDepth || value == null || typeof value !== 'object') return '';
    if (visited.has(value)) return '';
    visited.add(value);

    for (const key of Object.keys(value)) {
      const raw = value[key];
      if (KEYS.includes(key) && typeof raw === 'string' && raw.trim()) {
        return raw.trim();
      }
    }

    for (const key of Object.keys(value)) {
      const raw = value[key];
      if (raw && typeof raw === 'object') {
        const found = inner(raw, depth + 1);
        if (found) return found;
      }
    }

    return '';
  }

  return inner(obj, 0);
}

function prettyPlanLabel(rawPlan) {
  const normalized = normalizePlanString(rawPlan);
  if (!normalized) return 'Plano não identificado';
  if (normalized.includes('essencial') || normalized.includes('essential')) return 'Essencial';
  if (normalized.includes('profissional') || normalized.includes('professional')) return 'Profissional';
  if (normalized.includes('business')) return 'Business';
  return rawPlan;
}

function statusMeta(used, limit) {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
    return {
      tone: 'neutral',
      label: 'Limite não identificado',
      helper: 'O plano ativo não foi identificado com segurança nesta fase.',
      shouldUpgrade: false,
      isAtLimit: false,
      isNearLimit: false,
    };
  }

  if (used >= limit) {
    return {
      tone: 'danger',
      label: 'Limite atingido',
      helper: 'Seu plano já atingiu o limite de agentes incluídos. O próximo passo correto é upgrade antes de adicionar novos usuários internos.',
      shouldUpgrade: true,
      isAtLimit: true,
      isNearLimit: false,
    };
  }

  if (used === limit - 1) {
    return {
      tone: 'warning',
      label: 'Último seat disponível',
      helper: 'A capacidade está quase no limite do plano atual. Vale preparar o upgrade antes de consumir o último seat.',
      shouldUpgrade: true,
      isAtLimit: false,
      isNearLimit: true,
    };
  }

  return {
    tone: 'success',
    label: 'Capacidade disponível',
    helper: 'Ainda existem seats disponíveis no plano atual.',
    shouldUpgrade: false,
    isAtLimit: false,
    isNearLimit: false,
  };
}

function pillClass(tone) {
  if (tone === 'success') return 'aa-product-pill-success';
  return 'aa-product-pill-neutral';
}

function resolvePortalUrl(payload) {
  const raw = payload?.data || payload || {};
  return firstString([
    raw.url,
    raw.portalUrl,
    raw.sessionUrl,
    raw.redirectUrl,
    raw.billingPortalUrl,
  ]);
}

function resolveErrorMessage(payload, fallback) {
  const raw = payload?.error || payload?.data || payload || {};
  return firstString([
    raw.message,
    payload?.message,
    fallback,
  ]) || fallback;
}

export default function AgentSeatGovernanceCard({
  agents = [],
  canManageAgents = false,
  onSeatStatusChange,
}) {
  const [state, setState] = React.useState({
    loading: true,
    rawPlan: '',
    limit: null,
    source: '',
  });
  const [portalBusy, setPortalBusy] = React.useState(false);
  const [portalError, setPortalError] = React.useState('');

  React.useEffect(() => {
    let isMounted = true;

    async function loadPlan() {
      if (!canManageAgents) {
        if (isMounted) {
          setState({
            loading: false,
            rawPlan: '',
            limit: null,
            source: '',
          });
        }
        return;
      }

      const companyId = resolveCompanyId();

      for (const template of PLAN_ENDPOINT_TEMPLATES) {
        const url = materializeTemplate(template, companyId);
        if (!url || url.includes(':companyId')) continue;

        try {
          const result = await fetchJson(url, { headers: buildHeaders() });
          if (!result.ok) continue;

          const payload = result.payload?.data || result.payload || {};
          const explicitLimit = findNumberDeep(payload);
          const rawPlan = findPlanTextDeep(payload);
          const derivedLimit = explicitLimit ?? planLimitFromText(rawPlan);

          if (explicitLimit || rawPlan || derivedLimit) {
            if (isMounted) {
              setState({
                loading: false,
                rawPlan: rawPlan || '',
                limit: typeof derivedLimit === 'number' ? derivedLimit : null,
                source: url,
              });
            }
            return;
          }
        } catch (_error) {
          // segue tentando candidatos
        }
      }

      if (isMounted) {
        setState({
          loading: false,
          rawPlan: '',
          limit: null,
          source: '',
        });
      }
    }

    loadPlan();

    return () => {
      isMounted = false;
    };
  }, [canManageAgents, Array.isArray(agents) ? agents.length : 0]);

  const used = Array.isArray(agents) ? agents.length : 0;
  const limit = typeof state.limit === 'number' ? state.limit : null;
  const remaining = typeof limit === 'number' ? Math.max(limit - used, 0) : null;
  const planLabel = prettyPlanLabel(state.rawPlan);
  const status = statusMeta(used, limit);

  React.useEffect(() => {
    if (typeof onSeatStatusChange !== 'function') return;

    onSeatStatusChange({
      loading: state.loading,
      rawPlan: state.rawPlan,
      planLabel,
      limit,
      used,
      remaining,
      isAtLimit: status.isAtLimit,
      isNearLimit: status.isNearLimit,
      source: state.source,
    });
  }, [
    onSeatStatusChange,
    state.loading,
    state.rawPlan,
    state.source,
    planLabel,
    limit,
    used,
    remaining,
    status.isAtLimit,
    status.isNearLimit,
  ]);

  async function handleOpenBillingPortal() {
    setPortalBusy(true);
    setPortalError('');

    try {
      const result = await fetchJson(BILLING_PORTAL_ENDPOINT, {
        method: 'POST',
        headers: buildHeaders(true),
        body: JSON.stringify({}),
      });

      if (!result.ok) {
        throw new Error(resolveErrorMessage(result.payload, 'Não foi possível abrir o portal de assinatura agora.'));
      }

      const portalUrl = resolvePortalUrl(result.payload);
      if (!portalUrl) {
        throw new Error('O portal de assinatura não retornou uma URL válida.');
      }

      window.location.assign(portalUrl);
    } catch (error) {
      setPortalError(error?.message || 'Não foi possível abrir o portal de assinatura agora.');
    } finally {
      setPortalBusy(false);
    }
  }

  if (!canManageAgents) return null;

  return (
    <section className="aa-brand-card p-5 mb-6 aa-settings-r11b3-hidden-surface __AUTOATENDE_V4_R11B_R3_HIDE_REAL_OPERATIONAL_SURFACES_IN_SETTINGS__" data-aa-hidden-surface="seats_governanca">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="aa-brand-kicker">Seats e governança de agentes</p>
          <h2 className="aa-brand-title mt-1 text-xl font-semibold">Capacidade atual do plano para usuários internos</h2>
          <p className="aa-brand-copy mt-2 text-sm">
            Esta leitura conecta o plano comercial à gestão operacional de agentes dentro do app.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={pillClass(status.tone)}>
            {state.loading ? 'Verificando plano...' : status.label}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mt-5">
        <article className="aa-brand-subcard p-4">
          <p className="aa-brand-kicker">Plano atual</p>
          <h3 className="aa-brand-title mt-2 text-lg font-semibold">{planLabel}</h3>
        </article>

        <article className="aa-brand-subcard p-4">
          <p className="aa-brand-kicker">Seats incluídos</p>
          <h3 className="aa-brand-title mt-2 text-lg font-semibold">
            {typeof limit === 'number' ? limit : '—'}
          </h3>
        </article>

        <article className="aa-brand-subcard p-4">
          <p className="aa-brand-kicker">Seats usados</p>
          <h3 className="aa-brand-title mt-2 text-lg font-semibold">{used}</h3>
        </article>

        <article className="aa-brand-subcard p-4">
          <p className="aa-brand-kicker">Seats disponíveis</p>
          <h3 className="aa-brand-title mt-2 text-lg font-semibold">
            {typeof remaining === 'number' ? remaining : '—'}
          </h3>
        </article>
      </div>

      <div className="aa-brand-subcard p-4 mt-4">
        <p className="aa-brand-copy text-sm">{status.helper}</p>

        {status.shouldUpgrade ? (
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              type="button"
              onClick={handleOpenBillingPortal}
              disabled={portalBusy}
              className="aa-brand-btn-primary px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {portalBusy ? 'Abrindo portal...' : 'Fazer upgrade do plano'}
            </button>
          </div>
        ) : null}

        {portalError ? (
          <p className="aa-brand-copy text-sm mt-3">{portalError}</p>
        ) : null}

        {typeof limit === 'number' ? (
          <p className="aa-brand-copy text-xs mt-3 opacity-70">
            Ao atingir o limite do plano, a criação de novos usuários internos deve seguir o fluxo de upgrade.
          </p>
        ) : null}

        {state.source ? (
          <p className="aa-brand-copy text-xs mt-2 opacity-70">
            Fonte detectada automaticamente: {state.source}
          </p>
        ) : null}
      </div>
    </section>
  );
}
