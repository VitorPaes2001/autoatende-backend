/* __AUTOATENDE_C6C_R2_BILLING_PORTAL_RATE_LIMIT_AND_UX__ */
/* __AUTOATENDE_C5B1_R3_BILLING_SHELL__ */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CreditCard, CheckCircle, AlertTriangle, BarChart3, Users, MessageSquare, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { analytics } from '../lib/analytics';

// __AUTOATENDE_STRIPE_PHASE2R_D5H_B3_R7_DIRECT_BILLING_PAGE_ROBUST_TEMPLATE_LIMITS_FIX__
function aaBillingFirstPositive(...values) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;

    if (typeof value === 'string') {
      const parsed = Number(value.trim().replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }

  return 0;
}

// __AUTOATENDE_V4_R22C_B_R3_RECOVER_AND_APPLY_SAFE_INBOX_BILLING_GUARD__
const aaR22cBDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function aaR22cBFetchJsonWith429Retry(url, options = {}, retries = 1) {
  const response = await fetch(url, options);

  if (response.status === 429 && retries > 0) {
    await aaR22cBDelay(900);
    return aaR22cBFetchJsonWith429Retry(url, options, retries - 1);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      response.status === 429
        ? 'O carregamento do plano recebeu muitas solicitações em sequência. Tente novamente em alguns segundos.'
        : payload?.error || payload?.message || 'Não foi possível carregar os dados do plano.'
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}
// END __AUTOATENDE_V4_R22C_B_R3_RECOVER_AND_APPLY_SAFE_INBOX_BILLING_GUARD__

const __AUTOATENDE_C10F_R1_FIX_BILLINGPAGE_CANONICAL_COMMERCIAL_CARD__ = true;

const formatBillingCommercialNumber = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '—';
  return new Intl.NumberFormat('pt-BR').format(numericValue);
};
const __AUTOATENDE_C10C_R1_LIMIT_ALIGNMENT__ = true;
const __AUTOATENDE_C10B_R2B_SAFE_LABEL_ALIGNMENT__ = true;
const __AUTOATENDE_C10H_R2_BILLING_UI_HONESTY_PATCH__ = true;

const BillingPage = () => {
  const { session, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchBillingStatus = React.useCallback(async () => {
    try {
      console.log('[BillingPage] Fetching status...');
      const token = session?.access_token;
      console.log('[BillingPage] Token:', token ? 'Present' : 'Missing');
      
      const result = await aaR22cBFetchJsonWith429Retry('/api/billing/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setData(result);

      if (result.blocked?.isBlocked) {
        analytics.track('blocked_limit', {
          reason: result.blocked.reason,
          action: result.blocked.action
        });
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (user && !analytics.initialized) analytics.init(user);
    analytics.track('opened_billing_page');
    fetchBillingStatus();
  }, [fetchBillingStatus, user]);

  const handlePortalRedirect = async () => {
    if (portalLoading) return;

    setPortalLoading(true);
    analytics.track('clicked_upgrade', { source: 'billing_page_manage_button' });

    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          returnUrl: window.location.href
        })
      });

      let result = null;
      try {
        result = await response.json();
      } catch (_) {
        result = null;
      }

      if (!response.ok) {
        throw new Error(result?.message || result?.error || `Falha ao abrir o portal (${response.status})`);
      }

      const redirectUrl =
        result?.url ||
        result?.portalUrl ||
        result?.redirectUrl ||
        result?.sessionUrl ||
        null;

      if (!redirectUrl) {
        throw new Error(result?.message || 'URL de redirecionamento não encontrada');
      }

      window.location.href = redirectUrl;
    } catch (err) {
      alert('Erro ao redirecionar para o portal: ' + (err?.message || 'Falha desconhecida'));
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-700 rounded-lg">
        <h3 className="text-lg font-bold flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          Erro
        </h3>
        <p>{error}</p>
        <button 
          onClick={fetchBillingStatus}
          className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 rounded text-sm font-medium transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { plan, status, limits = {}, usage = {}, blocked = {} } = data;
  const agentsUsed = usage.agents || 0;
  const agentsLimit = limits.agents || data?.commercial?.included?.agents || 0;
  const billingFocusLayoutMarker = '__AUTOATENDE_R12C4_BILLING_FOCUS_LAYOUT__';
  const billingLayoutRebalanceMarker = '__AUTOATENDE_R12C5_BILLING_LAYOUT_REBALANCE__';
  const commercialIncluded = data?.commercial?.included || {};
  const marketingIncluded = aaBillingFirstPositive(
    commercialIncluded.marketingTemplates,
    commercialIncluded.marketing_templates_limit,
    commercialIncluded.marketing_templates,
    commercialIncluded.marketingLimit,
    commercialIncluded.marketing_limit,

    limits.marketingTemplates,
    limits.marketing_templates_limit,
    limits.marketing_templates,
    limits.marketingLimit,
    limits.marketing_limit,

    data?.marketing_templates_limit,
    data?.marketingTemplatesLimit,
    data?.marketing_templates,
    data?.marketingTemplates,

    0,
  );
  const utilityAuthIncluded = aaBillingFirstPositive(
    commercialIncluded.utilityAuthTemplates,
    commercialIncluded.utilityAuthenticationTemplates,
    commercialIncluded.authenticationTemplates,
    commercialIncluded.utility_templates_limit,
    commercialIncluded.utility_authentication_templates_limit,
    commercialIncluded.authentication_templates_limit,
    commercialIncluded.utility_templates,
    commercialIncluded.utility_authentication_templates,
    commercialIncluded.authentication_templates,
    commercialIncluded.utilityLimit,
    commercialIncluded.utilityAuthenticationLimit,
    commercialIncluded.authenticationLimit,
    commercialIncluded.utility_limit,
    commercialIncluded.utility_authentication_limit,
    commercialIncluded.authentication_limit,

    limits.utilityAuthTemplates,
    limits.utilityAuthenticationTemplates,
    limits.authenticationTemplates,
    limits.utility_templates_limit,
    limits.utility_authentication_templates_limit,
    limits.authentication_templates_limit,
    limits.utility_templates,
    limits.utility_authentication_templates,
    limits.authentication_templates,
    limits.utilityLimit,
    limits.utilityAuthenticationLimit,
    limits.authenticationLimit,
    limits.utility_limit,
    limits.utility_authentication_limit,
    limits.authentication_limit,

    data?.utility_templates_limit,
    data?.utilityTemplatesLimit,
    data?.utility_authentication_templates_limit,
    data?.utilityAuthenticationTemplatesLimit,
    data?.authentication_templates_limit,
    data?.authenticationTemplatesLimit,
    data?.utility_templates,
    data?.utilityTemplates,
    data?.utility_authentication_templates,
    data?.utilityAuthenticationTemplates,
    data?.authentication_templates,
    data?.authenticationTemplates,

    0,
  );
  const marketingUsed = usage.marketingTemplates || 0;
  const utilityAuthUsed = usage.utilityAuthTemplates || 0;
  const overageTemplates = usage.overageTemplates || 0;
  const overageAmountBrl = Number(usage.overageAmountBrlCents || 0) > 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((usage.overageAmountBrlCents || 0) / 100)
    : null;
  const billingCategoryMarker = '__AUTOATENDE_R11A_BILLING_PAGE_CATEGORY_SURFACE__';


    const usagePct = (used, limit) => {
      const safeLimit = Number(limit || 0);
      if (!Number.isFinite(safeLimit) || safeLimit <= 0) return 0;
      return Math.min(Math.round((Number(used || 0) / safeLimit) * 100), 100);
    };

    const marketingPct = usagePct(marketingUsed, marketingIncluded);
    const utilityAuthPct = usagePct(utilityAuthUsed, utilityAuthIncluded);
    const agentsPct = usagePct(agentsUsed, agentsLimit);

    const addons = Array.isArray(data?.commercialAddons) ? data.commercialAddons : [];

    const cycleHealthLabel = blocked?.isBlocked
      ? 'Crítico'
      : overageTemplates > 0 || Number(usage?.overageAmountBrlCents || 0) > 0
        ? 'Atenção'
        : 'Saudável';

    const cycleHealthClass = blocked?.isBlocked
      ? 'border-red-200 bg-red-50 text-red-700'
      : overageTemplates > 0 || Number(usage?.overageAmountBrlCents || 0) > 0
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  const getStatusColor = (s) => {
    switch (s) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trialing': return 'bg-blue-100 text-blue-800';
      case 'past_due': return 'bg-red-100 text-red-800';
      case 'unpaid': return 'bg-red-100 text-red-800';
      case 'canceled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (s) => {
    const map = {
      active: 'Ativo',
      trialing: 'Em Teste',
      past_due: 'Pagamento Pendente',
      unpaid: 'Não Pago',
      canceled: 'Cancelado'
    };
    return map[s] || s;
  };

  const UsageBar = ({ label, icon: Icon, used, limit, color = "blue" }) => {
    const percentage = Math.min(Math.round((used / limit) * 100), 100);
    const isExceeded = used >= limit;
    
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center text-sm font-medium text-gray-700">
            <Icon className="w-4 h-4 mr-2 text-gray-500" />
            {label}
          </div>
          <span className={`text-xs font-bold ${isExceeded ? 'text-red-600' : 'text-gray-600'}`}>
            {used} / {limit} ({percentage}%)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className={`h-2.5 rounded-full transition-all duration-500 ${isExceeded ? 'bg-red-500' : `bg-${color}-600`}`} 
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>
    );
  };

  return (
    <div className="aa-page-shell aa-billing-clean max-w-6xl mx-auto space-y-6" data-aa-billing-clean="1">
      
      {/* Header */}
      <div className="flex justify-between items-center aa-billing-header-row" data-aa-billing-header-row="1">
        <div className="aa-page-hero aa-billing-header-copy">
          <h2 className="text-2xl font-bold text-gray-800">Assinatura e capacidade {/* __AUTOATENDE_V4_R9D_FIX_BILLING_INTERNAL_TITLE_COPY__ */}</h2>
          <p className="text-gray-500">Plano contratado, franquias disponíveis e portal de cobrança em um só lugar.</p>
        </div>
        <button
          onClick={handlePortalRedirect}
          disabled={portalLoading}
          className="aa-billing-cta flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {portalLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
          Gerenciar Assinatura
        </button>
      </div>

      {/* Blocked Alert */}
      {blocked?.isBlocked && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r shadow-sm">
          <div className="flex items-start">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-3 mt-0.5" />
            <div>
              <h3 className="text-red-800 font-bold">Serviço Interrompido</h3>
              <p className="text-red-700 text-sm mt-1">
                {blocked.reason === 'payment_required' && 'O pagamento da sua fatura falhou. Atualize seus dados para restaurar o acesso.'}
                {blocked.reason === 'limit_exceeded' && 'Você atingiu os limites do seu plano atual. Faça um upgrade para continuar usando.'}
                {!['payment_required', 'limit_exceeded'].includes(blocked.reason) && 'Sua conta possui restrições de acesso.'}
              </p>
              {blocked.action && (
                <button 
                  onClick={() => {
                    analytics.track('clicked_upgrade', { source: 'billing_page_blocked_banner' });
                    handlePortalRedirect();
                  }}
                  className="mt-3 text-sm font-semibold text-red-700 hover:text-red-900 underline"
                >
                  {blocked.action === 'update_payment' ? 'Atualizar Pagamento Agora →' : 'Fazer Upgrade Agora →'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 aa-billing-main-grid" data-aa-billing-main-grid="1">
        {/* Plan Info Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 aa-billing-summary-card">
            {/* __AUTOATENDE_C16L_B_R2_BILLING_PRODUCTIZATION__ */}
            <div className="flex items-start justify-between gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <CreditCard className="w-6 h-6 text-indigo-600" />
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                {getStatusLabel(status)}
              </span>
            </div>

            <h3 className="mt-4 text-gray-500 text-sm font-medium">Plano contratado</h3>
            <p className="text-3xl font-bold text-gray-900 mt-1 capitalize">
              {data?.planDisplayName || data?.commercial?.displayName || plan}
            </p>
            {data?.commercial?.priceLabel ? (
              <p className="text-sm text-gray-500 mt-1">{data.commercial.priceLabel} / mês</p>
            ) : null}

            <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-4 aa-billing-summary-franchise">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                Franquia contratada
              </p>
              <div className="mt-3 grid gap-3 aa-billing-summary-metrics">
                <div>
                  <p className="text-xs text-indigo-700/80">Marketing</p>
                  <p className="text-sm font-semibold text-indigo-950">
                    {formatBillingCommercialNumber(marketingIncluded)} incluídos
                  </p>
                </div>
                <div>
                  <p className="text-xs text-indigo-700/80">Utility / Authentication</p>
                  <p className="text-sm font-semibold text-indigo-950">
                    {formatBillingCommercialNumber(utilityAuthIncluded)} incluídos
                  </p>
                </div>
                <div>
                  <p className="text-xs text-indigo-700/80">Agentes</p>
                  <p className="text-sm font-semibold text-indigo-950">
                    Até {formatBillingCommercialNumber(agentsLimit)} agente(s)
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Leitura comercial
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cycleHealthClass}`}>
                  Saúde do ciclo: {cycleHealthLabel}
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                  Portal Stripe ativo
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Gestão do plano, leitura do ciclo atual e espaço para expansão via add-ons.
              </p>
            </div>

            {addons.length > 0 ? (
              <p className="mt-4 text-xs text-indigo-700">
                {addons.length} add-on(s) comercial(is) disponível(is) para expansão.
              </p>
            ) : null}
          </div>

        {/* Usage Stats */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 md:col-span-2 aa-billing-focus-panel" data-aa-billing-focus-panel={billingFocusLayoutMarker}>
            {/* __AUTOATENDE_C16L_B_R2_BILLING_PRODUCTIZATION__ */}
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Consumo do ciclo</h3>
                <p className="text-sm text-gray-500 mt-1">Leitura principal de franquias, capacidade e expansão.</p>
              </div>

              <div className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                Capacidade comercial
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3 aa-billing-cycle-grid">
              <div className="aa-billing-cycle-card rounded-xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/12 to-emerald-500/6 p-5 shadow-lg">
                <p className="text-xs uppercase tracking-wide font-semibold text-emerald-700">Marketing</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {formatBillingCommercialNumber(marketingUsed)} / {formatBillingCommercialNumber(marketingIncluded)}
                </p>
                <p className="mt-1 text-sm text-gray-600">Uso da franquia de marketing.</p>
                <div className="mt-3 aa-billing-progress-track">
                  <div className="aa-billing-progress-fill aa-billing-progress-fill--emerald" style={{ width: `${marketingPct}%` }}></div>
                </div>
                <p className="mt-2 text-xs font-semibold text-emerald-700">{marketingPct}% utilizado</p>
              </div>

              <div className="aa-billing-cycle-card rounded-xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/12 to-cyan-500/6 p-5 shadow-lg">
                <p className="text-xs uppercase tracking-wide font-semibold text-sky-700">Utility / Authentication</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {formatBillingCommercialNumber(utilityAuthUsed)} / {formatBillingCommercialNumber(utilityAuthIncluded)}
                </p>
                <p className="mt-1 text-sm text-gray-600">Uso da franquia utility/authentication.</p>
                <div className="mt-3 aa-billing-progress-track">
                  <div className="aa-billing-progress-fill aa-billing-progress-fill--cyan" style={{ width: `${utilityAuthPct}%` }}></div>
                </div>
                <p className="mt-2 text-xs font-semibold text-sky-700">{utilityAuthPct}% utilizado</p>
              </div>

              <div className="aa-billing-cycle-card rounded-xl border border-violet-400/20 bg-gradient-to-br from-violet-500/12 to-violet-500/6 p-5 shadow-lg">
                <p className="text-xs uppercase tracking-wide font-semibold text-violet-300">Agentes</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {formatBillingCommercialNumber(agentsUsed)} / {formatBillingCommercialNumber(agentsLimit)}
                </p>
                <p className="mt-1 text-sm text-gray-600">Usuários internos ativos no plano.</p>
                <div className="mt-3 aa-billing-progress-track">
                  <div className="aa-billing-progress-fill aa-billing-progress-fill--violet" style={{ width: `${agentsPct}%` }}></div>
                </div>
                <p className="mt-2 text-xs font-semibold text-violet-300">{agentsPct}% utilizado</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr] aa-billing-lower-grid">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs uppercase tracking-wide font-semibold text-slate-600">Leitura do ciclo</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cycleHealthClass}`}>
                    Saúde: {cycleHealthLabel}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                    Status: {getStatusLabel(status)}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                    Agentes ativos: {formatBillingCommercialNumber(agentsUsed)}
                  </span>
                </div>

                {overageTemplates > 0 || overageAmountBrl ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                    <p className="text-xs uppercase tracking-wide font-semibold text-amber-700">Excedente</p>
                    <p className="mt-2 text-lg font-bold text-amber-900">
                      {formatBillingCommercialNumber(overageTemplates)} template(s){overageAmountBrl ? ` · ${overageAmountBrl}` : ''}
                    </p>
                    <p className="mt-1 text-sm text-amber-800">Excedente calculado no ciclo atual.</p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-600">
                    Sem excedente calculado neste ciclo.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 p-4 aa-billing-addon-panel">
                <p className="text-xs uppercase tracking-wide font-semibold text-indigo-700">Add-ons e expansão</p>
                {addons.length > 0 ? (
                  <div className="mt-3 grid gap-2 aa-billing-addon-list">
                    {addons.slice(0, 4).map((addon, index) => (
                      <div
                        key={addon?.id || addon?.code || addon?.name || addon?.title || index}
                        className="aa-billing-addon-item rounded-lg border border-indigo-100 bg-white/80 px-3 py-3"
                      >
                        <p className="text-sm font-semibold text-indigo-950">
                          {addon?.label || addon?.name || addon?.title || 'Add-on disponível'}
                        </p>
                        <p className="mt-1 text-xs text-indigo-700/80">
                          {addon?.description || addon?.summary || 'Expansão comercial configurável para o plano.'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-indigo-900">
                    Nenhum add-on comercial está sendo exibido agora, mas a página já está preparada para expandir franquias e capacidade.
                  </p>
                )}
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default BillingPage;

/* __AUTOATENDE_C7E_R4D_BILLING_SEMANTIC_POLISH__ */
