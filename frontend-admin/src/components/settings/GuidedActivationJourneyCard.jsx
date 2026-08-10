import React from 'react';

const STORAGE_KEY = 'aa_activation_journey_v1';

const AUTO_SAFE_STEPS = new Set(['whatsapp_connect', 'assistant_central']);
const HYBRID_STEPS = new Set(['onboarding_comercial', 'perfil_comercial']);

const STEP_REQUIREMENTS = {
  onboarding_comercial: [
    { key: 'companyName', label: 'nome da empresa' },
    { key: 'targetAudience', label: 'público-alvo' },
    { key: 'companyContext', label: 'contexto da empresa' },
    { key: 'guidance', label: 'orientação do negócio' }
  ],
  perfil_comercial: [
    { key: 'companyName', label: 'nome da empresa' },
    { key: 'toneOfVoice', label: 'tom de voz' },
    { key: 'targetAudience', label: 'público-alvo' },
    { key: 'guidance', label: 'orientação do negócio' }
  ]
};

const STEPS = [
  {
    id: 'onboarding_comercial',
    title: 'Onboarding comercial',
    description: 'Defina o contexto comercial base da empresa e alinhe a proposta antes de avançar.',
    href: '/configuracoes/onboarding-comercial',
    cta: 'Abrir onboarding'
  },
  {
    id: 'perfil_comercial',
    title: 'Perfil comercial',
    description: 'Revise e refine as informações do perfil comercial que sustentam a comunicação do assistente.',
    href: '/configuracoes/perfil-comercial',
    cta: 'Abrir perfil comercial'
  },
  {
    id: 'whatsapp_connect',
    title: 'Conectar WhatsApp',
    description: 'Conecte o canal que será usado na operação real antes de validar a ativação completa.',
    href: '/configuracoes/whatsapp',
    cta: 'Abrir conexão WhatsApp'
  },
  {
    id: 'assistant_central',
    title: 'Central do assistente',
    description: 'Ajuste comportamento, qualificação, transbordo e a base editorial do assistente.',
    href: '/configuracoes/assistente-central',
    cta: 'Abrir central do assistente'
  },
  {
    id: 'assistant_test',
    title: 'Teste do assistente',
    description: 'Valide o comportamento configurado antes de colocar a operação em produção.',
    href: '/configuracoes/teste-assistente',
    cta: 'Abrir teste do assistente'
  }
];

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function loadManualState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveManualState(nextState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch {}
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

function buildHeaders() {
  const headers = { Accept: 'application/json' };
  const token = resolveAccessToken();
  const companyId = resolveCompanyId();

  if (token) headers.Authorization = `Bearer ${token}`;
  if (companyId) headers['x-company-id'] = companyId;

  return headers;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...buildHeaders(),
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

function normalizeConnectPayload(payload) {
  const raw = payload?.data || payload || {};
  const connected = Boolean(
    raw?.connected === true ||
    raw?.isConnected === true ||
    raw?.status === 'connected' ||
    raw?.connectionStatus === 'connected'
  );

  return {
    done: connected,
    detected: connected,
    detail: connected ? 'Conexão detectada automaticamente.' : 'Conexão ainda não detectada automaticamente.'
  };
}

function normalizeTextValue(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.filter(Boolean).join(' ').trim();
  return '';
}

function computeMissingFields(profileLike, stepId) {
  const requirements = STEP_REQUIREMENTS[stepId] || [];
  return requirements
    .filter((item) => !normalizeTextValue(profileLike?.[item.key]))
    .map((item) => item.label);
}

function buildHybridDetail(stepId, missingFields) {
  if (!missingFields.length) {
    return 'Sinal detectado com todos os campos mínimos preenchidos. A conclusão continua assistida nesta fase.';
  }
  if (missingFields.length === 1) {
    return `Falta 1 item para consolidar esta etapa: ${missingFields[0]}.`;
  }
  return `Faltam ${missingFields.length} itens para consolidar esta etapa: ${missingFields.join(', ')}.`;
}

function normalizeCommercialProfilePayload(payload) {
  const raw = payload?.data || payload || {};
  const meta = raw?.meta || payload?.meta || {};
  const published = raw?.published || payload?.published || {};
  const draft = raw?.draft || payload?.draft || {};
  const profileLike = raw?.profile || payload?.profile || raw || {};

  const publishHistory = raw?.publishHistory || meta?.publishHistory || [];
  const hasPublishedSignal = Boolean(
    meta?.lastPublishedAt ||
    meta?.lastPublishedVersion ||
    (Array.isArray(publishHistory) && publishHistory.length > 0) ||
    published?.companyName
  );

  const merged = {
    ...profileLike,
    ...draft,
    ...published
  };

  const onboardingMissing = computeMissingFields(merged, 'onboarding_comercial');
  const profileMissing = computeMissingFields(merged, 'perfil_comercial');

  return {
    assistantCentral: {
      done: hasPublishedSignal,
      detected: hasPublishedSignal,
      detail: hasPublishedSignal
        ? 'Publicação detectada automaticamente na Central do Assistente.'
        : 'Ainda não foi detectada publicação válida na Central do Assistente.'
    },
    onboardingComercial: {
      done: false,
      detected: onboardingMissing.length < STEP_REQUIREMENTS.onboarding_comercial.length,
      detail: buildHybridDetail('onboarding_comercial', onboardingMissing),
      missingFields: onboardingMissing
    },
    perfilComercial: {
      done: false,
      detected: profileMissing.length < STEP_REQUIREMENTS.perfil_comercial.length,
      detail: buildHybridDetail('perfil_comercial', profileMissing),
      missingFields: profileMissing
    }
  };
}

function statusMeta({ stepId, done, manualDone, signal }) {
  if (AUTO_SAFE_STEPS.has(stepId)) {
    if (signal.loading) return { label: 'Verificando', tone: 'neutral' };
    if (done) return { label: 'Concluído automaticamente', tone: 'success' };
    return { label: 'Pendente', tone: 'neutral' };
  }

  if (HYBRID_STEPS.has(stepId)) {
    if (manualDone) return { label: 'Concluído', tone: 'success' };
    if (signal.detected) return { label: 'Sinal detectado', tone: 'primary' };
    return { label: 'Pendente', tone: 'neutral' };
  }

  if (done) return { label: 'Concluído', tone: 'success' };
  return { label: 'Manual', tone: 'neutral' };
}

function badgeClass(tone) {
  if (tone === 'success') return 'aa-product-pill-success';
  if (tone === 'primary') return 'aa-product-pill-neutral aa-guided-activation-pill-primary';
  return 'aa-product-pill-neutral';
}

function buildReadinessSummary({ signalState, manualState }) {
  const hardBlockers = [];
  const advisoryItems = [];

  if (!signalState.whatsapp_connect.done) {
    hardBlockers.push({
      id: 'whatsapp_connect',
      label: 'Conectar WhatsApp',
      href: '/configuracoes/whatsapp'
    });
  }

  if (!signalState.assistant_central.done) {
    hardBlockers.push({
      id: 'assistant_central',
      label: 'Publicar a Central do Assistente',
      href: '/configuracoes/assistente-central'
    });
  }

  if (!manualState.onboarding_comercial && signalState.onboarding_comercial.missingFields?.length) {
    advisoryItems.push({
      id: 'onboarding_comercial',
      label: `Completar onboarding comercial (${signalState.onboarding_comercial.missingFields.length} pendência${signalState.onboarding_comercial.missingFields.length > 1 ? 's' : ''})`,
      href: '/configuracoes/onboarding-comercial'
    });
  }

  if (!manualState.perfil_comercial && signalState.perfil_comercial.missingFields?.length) {
    advisoryItems.push({
      id: 'perfil_comercial',
      label: `Completar perfil comercial (${signalState.perfil_comercial.missingFields.length} pendência${signalState.perfil_comercial.missingFields.length > 1 ? 's' : ''})`,
      href: '/configuracoes/perfil-comercial'
    });
  }

  if (!manualState.assistant_test) {
    advisoryItems.push({
      id: 'assistant_test',
      label: 'Executar teste do assistente',
      href: '/configuracoes/teste-assistente'
    });
  }

  if (hardBlockers.length > 0) {
    return {
      tone: 'blocked',
      title: 'Ativação bloqueada',
      summary: 'Ainda existem bloqueadores duros para colocar a empresa em operação.',
      nextAction: hardBlockers[0]
    };
  }

  if (advisoryItems.length > 0) {
    return {
      tone: 'warning',
      title: 'Pronta com pendências assistidas',
      summary: 'A base operacional principal já existe, mas ainda há ajustes recomendados antes da rotina ideal.',
      nextAction: advisoryItems[0]
    };
  }

  return {
    tone: 'ready',
    title: 'Pronta para operar',
    summary: 'A empresa já tem os elementos principais de ativação e não há pendências assistidas visíveis nesta jornada.',
    nextAction: { id: 'go_live', label: 'Ir para Inbox', href: '/inbox' }
  };
}

function readinessBadgeClass(tone) {
  if (tone === 'ready') return 'aa-product-pill-success';
  if (tone === 'warning') return 'aa-product-pill-neutral aa-guided-activation-pill-primary';
  return 'aa-product-pill-neutral aa-guided-activation-pill-blocked';
}

export default function GuidedActivationJourneyCard() {
  const [manualState, setManualState] = React.useState(() => loadManualState());
  const [signalState, setSignalState] = React.useState({
    whatsapp_connect: { loading: true, done: false, detected: false, detail: '' },
    assistant_central: { loading: true, done: false, detected: false, detail: '' },
    onboarding_comercial: { loading: true, done: false, detected: false, detail: '', missingFields: [] },
    perfil_comercial: { loading: true, done: false, detected: false, detail: '', missingFields: [] }
  });

  const fetchSignals = React.useCallback(async () => {
    const next = {
      whatsapp_connect: { loading: true, done: false, detected: false, detail: '' },
      assistant_central: { loading: true, done: false, detected: false, detail: '' },
      onboarding_comercial: { loading: true, done: false, detected: false, detail: '', missingFields: [] },
      perfil_comercial: { loading: true, done: false, detected: false, detail: '', missingFields: [] }
    };

    try {
      const whatsappCandidates = [
        '/api/whatsapp/connect',
        '/api/whatsapp/status',
        '/api/whatsapp'
      ];

      for (const url of whatsappCandidates) {
        try {
          const result = await fetchJson(url);
          if (result.ok || result.status === 200) {
            next.whatsapp_connect = {
              loading: false,
              ...normalizeConnectPayload(result.payload)
            };
            break;
          }
        } catch {}
      }
      if (next.whatsapp_connect.loading) {
        next.whatsapp_connect = {
          loading: false,
          done: false,
          detected: false,
          detail: 'Não foi possível validar a conexão automaticamente agora.'
        };
      }
    } catch {
      next.whatsapp_connect = {
        loading: false,
        done: false,
        detected: false,
        detail: 'Não foi possível validar a conexão automaticamente agora.'
      };
    }

    try {
      const profileCandidates = [
        '/api/company-commercial-profile',
        '/api/company-commercial-profiles'
      ];

      for (const url of profileCandidates) {
        try {
          const result = await fetchJson(url);
          if (result.ok || result.status === 200) {
            const normalized = normalizeCommercialProfilePayload(result.payload);
            next.assistant_central = { loading: false, ...normalized.assistantCentral };
            next.onboarding_comercial = { loading: false, ...normalized.onboardingComercial };
            next.perfil_comercial = { loading: false, ...normalized.perfilComercial };
            break;
          }
        } catch {}
      }

      if (next.assistant_central.loading) {
        next.assistant_central = {
          loading: false,
          done: false,
          detected: false,
          detail: 'Não foi possível validar automaticamente a publicação da Central do Assistente.'
        };
      }
      if (next.onboarding_comercial.loading) {
        next.onboarding_comercial = {
          loading: false,
          done: false,
          detected: false,
          detail: 'Sem sinal comercial suficiente para conclusão assistida.',
          missingFields: STEP_REQUIREMENTS.onboarding_comercial.map((item) => item.label)
        };
      }
      if (next.perfil_comercial.loading) {
        next.perfil_comercial = {
          loading: false,
          done: false,
          detected: false,
          detail: 'Sem sinal de perfil suficiente para conclusão assistida.',
          missingFields: STEP_REQUIREMENTS.perfil_comercial.map((item) => item.label)
        };
      }
    } catch {
      next.assistant_central = {
        loading: false,
        done: false,
        detected: false,
        detail: 'Não foi possível validar automaticamente a publicação da Central do Assistente.'
      };
      next.onboarding_comercial = {
        loading: false,
        done: false,
        detected: false,
        detail: 'Sem sinal comercial suficiente para conclusão assistida.',
        missingFields: STEP_REQUIREMENTS.onboarding_comercial.map((item) => item.label)
      };
      next.perfil_comercial = {
        loading: false,
        done: false,
        detected: false,
        detail: 'Sem sinal de perfil suficiente para conclusão assistida.',
        missingFields: STEP_REQUIREMENTS.perfil_comercial.map((item) => item.label)
      };
    }

    setSignalState(next);
  }, []);

  React.useEffect(() => {
    fetchSignals();

    const handleFocus = () => fetchSignals();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchSignals]);

  const markStep = React.useCallback((stepId, done) => {
    setManualState((prev) => {
      const next = { ...prev, [stepId]: done };
      saveManualState(next);
      return next;
    });
  }, []);

  const resetJourney = React.useCallback(() => {
    setManualState({});
    saveManualState({});
  }, []);

  const goToStep = React.useCallback((href) => {
    if (!href) return;
    window.location.assign(href);
  }, []);

  const effectiveDoneMap = React.useMemo(() => {
    return {
      onboarding_comercial: Boolean(manualState.onboarding_comercial),
      perfil_comercial: Boolean(manualState.perfil_comercial),
      whatsapp_connect: Boolean(signalState.whatsapp_connect.done),
      assistant_central: Boolean(signalState.assistant_central.done),
      assistant_test: Boolean(manualState.assistant_test)
    };
  }, [manualState, signalState]);

  const completedCount = React.useMemo(
    () => STEPS.filter((step) => Boolean(effectiveDoneMap[step.id])).length,
    [effectiveDoneMap]
  );

  const progressPercent = React.useMemo(
    () => Math.round((completedCount / STEPS.length) * 100),
    [completedCount]
  );

  const firstPendingIndex = React.useMemo(
    () => STEPS.findIndex((step) => !effectiveDoneMap[step.id]),
    [effectiveDoneMap]
  );

  const nextStep = firstPendingIndex >= 0 ? STEPS[firstPendingIndex] : null;

  const readiness = React.useMemo(
    () => buildReadinessSummary({ signalState, manualState }),
    [signalState, manualState]
  );

  return (
    <section className="aa-brand-card aa-guided-activation-card p-6 aa-settings-r11b3-hidden-surface __AUTOATENDE_V4_R11B_R3_HIDE_REAL_OPERATIONAL_SURFACES_IN_SETTINGS__" data-aa-hidden-surface="ativacao_guiada">
      <div className="aa-brand-subcard aa-guided-readiness-card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between aa-settings-r11b3-hidden-surface __AUTOATENDE_V4_R11B_R3_HIDE_REAL_OPERATIONAL_SURFACES_IN_SETTINGS__" data-aa-hidden-surface="prontidao_operacional">
          <div className="min-w-0">
            <p className="aa-brand-kicker">Prontidão operacional</p>
            <h2 className="aa-brand-title mt-1 text-xl font-semibold">{readiness.title}</h2>
            <p className="aa-brand-copy mt-2 text-sm">{readiness.summary}</p>
          </div>

          <div className="flex flex-col items-start gap-3">
            <span className={readinessBadgeClass(readiness.tone)}>
              {readiness.tone === 'ready'
                ? 'Pronta'
                : readiness.tone === 'warning'
                  ? 'Pendências assistidas'
                  : 'Bloqueada'}
            </span>

            <button
              type="button"
              onClick={() => goToStep(readiness.nextAction.href)}
              className="aa-brand-btn-primary px-4 py-3 text-sm font-semibold"
            >
              {readiness.tone === 'ready' ? 'Ir para operação' : 'Resolver próxima ação'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="aa-brand-kicker">Ativação guiada</p>
          <h2 className="aa-brand-title mt-1 text-xl font-semibold">Sequência recomendada para colocar a empresa em operação</h2>
          <p className="aa-brand-copy mt-2 text-sm">
            Agora a jornada já usa sinais reais em WhatsApp e Central do Assistente. Onboarding e perfil comercial continuam assistidos, agora com indicação objetiva dos campos mínimos faltantes.
          </p>
        </div>

        <div className="aa-guided-activation-progress">
          <div className="aa-guided-activation-progress-top">
            <span className="aa-product-pill-neutral">{completedCount}/{STEPS.length} etapas concluídas</span>
            <span className="aa-guided-activation-progress-value">{progressPercent}%</span>
          </div>
          <div className="aa-guided-activation-progress-bar">
            <div className="aa-guided-activation-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {nextStep ? (
          <button
            type="button"
            onClick={() => goToStep(nextStep.href)}
            className="aa-brand-btn-primary px-4 py-3 text-sm font-semibold"
          >
            Continuar próxima etapa
          </button>
        ) : (
          <span className="aa-product-pill-success">Jornada concluída</span>
        )}

        <button
          type="button"
          onClick={fetchSignals}
          className="aa-brand-btn-secondary px-4 py-3 text-sm font-semibold"
        >
          Atualizar sinais
        </button>

        <button
          type="button"
          onClick={resetJourney}
          className="aa-brand-btn-secondary px-4 py-3 text-sm font-semibold"
        >
          Reiniciar progresso manual
        </button>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {STEPS.map((step, index) => {
          const signal = signalState[step.id] || { loading: false, detected: false, done: false, detail: '', missingFields: [] };
          const manualDone = Boolean(manualState[step.id]);
          const done = Boolean(effectiveDoneMap[step.id]);
          const status = statusMeta({ stepId: step.id, done, manualDone, signal });
          const canManualToggle = !AUTO_SAFE_STEPS.has(step.id);

          return (
            <article key={step.id} className="aa-brand-subcard aa-guided-activation-step p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="aa-brand-kicker">Etapa {index + 1}</p>
                  <h3 className="aa-brand-title mt-1 text-lg font-semibold">{step.title}</h3>
                </div>
                <span className={badgeClass(status.tone)}>{status.label}</span>
              </div>

              <p className="aa-brand-copy mt-3 text-sm">{step.description}</p>

              {signal.detail ? (
                <p className="aa-guided-activation-detail mt-3 text-sm">{signal.detail}</p>
              ) : null}

              {HYBRID_STEPS.has(step.id) && Array.isArray(signal.missingFields) && signal.missingFields.length > 0 ? (
                <div className="aa-guided-activation-missing mt-3">
                  <p className="aa-guided-activation-missing-title">Itens faltantes</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {signal.missingFields.map((item) => (
                      <span key={item} className="aa-product-pill-neutral">{item}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => goToStep(step.href)}
                  className="aa-brand-btn-primary px-4 py-3 text-sm font-semibold"
                >
                  {step.cta}
                </button>

                {canManualToggle ? (
                  done ? (
                    <button
                      type="button"
                      onClick={() => markStep(step.id, false)}
                      className="aa-brand-btn-secondary px-4 py-3 text-sm font-semibold"
                    >
                      Marcar como pendente
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => markStep(step.id, true)}
                      className="aa-brand-btn-secondary px-4 py-3 text-sm font-semibold"
                    >
                      Marcar como concluída
                    </button>
                  )
                ) : (
                  <span className="aa-product-pill-neutral">Auto por sinal real</span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="aa-brand-subcard mt-5 p-5">
        <p className="aa-brand-copy text-sm">
          Fase atual da ativação: WhatsApp e Central do Assistente já usam sinais reais. Onboarding e perfil comercial continuam assistidos, agora com indicação objetiva dos campos mínimos faltantes. O teste do assistente permanece manual por enquanto.
        </p>
      </div>
    </section>
  );
}
