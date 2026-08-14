import React, { useEffect, useMemo, useState } from 'react';
import '../operationalOnboarding.css';

const MARKER = '__AUTOATENDE_STRIPE_PHASE2R_D5B_OPERATIONAL_ONBOARDING_FLOW_PAGE__';

const PLAN_FALLBACK = {
  essencial: {
    name: 'Essencial',
    monthlyAmount: 24990,
    implementationAmount: 49000,
  },
  profissional: {
    name: 'Profissional',
    monthlyAmount: 44990,
    implementationAmount: 69000,
  },
  pro: {
    name: 'Profissional',
    monthlyAmount: 44990,
    implementationAmount: 69000,
  },
  business: {
    name: 'Business',
    monthlyAmount: 69990,
    implementationAmount: 99000,
  },
};

const STEPS = [
  {
    title: 'Pagamento confirmado',
    description: 'A contratação paga libera a próxima etapa e registra a implantação para acompanhamento interno.',
  },
  {
    title: 'Entrada na fila de provisionamento',
    description: 'A equipe AutoAtendeAI acompanha o cadastro internamente antes de liberar a operação real.',
  },
  {
    title: 'Contato humano inicial',
    description: 'Primeiro alinhamento para entender sua empresa, urgência, número do WhatsApp e prioridade de implantação.',
  },
  {
    title: 'Coleta dos dados da empresa',
    description: 'Reunimos horários, serviços, dúvidas frequentes, tom de voz, regras de atendimento e responsáveis.',
  },
  {
    title: 'Configuração da empresa no sistema',
    description: 'Organizamos a estrutura da conta, usuários internos e base mínima para operar com segurança.',
  },
  {
    title: 'Conexão do WhatsApp',
    description: 'Validamos a conexão oficial antes de colocar qualquer atendimento em produção.',
  },
  {
    title: 'Configuração do assistente',
    description: 'Ajustamos comportamento, qualificação, respostas base, transbordo humano e limites operacionais.',
  },
  {
    title: 'Teste assistido',
    description: 'Simulamos conversas reais e corrigimos pontos de risco antes da liberação.',
  },
  {
    title: 'Liberação para operação real',
    description: 'Depois dos testes, a operação entra em uso com acompanhamento próximo nos primeiros atendimentos.',
  },
];

function money(cents) {
  const value = Number(cents || 0) / 100;

  if (!Number.isFinite(value) || value <= 0) return '—';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function readPath(obj, path) {
  try {
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  } catch {
    return undefined;
  }
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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

function inferPlanKey(payload) {
  const candidates = [
    readPath(payload, 'plan.key'),
    readPath(payload, 'plan.internalPlan'),
    readPath(payload, 'plan'),
    readPath(payload, 'planKey'),
    readPath(payload, 'internalPlan'),
    readPath(payload, 'metadata.plan'),
    readPath(payload, 'metadata.plan_key'),
    findDeep(payload, ['plan', 'planKey', 'plan_key', 'internalPlan']),
  ];

  const raw = normalize(candidates.find(Boolean));

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

  return {
    key,
    name: String(name || '').trim(),
    monthlyAmount,
    implementationAmount,
    totalAmount,
  };
}

function inferStatus(payload) {
  const paymentStatus = String(
    findDeep(payload, ['paymentStatus', 'payment_status']) ||
    readPath(payload, 'session.payment_status') ||
    ''
  ).toLowerCase();

  const subscriptionStatus = String(
    findDeep(payload, ['subscriptionStatus', 'subscription_status']) ||
    readPath(payload, 'subscription.status') ||
    ''
  ).toLowerCase();

  const onboardingAllowed =
    readPath(payload, 'onboarding.allowed') === true ||
    readPath(payload, 'onboardingAllowed') === true ||
    (paymentStatus === 'paid' && ['active', 'trialing'].includes(subscriptionStatus));

  return {
    paymentStatus,
    subscriptionStatus,
    onboardingAllowed,
  };
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

function getCompanyName(payload) {
  return (
    findDeep(payload, ['company_name', 'companyName', 'company']) ||
    readPath(payload, 'metadata.company_name') ||
    'Empresa em implantação'
  );
}

function mergePayloads(...items) {
  return items.reduce((acc, item) => {
    if (!item || typeof item !== 'object') return acc;
    return { ...acc, ...item };
  }, {});
}

async function fetchJson(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const payload = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

export default function OperationalOnboardingPage() {
  const [state, setState] = useState({
    loading: true,
    sessionId: '',
    statusResponse: null,
    sessionResponse: null,
    provisioningResponse: null,
    error: '',
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      const sessionId = getSessionId();

      if (!sessionId) {
        if (!alive) return;

        setState({
          loading: false,
          sessionId: '',
          statusResponse: null,
          sessionResponse: null,
          provisioningResponse: null,
          error: '',
        });

        return;
      }

      try {
        const [statusResponse, sessionResponse, provisioningResponse] = await Promise.all([
          fetchJson(`/api/public/billing/checkout/status?session_id=${encodeURIComponent(sessionId)}`),
          fetchJson(`/api/public/billing/checkout/session/${encodeURIComponent(sessionId)}`),
          fetchJson(`/api/public/billing/onboarding/provisioning?session_id=${encodeURIComponent(sessionId)}`),
        ]);

        if (!alive) return;

        setState({
          loading: false,
          sessionId,
          statusResponse,
          sessionResponse,
          provisioningResponse,
          error: '',
        });
      } catch (error) {
        if (!alive) return;

        setState({
          loading: false,
          sessionId,
          statusResponse: null,
          sessionResponse: null,
          provisioningResponse: null,
          error: 'Não conseguimos validar a sessão de checkout agora. A implantação seguirá pela fila interna se o pagamento foi confirmado.',
        });
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  const payload = useMemo(() => {
    return mergePayloads(
      state.statusResponse && state.statusResponse.payload,
      state.sessionResponse && state.sessionResponse.payload,
      state.provisioningResponse && state.provisioningResponse.payload
    );
  }, [state.statusResponse, state.sessionResponse, state.provisioningResponse]);

  const plan = useMemo(() => inferPlan(payload), [payload]);
  const status = useMemo(() => inferStatus(payload), [payload]);
  const companyName = useMemo(() => getCompanyName(payload), [payload]);
  const provisioning = payload && payload.provisioning ? payload.provisioning : null; // __AUTOATENDE_STRIPE_PHASE2R_D5C_ONBOARDING_PROVISIONING_STATUS_UI__
  const provisioningStatusLabel = provisioning && provisioning.publicStatusLabel ? provisioning.publicStatusLabel : 'Aguardando registro na fila de implantação';
  const provisioningNextStep = provisioning && provisioning.nextStep ? provisioning.nextStep : 'Assim que o pagamento for processado, sua contratação entra na fila interna de provisionamento.';

  const hasSession = Boolean(state.sessionId);
  const paymentConfirmed = status.onboardingAllowed;

  return (
    <main
      className="aa-operational-onboarding"
      data-aa-page="operational-onboarding"
      data-marker={MARKER}
    >
      <div className="aa-operational-onboarding__wrap">
        <section className="aa-operational-onboarding__hero">
          <div className="aa-operational-onboarding__panel">
            <span className="aa-operational-onboarding__eyebrow">
              Implantação assistida
            </span>

            <h1>
              Próximo passo: preparar sua operação real.
            </h1>

            <p className="aa-operational-onboarding__lead">
              O pagamento não encerra a contratação. Ele abre a etapa de implantação:
              alinhamento humano, coleta dos dados da empresa, conexão do WhatsApp,
              configuração do assistente, teste assistido e liberação gradual para operação.
            </p>

            <div className="aa-operational-onboarding__actions">
              <a className="aa-operational-onboarding__button aa-operational-onboarding__button--primary" href="/dashboard">
                Ir para o painel
              </a>
              <a className="aa-operational-onboarding__button aa-operational-onboarding__button--ghost" href="/billing">
                Ver plano
              </a>
            </div>

            <p className="aa-operational-onboarding__note">
              A equipe da AutoAtendeAI fará o contato inicial pelo WhatsApp informado na contratação.
              Evite alterar número, domínio ou dados da empresa antes desse primeiro alinhamento.
            </p>
          </div>

          <aside className="aa-operational-onboarding__status">
            <p className="aa-operational-onboarding__status-title">
              Status da contratação
            </p>

            {state.loading ? (
              <div className="aa-operational-onboarding__loading">
                Validando dados do checkout...
              </div>
            ) : state.error ? (
              <div className="aa-operational-onboarding__warning">
                {state.error}
              </div>
            ) : (
              <>
                <strong>
                  {paymentConfirmed ? 'Pagamento confirmado' : hasSession ? 'Em validação' : 'Sessão não informada'}
                </strong>

                <p>
                  {paymentConfirmed
                    ? 'Sua implantação pode seguir para a fila operacional da AutoAtendeAI.'
                    : hasSession
                      ? 'Ainda não foi possível confirmar o pagamento nesta tela. Se você acabou de pagar, aguarde a confirmação automática.'
                      : 'Abra esta página pelo link pós-pagamento para ver a validação automática da contratação.'}
                </p>

                <span className="aa-operational-onboarding__badge">
                  {paymentConfirmed ? 'Onboarding liberado' : 'Aguardando validação'}
                </span>
              </>
            )}
          </aside>
        </section>

        <section className="aa-operational-onboarding__grid" aria-label="Resumo da contratação">
          <article className="aa-operational-onboarding__card">
            <span>Empresa</span>
            <strong>{companyName}</strong>
          </article>

          <article className="aa-operational-onboarding__card">
            <span>Plano</span>
            <strong>{plan.name}</strong>
          </article>

          <article className="aa-operational-onboarding__card">
            <span>Primeira cobrança</span>
            <strong>{money(plan.totalAmount)}</strong>
          </article>
        </section>

        <section className="aa-operational-onboarding__data-card" data-marker="__AUTOATENDE_STRIPE_PHASE2R_D5C_ONBOARDING_PROVISIONING_STATUS_UI__">
          <h3>Status da implantação</h3>
          <p className="aa-operational-onboarding__lead" style={{ margin: '0 0 10px', maxWidth: 'none' }}>
            {provisioningStatusLabel}
          </p>
          <p className="aa-operational-onboarding__note" style={{ marginTop: 0 }}>
            {provisioningNextStep}
          </p>
        </section>

        <section>
          <h2 className="aa-operational-onboarding__section-title">
            Fluxo de implantação
          </h2>

          <div className="aa-operational-onboarding__timeline">
            {STEPS.map((step, index) => (
              <article className="aa-operational-onboarding__step" key={step.title}>
                <div className="aa-operational-onboarding__index">
                  {index + 1}
                </div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="aa-operational-onboarding__data-grid">
          <article className="aa-operational-onboarding__data-card">
            <h3>Dados que vamos alinhar</h3>
            <ul>
              <li>Nome comercial, nicho e contexto da empresa.</li>
              <li>Horários, regiões atendidas e principais serviços/produtos.</li>
              <li>Dúvidas frequentes, objeções e regras de atendimento.</li>
              <li>Responsáveis humanos e critérios de transbordo.</li>
              <li>Número oficial de WhatsApp e permissões de conexão.</li>
            </ul>
          </article>

          <article className="aa-operational-onboarding__data-card">
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
  );
}
