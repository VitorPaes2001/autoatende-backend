import './operationalOnboarding.css';

/**
 * __AUTOATENDE_STRIPE_PHASE2R_D5B_OPERATIONAL_ONBOARDING_FLOW_BRIDGE__
 *
 * Fallback seguro:
 * - Se a rota React /onboarding já renderizar a página oficial, não faz nada.
 * - Se a rota não existir no App.jsx, renderiza uma página operacional standalone no #root.
 * - Não escreve no banco.
 * - Não altera provisionamento.
 */

const MARKER = '__AUTOATENDE_STRIPE_PHASE2R_D5B_OPERATIONAL_ONBOARDING_FLOW_BRIDGE__';

const PLAN_FALLBACK = {
  essencial: { name: 'Essencial', monthlyAmount: 24990, implementationAmount: 49000 },
  profissional: { name: 'Profissional', monthlyAmount: 44990, implementationAmount: 69000 },
  pro: { name: 'Profissional', monthlyAmount: 44990, implementationAmount: 69000 },
  business: { name: 'Business', monthlyAmount: 69990, implementationAmount: 99000 },
};

const STEPS = [
  ['Pagamento confirmado', 'A contratação paga libera a próxima etapa e registra a implantação para acompanhamento interno.'],
  ['Entrada na fila de provisionamento', 'A equipe AutoAtendeAI acompanha o cadastro internamente antes de liberar a operação real.'],
  ['Contato humano inicial', 'Primeiro alinhamento para entender empresa, urgência, número do WhatsApp e prioridade de implantação.'],
  ['Coleta dos dados da empresa', 'Reunimos horários, serviços, dúvidas frequentes, tom de voz, regras de atendimento e responsáveis.'],
  ['Configuração da empresa no sistema', 'Organizamos a estrutura da conta, usuários internos e base mínima para operar com segurança.'],
  ['Conexão do WhatsApp', 'Validamos a conexão oficial antes de colocar qualquer atendimento em produção.'],
  ['Configuração do assistente', 'Ajustamos comportamento, qualificação, respostas base, transbordo humano e limites operacionais.'],
  ['Teste assistido', 'Simulamos conversas reais e corrigimos pontos de risco antes da liberação.'],
  ['Liberação para operação real', 'Depois dos testes, a operação entra em uso com acompanhamento próximo nos primeiros atendimentos.'],
];

function isOnboardingPath() {
  const path = window.location.pathname || '/';
  return path === '/onboarding' || path.startsWith('/onboarding/');
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(cents) {
  const value = Number(cents || 0) / 100;

  if (!Number.isFinite(value) || value <= 0) return '—';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function readPath(obj, path) {
  try {
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  } catch {
    return undefined;
  }
}

function findDeep(obj, keys, depth = 0, seen = new WeakSet()) {
  if (!obj || typeof obj !== 'object' || depth > 6 || seen.has(obj)) return undefined;

  seen.add(obj);

  for (const key of keys) {
    const direct = obj[key];
    if (direct !== undefined && direct !== null && direct !== '') return direct;
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      const found = findDeep(value, keys, depth + 1, seen);
      if (found !== undefined && found !== null && found !== '') return found;
    }
  }

  return undefined;
}

function getSessionId() {
  const params = new URLSearchParams(window.location.search || '');

  return (
    params.get('session_id') ||
    params.get('sessionId') ||
    params.get('stripe_session_id') ||
    ''
  ).trim();
}

function inferPlanKey(payload) {
  const raw = normalize(
    findDeep(payload, ['plan', 'planKey', 'plan_key', 'internalPlan']) ||
    readPath(payload, 'metadata.plan') ||
    ''
  );

  if (raw.includes('business')) return 'business';
  if (raw.includes('profissional') || raw.includes('professional') || raw === 'pro') return 'profissional';
  if (raw.includes('essencial') || raw.includes('starter') || raw.includes('essential')) return 'essencial';

  return '';
}

function inferPlan(payload) {
  const key = inferPlanKey(payload);
  const fallback = PLAN_FALLBACK[key] || null;

  const name =
    findDeep(payload, ['planName', 'plan_name', 'name']) ||
    readPath(payload, 'plan.name') ||
    (fallback && fallback.name) ||
    'Plano em validação';

  const monthlyAmount =
    Number(findDeep(payload, ['monthlyAmount', 'monthly_amount', 'recurringAmount', 'amount_monthly'])) ||
    (fallback && fallback.monthlyAmount) ||
    0;

  const implementationAmount =
    Number(findDeep(payload, ['implementationAmount', 'implementation_amount', 'setupAmount', 'setup_amount'])) ||
    (fallback && fallback.implementationAmount) ||
    0;

  const totalAmount =
    Number(findDeep(payload, ['totalAmount', 'total_amount', 'amount_total', 'amountTotal'])) ||
    monthlyAmount + implementationAmount;

  return { name, totalAmount };
}

function inferStatus(payload) {
  const paymentStatus = String(findDeep(payload, ['paymentStatus', 'payment_status']) || '').toLowerCase();
  const subscriptionStatus = String(findDeep(payload, ['subscriptionStatus', 'subscription_status']) || '').toLowerCase();

  return (
    readPath(payload, 'onboarding.allowed') === true ||
    readPath(payload, 'onboardingAllowed') === true ||
    (paymentStatus === 'paid' && ['active', 'trialing'].includes(subscriptionStatus))
  );
}

function getCompanyName(payload) {
  return (
    findDeep(payload, ['company_name', 'companyName', 'company']) ||
    readPath(payload, 'metadata.company_name') ||
    'Empresa em implantação'
  );
}

async function fetchJson(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  const payload = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

function render(payload = {}, options = {}) {
  const root = document.getElementById('root') || document.body;
  const plan = inferPlan(payload);
  const companyName = getCompanyName(payload);
  const provisioning = payload && payload.provisioning ? payload.provisioning : null; // __AUTOATENDE_STRIPE_PHASE2R_D5C_ONBOARDING_PROVISIONING_STATUS_BRIDGE__
  const provisioningStatusLabel = provisioning && provisioning.publicStatusLabel ? provisioning.publicStatusLabel : 'Aguardando registro na fila de implantação';
  const provisioningNextStep = provisioning && provisioning.nextStep ? provisioning.nextStep : 'Assim que o pagamento for processado, sua contratação entra na fila interna de provisionamento.';
  const hasSession = Boolean(options.sessionId);
  const confirmed = inferStatus(payload);

  root.innerHTML = `
    <main class="aa-operational-onboarding" data-aa-page="operational-onboarding" data-marker="${MARKER}">
      <div class="aa-operational-onboarding__wrap">
        <section class="aa-operational-onboarding__hero">
          <div class="aa-operational-onboarding__panel">
            <span class="aa-operational-onboarding__eyebrow">Implantação assistida</span>
            <h1>Próximo passo: preparar sua operação real.</h1>
            <p class="aa-operational-onboarding__lead">
              O pagamento não encerra a contratação. Ele abre a etapa de implantação:
              alinhamento humano, coleta dos dados da empresa, conexão do WhatsApp,
              configuração do assistente, teste assistido e liberação gradual para operação.
            </p>
            <div class="aa-operational-onboarding__actions">
              <a class="aa-operational-onboarding__button aa-operational-onboarding__button--primary" href="/dashboard">Ir para o painel</a>
              <a class="aa-operational-onboarding__button aa-operational-onboarding__button--ghost" href="/billing">Ver plano</a>
            </div>
            <p class="aa-operational-onboarding__note">
              A equipe da AutoAtendeAI fará o contato inicial pelo WhatsApp informado na contratação.
            </p>
          </div>

          <aside class="aa-operational-onboarding__status">
            <p class="aa-operational-onboarding__status-title">Status da contratação</p>
            <strong>${confirmed ? 'Pagamento confirmado' : hasSession ? 'Em validação' : 'Sessão não informada'}</strong>
            <p>
              ${confirmed
                ? 'Sua implantação pode seguir para a fila operacional da AutoAtendeAI.'
                : hasSession
                  ? 'Ainda não foi possível confirmar o pagamento nesta tela. Se você acabou de pagar, aguarde a confirmação automática.'
                  : 'Abra esta página pelo link pós-pagamento para ver a validação automática da contratação.'}
            </p>
            <span class="aa-operational-onboarding__badge">${confirmed ? 'Onboarding liberado' : 'Aguardando validação'}</span>
          </aside>
        </section>

        <section class="aa-operational-onboarding__grid" aria-label="Resumo da contratação">
          <article class="aa-operational-onboarding__card">
            <span>Empresa</span>
            <strong>${escapeHtml(companyName)}</strong>
          </article>
          <article class="aa-operational-onboarding__card">
            <span>Plano</span>
            <strong>${escapeHtml(plan.name)}</strong>
          </article>
          <article class="aa-operational-onboarding__card">
            <span>Primeira cobrança</span>
            <strong>${escapeHtml(money(plan.totalAmount))}</strong>
          </article>
        </section>

        <section class="aa-operational-onboarding__data-card" data-marker="__AUTOATENDE_STRIPE_PHASE2R_D5C_ONBOARDING_PROVISIONING_STATUS_BRIDGE__">
          <h3>Status da implantação</h3>
          <p class="aa-operational-onboarding__lead" style="margin: 0 0 10px; max-width: none;">
            ${escapeHtml(provisioningStatusLabel)}
          </p>
          <p class="aa-operational-onboarding__note" style="margin-top: 0;">
            ${escapeHtml(provisioningNextStep)}
          </p>
        </section>

        <section>
          <h2 class="aa-operational-onboarding__section-title">Fluxo de implantação</h2>
          <div class="aa-operational-onboarding__timeline">
            ${STEPS.map((step, index) => `
              <article class="aa-operational-onboarding__step">
                <div class="aa-operational-onboarding__index">${index + 1}</div>
                <div>
                  <h3>${escapeHtml(step[0])}</h3>
                  <p>${escapeHtml(step[1])}</p>
                </div>
              </article>
            `).join('')}
          </div>
        </section>

        <section class="aa-operational-onboarding__data-grid">
          <article class="aa-operational-onboarding__data-card">
            <h3>Dados que vamos alinhar</h3>
            <ul>
              <li>Nome comercial, nicho e contexto da empresa.</li>
              <li>Horários, regiões atendidas e principais serviços/produtos.</li>
              <li>Dúvidas frequentes, objeções e regras de atendimento.</li>
              <li>Responsáveis humanos e critérios de transbordo.</li>
              <li>Número oficial de WhatsApp e permissões de conexão.</li>
            </ul>
          </article>
          <article class="aa-operational-onboarding__data-card">
            <h3>O que ainda não é automático</h3>
            <ul>
              <li>A implantação não cria uma operação completa sem validação humana.</li>
              <li>A conexão WhatsApp precisa ser conferida antes de operar.</li>
              <li>O assistente só deve entrar em produção depois do teste assistido.</li>
              <li>A fila de provisionamento continua sendo acompanhada internamente.</li>
            </ul>
          </article>
        </section>
      </div>
    </main>
  `;
}

async function runFallbackIfNeeded() {
  if (!isOnboardingPath()) return;

  const officialPage = document.querySelector('[data-aa-page="operational-onboarding"]');

  if (officialPage) return;

  const sessionId = getSessionId();

  if (!sessionId) {
    render({}, { sessionId: '' });
    return;
  }

  try {
    const [statusResponse, sessionResponse, provisioningResponse] = await Promise.all([
      fetchJson(`/api/public/billing/checkout/status?session_id=${encodeURIComponent(sessionId)}`),
      fetchJson(`/api/public/billing/checkout/session/${encodeURIComponent(sessionId)}`),
      fetchJson(`/api/public/billing/onboarding/provisioning?session_id=${encodeURIComponent(sessionId)}`),
    ]);

    render(
      {
        ...(statusResponse.payload || {}),
        ...(sessionResponse.payload || {}),
        ...(provisioningResponse.payload || {}),
      },
      { sessionId }
    );
  } catch {
    render({}, { sessionId });
  }
}

function install() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (window.__AUTOATENDE_PHASE2R_D5B_OPERATIONAL_ONBOARDING_BRIDGE__) return;

  window.__AUTOATENDE_PHASE2R_D5B_OPERATIONAL_ONBOARDING_BRIDGE__ = true;
  window.__AUTOATENDE_PHASE2R_D5B_OPERATIONAL_ONBOARDING_BRIDGE_MARKER__ = MARKER;

  const schedule = () => {
    setTimeout(runFallbackIfNeeded, 350);
    setTimeout(runFallbackIfNeeded, 900);
    setTimeout(runFallbackIfNeeded, 1600);
  };

  schedule();

  window.addEventListener('load', schedule, { passive: true });
  window.addEventListener('popstate', schedule, { passive: true });
  window.addEventListener('hashchange', schedule, { passive: true });

  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function patchedPushState(...args) {
    const result = originalPushState.apply(this, args);
    schedule();
    return result;
  };

  window.history.replaceState = function patchedReplaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    schedule();
    return result;
  };
}

install();
