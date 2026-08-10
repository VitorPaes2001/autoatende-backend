/**
 * __AUTOATENDE_STRIPE_PHASE2R_D5E_C_OWNER_ACCESS_BRIDGE__
 *
 * Painel interno para criar/vincular acesso do dono da empresa.
 *
 * Não automatiza implantação.
 * Não conecta WhatsApp.
 * Não ativa bot.
 * Não configura assistente.
 *
 * Apenas libera login quando a equipe AutoAtendeAI decidir.
 */

(function installAdminOwnerAccessBridge() {
  const MARKER = '__AUTOATENDE_STRIPE_PHASE2R_D5E_C_OWNER_ACCESS_BRIDGE__';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (window.__AUTOATENDE_D5E_C_OWNER_ACCESS_STARTED__) return;

  window.__AUTOATENDE_D5E_C_OWNER_ACCESS_STARTED__ = true;

  let lastPasswordPayload = null;

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
      return parsed ? walkForAccessToken(parsed, depth + 1, seen) : '';
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

    if (token) headers.Authorization = `Bearer ${token}`;

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

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function money(cents, currency = 'BRL') {
    const value = Number(cents || 0) / 100;

    if (!Number.isFinite(value) || value <= 0) return '—';

    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: String(currency || 'BRL').toUpperCase(),
    }).format(value);
  }

  function getMetadata(row) {
    const meta = parseJsonMaybe(row && row.metadata);
    return meta && typeof meta === 'object' ? meta : {};
  }

  function getActivation(row) {
    const metadata = getMetadata(row);
    return metadata.activation || metadata.companyActivation || null;
  }

  function hasBase(row) {
    const activation = getActivation(row);
    return Boolean(activation && activation.companyId && activation.clientId && activation.subscriptionId);
  }

  function hasOwnerAccess(row) {
    const activation = getActivation(row);
    return Boolean(activation && activation.userId && activation.loginReady);
  }

  function canCreateOwnerAccess(row) {
    if (!row || !row.id) return false;
    if (normalizeText(row.status) === 'canceled') return false;
    if (!hasBase(row)) return false;
    if (hasOwnerAccess(row)) return false;
    return true;
  }

  function defaultEmail(row) {
    const email = String(row?.customer_email || '').trim();

    if (!email || !email.includes('@') || email.endsWith('@autoatendeai.local')) return '';

    return email;
  }

  function defaultName(row) {
    return String(row?.customer_name || row?.company_name || '').trim();
  }

  function ensureStyles() {
    if (document.getElementById('aa-d5e-c-owner-access-style')) return;

    const style = document.createElement('style');
    style.id = 'aa-d5e-c-owner-access-style';
    style.textContent = `
      .aa-d5e-c-panel {
        margin: 18px 0;
        padding: 18px;
        border-radius: 22px;
        background:
          radial-gradient(circle at top left, rgba(59, 130, 246, .13), transparent 34%),
          linear-gradient(180deg, rgba(2, 15, 23, .98), rgba(1, 9, 14, .98));
        border: 1px solid rgba(56, 189, 248, .20);
        box-shadow: 0 22px 55px rgba(0, 0, 0, .34), inset 0 1px 0 rgba(255,255,255,.04);
        color: #f8fafc;
      }

      .aa-d5e-c-panel[data-state="success"] {
        border-color: rgba(34, 197, 94, .28);
        background:
          radial-gradient(circle at top left, rgba(34, 197, 94, .14), transparent 34%),
          linear-gradient(180deg, rgba(2, 22, 18, .98), rgba(1, 11, 10, .98));
      }

      .aa-d5e-c-panel[data-state="error"] {
        border-color: rgba(239, 68, 68, .30);
        background:
          radial-gradient(circle at top left, rgba(239, 68, 68, .15), transparent 34%),
          linear-gradient(180deg, rgba(30, 8, 8, .98), rgba(9, 4, 4, .98));
      }

      .aa-d5e-c-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 14px;
      }

      .aa-d5e-c-kicker {
        color: #38bdf8;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: .13em;
        font-weight: 900;
        margin-bottom: 4px;
      }

      .aa-d5e-c-title {
        color: #f8fafc;
        font-size: 18px;
        line-height: 1.2;
        font-weight: 900;
        margin: 0;
      }

      .aa-d5e-c-desc {
        margin: 6px 0 0;
        color: rgba(226, 232, 240, .76);
        font-size: 13px;
        line-height: 1.5;
        max-width: 940px;
      }

      .aa-d5e-c-refresh,
      .aa-d5e-c-create,
      .aa-d5e-c-copy {
        border: 0;
        border-radius: 999px;
        font-weight: 850;
        cursor: pointer;
        transition: transform .12s ease, opacity .12s ease, box-shadow .12s ease;
        white-space: nowrap;
      }

      .aa-d5e-c-refresh {
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid rgba(148, 163, 184, .16);
        padding: 10px 14px;
        font-size: 12px;
      }

      .aa-d5e-c-create {
        background: linear-gradient(135deg, #0284c7, #38bdf8);
        color: #03121d;
        padding: 9px 12px;
        font-size: 12px;
        box-shadow: 0 10px 24px rgba(56, 189, 248, .18);
      }

      .aa-d5e-c-copy {
        background: rgba(248, 250, 252, .94);
        color: #020617;
        padding: 8px 11px;
        font-size: 12px;
      }

      .aa-d5e-c-refresh:hover,
      .aa-d5e-c-create:hover,
      .aa-d5e-c-copy:hover {
        transform: translateY(-1px);
      }

      .aa-d5e-c-create:disabled,
      .aa-d5e-c-refresh:disabled {
        opacity: .55;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      .aa-d5e-c-list {
        display: grid;
        gap: 10px;
      }

      .aa-d5e-c-row {
        border: 1px solid rgba(56, 189, 248, .14);
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(8, 28, 40, .92), rgba(3, 15, 23, .92));
        padding: 13px;
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) minmax(190px, .75fr) auto;
        gap: 12px;
        align-items: center;
      }

      .aa-d5e-c-company {
        color: #f8fafc;
        font-size: 14px;
        font-weight: 900;
        margin: 0 0 4px;
      }

      .aa-d5e-c-meta,
      .aa-d5e-c-side {
        color: rgba(226, 232, 240, .76);
        font-size: 12px;
        line-height: 1.45;
        word-break: break-word;
      }

      .aa-d5e-c-side strong {
        color: #f8fafc;
        display: block;
        font-size: 13px;
      }

      .aa-d5e-c-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }

      .aa-d5e-c-tag {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        background: rgba(148, 163, 184, .12);
        color: rgba(226, 232, 240, .84);
        border: 1px solid rgba(148, 163, 184, .10);
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 800;
      }

      .aa-d5e-c-tag--green {
        background: rgba(34, 197, 94, .14);
        color: #86efac;
        border-color: rgba(34, 197, 94, .22);
      }

      .aa-d5e-c-tag--yellow {
        background: rgba(234, 179, 8, .13);
        color: #fde68a;
        border-color: rgba(234, 179, 8, .18);
      }

      .aa-d5e-c-tag--red {
        background: rgba(239, 68, 68, .13);
        color: #fecaca;
        border-color: rgba(239, 68, 68, .20);
      }

      .aa-d5e-c-message {
        border-radius: 14px;
        padding: 11px 12px;
        font-size: 13px;
        line-height: 1.45;
        background: rgba(15, 23, 42, .42);
        border: 1px solid rgba(148, 163, 184, .10);
        color: rgba(226, 232, 240, .84);
        margin-bottom: 12px;
      }

      .aa-d5e-c-message strong {
        color: #f8fafc;
      }

      .aa-d5e-c-password {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(2, 6, 23, .62);
        border: 1px solid rgba(248, 250, 252, .10);
      }

      .aa-d5e-c-password code {
        color: #f8fafc;
        font-weight: 900;
        letter-spacing: .03em;
        word-break: break-all;
      }

      @media (max-width: 860px) {
        .aa-d5e-c-top,
        .aa-d5e-c-row {
          display: grid;
          grid-template-columns: 1fr;
        }

        .aa-d5e-c-create,
        .aa-d5e-c-refresh {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function findMountTarget() {
    return (
      document.getElementById('aa-d5d-c-provisioning-activation-panel') ||
      document.querySelector('.aa-provisioning-head') ||
      document.querySelector('[class*="provisioning-head"]') ||
      document.querySelector('[data-aa-page="provisioning"]') ||
      document.querySelector('main') ||
      document.body
    );
  }

  function ensurePanel() {
    ensureStyles();

    let panel = document.getElementById('aa-d5e-c-owner-access-panel');

    if (panel) return panel;

    const target = findMountTarget();

    panel = document.createElement('section');
    panel.id = 'aa-d5e-c-owner-access-panel';
    panel.className = 'aa-d5e-c-panel';
    panel.setAttribute('data-marker', MARKER);

    if (target && target.parentElement) {
      target.parentElement.insertBefore(panel, target.nextSibling);
    } else {
      document.body.prepend(panel);
    }

    return panel;
  }

  function renderShell(panel, state = {}) {
    panel.setAttribute('data-state', state.kind || 'default');

    const passwordBlock = lastPasswordPayload && lastPasswordPayload.temporaryPassword
      ? `
        <div class="aa-d5e-c-message">
          <strong>Senha temporária gerada.</strong>
          Copie agora e envie ao cliente por canal seguro. Ela não deve ficar exposta na tela.
          <div class="aa-d5e-c-password">
            <code>${escapeHtml(lastPasswordPayload.temporaryPassword)}</code>
            <button class="aa-d5e-c-copy" type="button" data-aa-d5e-c-copy-password>Copiar senha</button>
          </div>
        </div>
      `
      : '';

    panel.innerHTML = `
      <div class="aa-d5e-c-top">
        <div>
          <div class="aa-d5e-c-kicker">Acesso do cliente</div>
          <h2 class="aa-d5e-c-title">Liberar login do dono</h2>
          <p class="aa-d5e-c-desc">
            Use somente depois que a base do cliente estiver preparada. Este painel cria ou vincula o acesso do dono à empresa.
            A implantação continua manual: WhatsApp, assistente, testes e liberação operacional seguem por sua conta.
          </p>
        </div>
        <button class="aa-d5e-c-refresh" type="button" data-aa-d5e-c-refresh>
          Atualizar acessos
        </button>
      </div>
      ${state.message ? `<div class="aa-d5e-c-message"><strong>${escapeHtml(state.status || '')}</strong>${escapeHtml(state.message)}</div>` : ''}
      ${passwordBlock}
      <div class="aa-d5e-c-list" data-aa-d5e-c-list>
        <div class="aa-d5e-c-message">Carregando fila de provisionamento...</div>
      </div>
    `;

    const refresh = panel.querySelector('[data-aa-d5e-c-refresh]');
    if (refresh) refresh.addEventListener('click', () => loadAndRender());

    const copyPassword = panel.querySelector('[data-aa-d5e-c-copy-password]');
    if (copyPassword) {
      copyPassword.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(lastPasswordPayload.temporaryPassword);
          const previous = copyPassword.textContent;
          copyPassword.textContent = 'Copiada';
          window.setTimeout(() => {
            copyPassword.textContent = previous;
          }, 1800);
        } catch (_) {}
      });
    }
  }

  function rowHtml(row) {
    const activation = getActivation(row);
    const base = hasBase(row);
    const ownerReady = hasOwnerAccess(row);
    const allowed = canCreateOwnerAccess(row);

    const company = row.company_name || row.customer_name || 'Empresa sem nome';
    const email = activation?.ownerEmail || row.customer_email || 'E-mail não informado';
    const plan = row.plan_name || row.plan_key || row.internal_plan || 'Plano não informado';
    const paidValue = money(row.amount_total, row.currency || 'BRL');

    const statusLabel = ownerReady
      ? `Login pronto · ${String(activation.userId || '').slice(0, 8)}`
      : base
        ? 'Base pronta · acesso pendente'
        : 'Prepare a base primeiro';

    const statusClass = ownerReady
      ? 'aa-d5e-c-tag--green'
      : base
        ? 'aa-d5e-c-tag--yellow'
        : 'aa-d5e-c-tag--red';

    return `
      <article class="aa-d5e-c-row" data-aa-d5e-c-row="${escapeHtml(row.id)}">
        <div>
          <h3 class="aa-d5e-c-company">${escapeHtml(company)}</h3>
          <div class="aa-d5e-c-meta">
            ${escapeHtml(email)}<br>
            Company: ${escapeHtml(String(activation?.companyId || '—').slice(0, 8))}
            · Client: ${escapeHtml(String(activation?.clientId || '—').slice(0, 8))}
          </div>
          <div class="aa-d5e-c-tags">
            <span class="aa-d5e-c-tag ${statusClass}">${escapeHtml(statusLabel)}</span>
            <span class="aa-d5e-c-tag">Fila: ${escapeHtml(row.status || '—')}</span>
            <span class="aa-d5e-c-tag">Pagamento: ${escapeHtml(row.payment_status || '—')}</span>
            <span class="aa-d5e-c-tag">Assinatura: ${escapeHtml(row.subscription_status || '—')}</span>
          </div>
        </div>
        <div class="aa-d5e-c-side">
          <strong>${escapeHtml(plan)}</strong>
          ${escapeHtml(paidValue)}<br>
          ${ownerReady ? `Usuário: ${escapeHtml(String(activation.userId || '').slice(0, 8))}` : 'Login ainda não liberado'}
        </div>
        <div>
          <button
            class="aa-d5e-c-create"
            type="button"
            data-aa-d5e-c-create="${escapeHtml(row.id)}"
            ${allowed ? '' : 'disabled'}
          >
            ${ownerReady ? 'Acesso pronto' : base ? 'Criar acesso' : 'Aguardando base'}
          </button>
        </div>
      </article>
    `;
  }

  function attachHandlers(panel, rows) {
    const byId = new Map();

    for (const row of rows) {
      if (row && row.id) byId.set(String(row.id), row);
    }

    panel.querySelectorAll('[data-aa-d5e-c-create]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = button.getAttribute('data-aa-d5e-c-create');
        const row = byId.get(String(id));

        if (!row || !canCreateOwnerAccess(row)) return;

        const company = row.company_name || row.customer_name || 'Empresa sem nome';

        const email = window.prompt(
          [
            'Informe o e-mail do dono da empresa.',
            '',
            `Empresa: ${company}`,
            '',
            'Este será o login inicial do cliente.'
          ].join('\n'),
          defaultEmail(row)
        );

        const normalizedEmail = String(email || '').trim().toLowerCase();

        if (!normalizedEmail || !normalizedEmail.includes('@')) return;

        const name = window.prompt(
          [
            'Informe o nome do dono/responsável.',
            '',
            'Esse nome aparecerá no usuário principal da empresa.'
          ].join('\n'),
          defaultName(row)
        );

        const normalizedName = String(name || '').trim() || company;

        const confirmation = window.prompt(
          [
            'Confirma criar/vincular o acesso do dono?',
            '',
            `Empresa: ${company}`,
            `E-mail: ${normalizedEmail}`,
            `Nome: ${normalizedName}`,
            '',
            'Isso criará login, usuário interno e vínculo com a empresa.',
            'Não conecta WhatsApp, não ativa bot e não configura o assistente.',
            '',
            'Digite CRIAR ACESSO para confirmar.'
          ].join('\n')
        );

        if (String(confirmation || '').trim() !== 'CRIAR ACESSO') return;

        button.disabled = true;
        button.textContent = 'Criando...';

        try {
          const result = await apiFetch(`/api/admin/provisioning/queue/${encodeURIComponent(row.id)}/prepare-owner-access`, {
            method: 'POST',
            body: {
              email: normalizedEmail,
              name: normalizedName,
            },
          });

          lastPasswordPayload = result && result.temporaryPassword
            ? {
                temporaryPassword: result.temporaryPassword,
                email: normalizedEmail,
                userId: result?.owner?.id || result?.activation?.userId || null,
              }
            : null;

          renderShell(panel, {
            kind: 'success',
            status: 'Acesso do dono preparado. ',
            message: result?.temporaryPassword
              ? 'Senha temporária gerada. Copie antes de sair da tela.'
              : 'Usuário vinculado. Nenhuma senha nova foi gerada porque o usuário Auth já existia.',
          });

          await loadAndRender();
        } catch (error) {
          renderShell(panel, {
            kind: 'error',
            status: 'Falha ao preparar acesso. ',
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

    const list = panel.querySelector('[data-aa-d5e-c-list]');
    if (!list) return;

    list.innerHTML = '<div class="aa-d5e-c-message">Carregando fila de provisionamento...</div>';

    try {
      const payload = await apiFetch('/api/admin/provisioning/queue?limit=50');
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];

      if (!rows.length) {
        list.innerHTML = '<div class="aa-d5e-c-message">Nenhuma contratação encontrada na fila.</div>';
        return;
      }

      const preparedRows = rows.filter((row) => hasBase(row) || hasOwnerAccess(row));

      if (!preparedRows.length) {
        list.innerHTML = '<div class="aa-d5e-c-message">Nenhuma base preparada ainda. Prepare o ambiente do cliente primeiro.</div>';
        return;
      }

      list.innerHTML = preparedRows.map(rowHtml).join('');
      attachHandlers(panel, preparedRows);
    } catch (error) {
      const authHint = error.status === 401 || error.status === 403
        ? ' Entre novamente com o e-mail interno permitido da AutoAtendeAI.'
        : '';

      list.innerHTML = `
        <div class="aa-d5e-c-message">
          <strong>Não foi possível carregar os acessos.</strong>
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

      if (!document.getElementById('aa-d5e-c-owner-access-panel')) {
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

  if (originalPushState && !window.__AUTOATENDE_D5E_C_HISTORY_PATCHED__) {
    window.__AUTOATENDE_D5E_C_HISTORY_PATCHED__ = true;

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
