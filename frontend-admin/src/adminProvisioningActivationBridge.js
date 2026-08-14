/**
 * __AUTOATENDE_STRIPE_PHASE2R_D5D_C_ADMIN_PROVISIONING_ACTIVATION_BRIDGE__
 *
 * Painel interno para preparar a base técnica da implantação a partir da fila de provisionamento.
 *
 * Segurança:
 * - Só roda na rota /provisionamento.
 * - Não executa nada automaticamente.
 * - O POST exige sessão/autorização do backend.
 * - Backend ainda aplica platformOwnerOnly.
 * - Requer confirmação digitando ATIVAR.
 */

(function installAdminProvisioningActivationBridge() {
  const MARKER = '__AUTOATENDE_STRIPE_PHASE2R_D5D_C_ADMIN_PROVISIONING_ACTIVATION_BRIDGE__';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (window.__AUTOATENDE_D5D_C_ADMIN_PROVISIONING_ACTIVATION_STARTED__) {
    return;
  }

  window.__AUTOATENDE_D5D_C_ADMIN_PROVISIONING_ACTIVATION_STARTED__ = true;

  function isProvisioningPage() {
    return String(window.location.pathname || '').replace(/\/+$/, '') === '/provisionamento';
  }

  function parseJsonMaybe(value) {
    if (!value) return null;

    if (typeof value === 'object') return value;

    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (_) {
        return null;
      }
    }

    return null;
  }

  function walkForAccessToken(value, depth = 0, seen = new WeakSet()) {
    if (!value || depth > 8) return '';

    if (typeof value === 'string') {
      if (/^eyJ[a-zA-Z0-9_-]+\./.test(value) && value.length > 60) return value;

      const parsed = parseJsonMaybe(value);
      if (parsed) return walkForAccessToken(parsed, depth + 1, seen);

      return '';
    }

    if (typeof value !== 'object') return '';

    if (seen.has(value)) return '';
    seen.add(value);

    const direct =
      value.access_token ||
      value.accessToken ||
      value.token ||
      value.jwt ||
      value.session?.access_token ||
      value.currentSession?.access_token ||
      value.data?.session?.access_token;

    if (typeof direct === 'string' && direct.length > 40) return direct;

    for (const child of Object.values(value)) {
      const found = walkForAccessToken(child, depth + 1, seen);
      if (found) return found;
    }

    return '';
  }

  function getAccessToken() {
    const stores = [];

    try {
      if (window.localStorage) stores.push(window.localStorage);
    } catch (_) {}

    try {
      if (window.sessionStorage) stores.push(window.sessionStorage);
    } catch (_) {}

    for (const store of stores) {
      try {
        for (let i = 0; i < store.length; i += 1) {
          const key = store.key(i);
          const value = store.getItem(key);

          if (!key && !value) continue;

          const keyHit = /supabase|auth|token|session|autoatende/i.test(String(key || ''));
          const valueHit = /access_token|accessToken|eyJ/i.test(String(value || ''));

          if (!keyHit && !valueHit) continue;

          const found = walkForAccessToken(value);
          if (found) return found;
        }
      } catch (_) {}
    }

    return '';
  }

  async function apiFetch(path, options = {}) {
    const token = getAccessToken();

    const headers = {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(path, {
      method: options.method || 'GET',
      headers,
      credentials: 'same-origin',
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error ||
        payload?.code ||
        `HTTP ${response.status}`;

      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  function money(cents, currency = 'BRL') {
    const value = Number(cents || 0) / 100;

    if (!Number.isFinite(value) || value <= 0) return '—';

    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: String(currency || 'BRL').toUpperCase(),
    }).format(value);
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function getMetadata(row) {
    const meta = parseJsonMaybe(row && row.metadata);
    return meta && typeof meta === 'object' ? meta : {};
  }

  function getActivation(row) {
    const metadata = getMetadata(row);
    return metadata.activation || metadata.companyActivation || null;
  }

  function isPaid(row) {
    return normalizeText(row?.payment_status) === 'paid';
  }

  function isSubActive(row) {
    const status = normalizeText(row?.subscription_status);
    return !status || status === 'active' || status === 'trialing';
  }

  function canPrepare(row) {
    if (!row || !row.id) return false;
    if (normalizeText(row.status) === 'canceled') return false;
    if (!isPaid(row)) return false;
    if (!isSubActive(row)) return false;
    if (getActivation(row)) return false;
    return true;
  }

  function isLikelyTest(row) {
    const hay = [
      row?.company_name,
      row?.customer_name,
      row?.customer_email,
      row?.checkout_session_id,
      row?.metadata && JSON.stringify(row.metadata),
    ].map(normalizeText).join(' | ');

    return (
      hay.includes('teste') ||
      hay.includes('pagamento-teste') ||
      hay.includes('autoatende_stripe_phase') ||
      hay.includes('empresa teste')
    );
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function ensureStyles() {
    if (document.getElementById('aa-d5d-c-provisioning-activation-style')) return;

    const style = document.createElement('style');
    style.id = 'aa-d5d-c-provisioning-activation-style';
    style.textContent = `
      .aa-d5d-c-panel {
        border: 1px solid rgba(15, 23, 42, 0.10);
        background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96));
        border-radius: 22px;
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
        padding: 18px;
        margin: 18px 0;
        color: #0f172a;
      }

      .aa-d5d-c-panel[data-state="success"] {
        border-color: rgba(21, 128, 61, 0.25);
        background: linear-gradient(180deg, rgba(240,253,244,0.96), rgba(255,255,255,0.98));
      }

      .aa-d5d-c-panel[data-state="error"] {
        border-color: rgba(185, 28, 28, 0.22);
        background: linear-gradient(180deg, rgba(254,242,242,0.96), rgba(255,255,255,0.98));
      }

      .aa-d5d-c-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 14px;
      }

      .aa-d5d-c-kicker {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: .12em;
        font-weight: 800;
        color: #16a34a;
        margin-bottom: 4px;
      }

      .aa-d5d-c-title {
        font-size: 18px;
        line-height: 1.2;
        font-weight: 850;
        margin: 0;
      }

      .aa-d5d-c-desc {
        margin: 6px 0 0;
        color: #475569;
        font-size: 13px;
        line-height: 1.5;
        max-width: 900px;
      }

      .aa-d5d-c-refresh,
      .aa-d5d-c-activate {
        border: 0;
        border-radius: 999px;
        font-weight: 800;
        cursor: pointer;
        transition: transform .12s ease, opacity .12s ease, box-shadow .12s ease;
        white-space: nowrap;
      }

      .aa-d5d-c-refresh {
        background: #0f172a;
        color: #fff;
        padding: 10px 14px;
        font-size: 12px;
      }

      .aa-d5d-c-activate {
        background: #16a34a;
        color: #fff;
        padding: 9px 12px;
        font-size: 12px;
        box-shadow: 0 8px 20px rgba(22, 163, 74, .22);
      }

      .aa-d5d-c-refresh:hover,
      .aa-d5d-c-activate:hover {
        transform: translateY(-1px);
      }

      .aa-d5d-c-activate:disabled,
      .aa-d5d-c-refresh:disabled {
        cursor: not-allowed;
        opacity: .55;
        transform: none;
        box-shadow: none;
      }

      .aa-d5d-c-list {
        display: grid;
        gap: 10px;
      }

      .aa-d5d-c-row {
        border: 1px solid rgba(15, 23, 42, .08);
        border-radius: 16px;
        background: rgba(255,255,255,.88);
        padding: 13px;
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(180px, .75fr) auto;
        gap: 12px;
        align-items: center;
      }

      .aa-d5d-c-company {
        font-size: 14px;
        font-weight: 850;
        margin: 0 0 4px;
      }

      .aa-d5d-c-meta {
        color: #64748b;
        font-size: 12px;
        line-height: 1.45;
        word-break: break-word;
      }

      .aa-d5d-c-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }

      .aa-d5d-c-tag {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        background: rgba(15,23,42,.06);
        color: #334155;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 750;
      }

      .aa-d5d-c-tag--green {
        background: rgba(22,163,74,.10);
        color: #15803d;
      }

      .aa-d5d-c-tag--yellow {
        background: rgba(202,138,4,.12);
        color: #854d0e;
      }

      .aa-d5d-c-tag--red {
        background: rgba(220,38,38,.10);
        color: #b91c1c;
      }

      .aa-d5d-c-side {
        color: #334155;
        font-size: 12px;
        line-height: 1.5;
      }

      .aa-d5d-c-side strong {
        display: block;
        font-size: 13px;
        color: #0f172a;
      }

      .aa-d5d-c-message {
        border-radius: 14px;
        padding: 11px 12px;
        font-size: 13px;
        line-height: 1.45;
        background: rgba(15,23,42,.05);
        color: #334155;
        margin-bottom: 12px;
      }

      .aa-d5d-c-message strong {
        color: #0f172a;
      }

      @media (max-width: 840px) {
        .aa-d5d-c-top,
        .aa-d5d-c-row {
          grid-template-columns: 1fr;
          display: grid;
        }

        .aa-d5d-c-row {
          align-items: stretch;
        }

        .aa-d5d-c-activate,
        .aa-d5d-c-refresh {
          width: 100%;
        }
      }
    `;

    style.textContent += `
      /* __AUTOATENDE_STRIPE_PHASE2R_D5D_C_R1_INTERNAL_IMPLEMENTATION_VISUAL_POLISH__ */
      .aa-d5d-c-panel {
        background:
          radial-gradient(circle at top left, rgba(22, 163, 74, .13), transparent 34%),
          linear-gradient(180deg, rgba(2, 22, 18, .98), rgba(1, 12, 10, .98)) !important;
        border: 1px solid rgba(34, 197, 94, .22) !important;
        box-shadow: 0 22px 55px rgba(0, 0, 0, .36), inset 0 1px 0 rgba(255,255,255,.04) !important;
        color: #ecfdf5 !important;
      }

      .aa-d5d-c-panel[data-state="success"] {
        background:
          radial-gradient(circle at top left, rgba(34, 197, 94, .18), transparent 36%),
          linear-gradient(180deg, rgba(2, 36, 27, .98), rgba(1, 14, 11, .98)) !important;
        border-color: rgba(34, 197, 94, .34) !important;
      }

      .aa-d5d-c-panel[data-state="error"] {
        background:
          radial-gradient(circle at top left, rgba(239, 68, 68, .16), transparent 34%),
          linear-gradient(180deg, rgba(31, 10, 10, .98), rgba(10, 5, 5, .98)) !important;
        border-color: rgba(239, 68, 68, .28) !important;
      }

      .aa-d5d-c-kicker {
        color: #22c55e !important;
      }

      .aa-d5d-c-title {
        color: #f8fafc !important;
      }

      .aa-d5d-c-desc,
      .aa-d5d-c-meta,
      .aa-d5d-c-side {
        color: rgba(226, 232, 240, .78) !important;
      }

      .aa-d5d-c-side strong,
      .aa-d5d-c-company,
      .aa-d5d-c-message strong {
        color: #f8fafc !important;
      }

      .aa-d5d-c-row {
        background:
          linear-gradient(180deg, rgba(5, 31, 26, .92), rgba(3, 18, 16, .92)) !important;
        border-color: rgba(34, 197, 94, .14) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.03) !important;
      }

      .aa-d5d-c-message {
        background: rgba(15, 23, 42, .42) !important;
        border: 1px solid rgba(148, 163, 184, .10) !important;
        color: rgba(226, 232, 240, .84) !important;
      }

      .aa-d5d-c-refresh {
        background: #0f172a !important;
        color: #f8fafc !important;
        border: 1px solid rgba(148, 163, 184, .16) !important;
      }

      .aa-d5d-c-activate {
        background: linear-gradient(135deg, #16a34a, #22c55e) !important;
        color: #02130b !important;
        box-shadow: 0 10px 26px rgba(34, 197, 94, .20) !important;
      }

      .aa-d5d-c-activate:disabled {
        background: rgba(148, 163, 184, .22) !important;
        color: rgba(226, 232, 240, .78) !important;
      }

      .aa-d5d-c-tag {
        background: rgba(148, 163, 184, .12) !important;
        color: rgba(226, 232, 240, .84) !important;
        border: 1px solid rgba(148, 163, 184, .10) !important;
      }

      .aa-d5d-c-tag--green {
        background: rgba(34, 197, 94, .14) !important;
        color: #86efac !important;
        border-color: rgba(34, 197, 94, .22) !important;
      }

      .aa-d5d-c-tag--yellow {
        background: rgba(234, 179, 8, .13) !important;
        color: #fde68a !important;
        border-color: rgba(234, 179, 8, .18) !important;
      }

      .aa-d5d-c-tag--red {
        background: rgba(239, 68, 68, .13) !important;
        color: #fecaca !important;
        border-color: rgba(239, 68, 68, .20) !important;
      }
`;

    document.head.appendChild(style);
  }

  function findMountTarget() {
    return (
      document.querySelector('.aa-provisioning-head') ||
      document.querySelector('[class*="provisioning-head"]') ||
      document.querySelector('[data-aa-page="provisioning"]') ||
      document.querySelector('main') ||
      document.body
    );
  }

  function ensurePanel() {
    ensureStyles();

    let panel = document.getElementById('aa-d5d-c-provisioning-activation-panel');

    if (panel) return panel;

    const target = findMountTarget();

    panel = document.createElement('section');
    panel.id = 'aa-d5d-c-provisioning-activation-panel';
    panel.className = 'aa-d5d-c-panel';
    panel.setAttribute('data-marker', MARKER);

    if (target && target.parentElement) {
      target.parentElement.insertBefore(panel, target.nextSibling);
    } else {
      document.body.prepend(panel);
    }

    return panel;
  }

  function renderShell(panel, state = {}) {
    const status = state.status || '';
    const message = state.message || '';

    panel.setAttribute('data-state', state.kind || 'default');

    panel.innerHTML = `
      <div class="aa-d5d-c-top">
        <div>
          <div class="aa-d5d-c-kicker">Implantação interna</div>
          <h2 class="aa-d5d-c-title">Preparar ambiente do cliente</h2>
          <p class="aa-d5d-c-desc">
            Painel interno da equipe AutoAtendeAI. Use após pagamento confirmado para preparar a base operacional do cliente. A implantação continua sendo serviço assistido e cobrado: configuração do WhatsApp, ajuste do assistente, testes e liberação acompanhada.
          </p>
        </div>
        <button class="aa-d5d-c-refresh" type="button" data-aa-d5d-c-refresh>
          Atualizar implantação
        </button>
      </div>
      ${message ? `<div class="aa-d5d-c-message"><strong>${escapeHtml(status)}</strong>${escapeHtml(message)}</div>` : ''}
      <div class="aa-d5d-c-list" data-aa-d5d-c-list>
        <div class="aa-d5d-c-message">Carregando fila de provisionamento...</div>
      </div>
    `;

    const refresh = panel.querySelector('[data-aa-d5d-c-refresh]');
    if (refresh) refresh.addEventListener('click', () => loadAndRender());
  }

  function rowHtml(row) {
    const activation = getActivation(row);
    const prepared = Boolean(activation && activation.companyId && activation.clientId);
    const allowed = canPrepare(row);
    const test = isLikelyTest(row);

    const statusClass = prepared ? 'aa-d5d-c-tag--green' : allowed ? 'aa-d5d-c-tag--yellow' : 'aa-d5d-c-tag--red';

    const company = row.company_name || row.customer_name || 'Empresa sem nome';
    const email = row.customer_email || 'E-mail não informado';
    const checkout = row.checkout_session_id || 'Checkout não informado';
    const plan = row.plan_name || row.plan_key || row.internal_plan || 'Plano não informado';
    const paidValue = money(row.amount_total, row.currency || 'BRL');

    const activationLabel = prepared
      ? `Base criada · company ${String(activation.companyId || '').slice(0, 8)}`
      : allowed
        ? 'Pronta para implantação'
        : 'Não elegível';

    return `
      <article class="aa-d5d-c-row" data-aa-d5d-c-row="${escapeHtml(row.id)}">
        <div>
          <h3 class="aa-d5d-c-company">${escapeHtml(company)}</h3>
          <div class="aa-d5d-c-meta">
            ${escapeHtml(email)}<br>
            Checkout: ${escapeHtml(checkout)}
          </div>
          <div class="aa-d5d-c-tags">
            <span class="aa-d5d-c-tag ${statusClass}">${escapeHtml(activationLabel)}</span>
            <span class="aa-d5d-c-tag">Fila: ${escapeHtml(row.status || '—')}</span>
            <span class="aa-d5d-c-tag">Pagamento: ${escapeHtml(row.payment_status || '—')}</span>
            <span class="aa-d5d-c-tag">Assinatura: ${escapeHtml(row.subscription_status || '—')}</span>
            ${test ? '<span class="aa-d5d-c-tag aa-d5d-c-tag--green">Registro de teste</span>' : ''}
          </div>
        </div>
        <div class="aa-d5d-c-side">
          <strong>${escapeHtml(plan)}</strong>
          ${escapeHtml(paidValue)}<br>
          ${prepared ? `Client: ${escapeHtml(String(activation.clientId || '').slice(0, 8))}` : 'Implantação segue assistida'}
        </div>
        <div>
          <button
            class="aa-d5d-c-activate"
            type="button"
            data-aa-d5d-c-activate="${escapeHtml(row.id)}"
            ${allowed ? '' : 'disabled'}
          >
            ${prepared ? 'Base preparada' : 'Preparar ambiente'}
          </button>
        </div>
      </article>
    `;
  }

  function attachActivationHandlers(panel, rows) {
    const byId = new Map();

    for (const row of rows) {
      if (row && row.id) byId.set(String(row.id), row);
    }

    panel.querySelectorAll('[data-aa-d5d-c-activate]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = button.getAttribute('data-aa-d5d-c-activate');
        const row = byId.get(String(id));

        if (!row || !canPrepare(row)) return;

        const company = row.company_name || row.customer_name || 'Empresa sem nome';
        const plan = row.plan_name || row.plan_key || row.internal_plan || 'Plano não informado';

        const confirmation = window.prompt(
          [
            'Confirma preparar a base interna desta contratação?',
            '',
            `Empresa: ${company}`,
            `Plano: ${plan}`,
            `Valor: ${money(row.amount_total, row.currency || 'BRL')}`,
            '',
            'Isto cria a estrutura técnica mínima para sua equipe iniciar a implantação.',
            'A implantação cobrada continua manual: WhatsApp, assistente, testes e liberação.',
            '',
            'Digite ATIVAR para confirmar.'
          ].join('\n')
        );

        if (String(confirmation || '').trim() !== 'ATIVAR') {
          return;
        }

        button.disabled = true;
        button.textContent = 'Preparando...';

        try {
          const result = await apiFetch(`/api/admin/provisioning/queue/${encodeURIComponent(row.id)}/prepare-activation`, {
            method: 'POST',
          });

          const activation = result && result.activation ? result.activation : {};

          renderShell(panel, {
            kind: 'success',
            status: 'Base interna preparada. ',
            message: `Estrutura operacional criada com companyId ${activation.companyId || '—'} e clientId ${activation.clientId || '—'}.`,
          });

          await loadAndRender();
        } catch (error) {
          renderShell(panel, {
            kind: 'error',
            status: 'Falha ao preparar ativação. ',
            message: error.message || 'Erro desconhecido.',
          });

          await loadAndRender();
        }
      });
    });
  }

  async function loadAndRender() {
    if (!isProvisioningPage()) return;

    const panel = ensurePanel();

    if (!panel.dataset.ready) {
      renderShell(panel);
      panel.dataset.ready = 'true';
    }

    const list = panel.querySelector('[data-aa-d5d-c-list]');

    if (!list) return;

    list.innerHTML = '<div class="aa-d5d-c-message">Carregando fila de provisionamento...</div>';

    try {
      const payload = await apiFetch('/api/admin/provisioning/queue?limit=50');
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];

      if (!rows.length) {
        list.innerHTML = '<div class="aa-d5d-c-message">Nenhuma contratação encontrada na fila.</div>';
        return;
      }

      list.innerHTML = rows.map(rowHtml).join('');
      attachActivationHandlers(panel, rows);
    } catch (error) {
      const authHint = error.status === 401 || error.status === 403
        ? ' Entre novamente com o e-mail interno permitido da AutoAtendeAI.'
        : '';

      list.innerHTML = `
        <div class="aa-d5d-c-message">
          <strong>Não foi possível carregar a fila.</strong>
          ${escapeHtml(error.message || 'Erro desconhecido.')}${escapeHtml(authHint)}
        </div>
      `;
    }
  }

  function boot() {
    if (!isProvisioningPage()) return;

    loadAndRender();

    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;

      if (!isProvisioningPage()) {
        window.clearInterval(timer);
        return;
      }

      if (!document.getElementById('aa-d5d-c-provisioning-activation-panel')) {
        loadAndRender();
      }

      if (ticks >= 20) {
        window.clearInterval(timer);
      }
    }, 750);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener('popstate', boot, { passive: true });
  window.addEventListener('hashchange', boot, { passive: true });

  const originalPushState = window.history && window.history.pushState;
  const originalReplaceState = window.history && window.history.replaceState;

  if (originalPushState && !window.__AUTOATENDE_D5D_C_HISTORY_PATCHED__) {
    window.__AUTOATENDE_D5D_C_HISTORY_PATCHED__ = true;

    window.history.pushState = function patchedPushState() {
      const result = originalPushState.apply(this, arguments);
      window.setTimeout(boot, 80);
      return result;
    };

    window.history.replaceState = function patchedReplaceState() {
      const result = originalReplaceState.apply(this, arguments);
      window.setTimeout(boot, 80);
      return result;
    };
  }
})();
