const supabase = require('../config/supabase');
const { isSupabaseAdminUnavailableError } = supabase;
const conversationWindowService = require('./conversationWindow.service');
const companyService = require('./company.service');
const AppError = require('../utils/AppError');

function getMonthYear(ts) {
  const d = (ts instanceof Date) ? ts : new Date(ts || Date.now());
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

async function tryConsumeUsage({ clientId, year, month, templatesDelta, conversationsDelta, templatesLimit, templateCategory = null, marketingTemplatesDelta = null, utilityAuthTemplatesDelta = null }) {
  const { data, error } = await supabase.rpc('try_consume_usage', {
    p_client_id: clientId,
    p_year: year,
    p_month: month,
    p_templates_delta: templatesDelta,
    p_conversations_delta: conversationsDelta,
    p_templates_limit: templatesLimit,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const normalizedRow = row || { allowed: true, templates_used: 0, conversations_used: 0, overage_templates: 0, reason: 'OK' };

  if (normalizedRow.allowed && Number(templatesDelta || 0) > 0) {
    try {
      const deltas = resolveTemplateCategoryUsageDeltas({
        templatesDelta,
        templateCategory,
        marketingTemplatesDelta,
        utilityAuthTemplatesDelta,
      });

      if (deltas.marketingDelta > 0 || deltas.utilityAuthDelta > 0) {
        await applyTemplateCategoryUsage({
          clientId,
          year,
          month,
          marketingDelta: deltas.marketingDelta,
          utilityAuthDelta: deltas.utilityAuthDelta,
        });
      }
    } catch (categoryUsageError) {
      if (isSupabaseAdminUnavailableError(categoryUsageError)) throw categoryUsageError;

      console.error('[C10G_R3D] template_category_usage_apply_failed', {
        message: categoryUsageError?.message || String(categoryUsageError),
        clientId,
        year,
        month,
      });
    }
  }

  return normalizedRow;
}

/* __AUTOATENDE_C10G_R3D_CATEGORY_USAGE_AUTHORITY__ */
function resolveTemplateCategoryUsageDeltas({
  templatesDelta,
  templateCategory = null,
  marketingTemplatesDelta = null,
  utilityAuthTemplatesDelta = null,
}) {
  const total = Math.max(Number(templatesDelta || 0), 0);

  const explicitMarketing = marketingTemplatesDelta == null ? null : Math.max(Number(marketingTemplatesDelta || 0), 0);
  const explicitUtilityAuth = utilityAuthTemplatesDelta == null ? null : Math.max(Number(utilityAuthTemplatesDelta || 0), 0);

  if (explicitMarketing != null || explicitUtilityAuth != null) {
    const marketingDelta = explicitMarketing || 0;
    const utilityAuthDelta = explicitUtilityAuth || 0;
    return {
      marketingDelta,
      utilityAuthDelta,
    };
  }

  const normalizedCategory = String(templateCategory || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[/-]+/g, '_');

  if (normalizedCategory === 'marketing' || normalizedCategory === 'mkt') {
    return {
      marketingDelta: total,
      utilityAuthDelta: 0,
    };
  }

  return {
    marketingDelta: 0,
    utilityAuthDelta: total,
  };
}

async function applyTemplateCategoryUsage({
  clientId,
  year,
  month,
  marketingDelta = 0,
  utilityAuthDelta = 0,
}) {
  const safeMarketingDelta = Math.max(Number(marketingDelta || 0), 0);
  const safeUtilityAuthDelta = Math.max(Number(utilityAuthDelta || 0), 0);

  if (safeMarketingDelta <= 0 && safeUtilityAuthDelta <= 0) {
    return { marketing_templates_used: 0, utility_auth_templates_used: 0 };
  }

  const { data: existing, error: selectError } = await supabase
    .from('monthly_usage')
    .select('client_id, year, month, marketing_templates_used, utility_auth_templates_used')
    .eq('client_id', clientId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (selectError) throw selectError;

  const currentMarketing = Math.max(Number(existing?.marketing_templates_used || 0), 0);
  const currentUtilityAuth = Math.max(Number(existing?.utility_auth_templates_used || 0), 0);

  const payload = {
    client_id: clientId,
    year,
    month,
    marketing_templates_used: currentMarketing + safeMarketingDelta,
    utility_auth_templates_used: currentUtilityAuth + safeUtilityAuthDelta,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('monthly_usage')
    .upsert(payload, { onConflict: 'client_id,year,month' })
    .select('marketing_templates_used, utility_auth_templates_used')
    .maybeSingle();

  if (error) throw error;

  return data || {
    marketing_templates_used: payload.marketing_templates_used,
    utility_auth_templates_used: payload.utility_auth_templates_used,
  };
}


async function authorizeAction({ companyId, type, contact, timestamp }) {
  const company = await companyService.getCompany(companyId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const subscription = await companyService.getSubscription(company.client_id);
  if (!subscription) {
    throw new AppError('No subscription found', 403, { code: 'NO_ACTIVE_PLAN' });
  }

  if (['past_due', 'unpaid'].includes(subscription.status)) {
    throw new AppError('Payment required', 402, {
      code: 'PAYMENT_REQUIRED',
      action: 'update_payment'
    });
  }

  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    throw new AppError('Subscription not active', 403, {
      code: 'NO_ACTIVE_PLAN',
      action: 'upgrade_plan'
    });
  }

  const plan = subscription.plan;
  if (!plan) {
    throw new AppError('No plan associated with subscription', 403, {
      code: 'NO_ACTIVE_PLAN',
      action: 'contact_support'
    });
  }

  const { active: windowActive } = await conversationWindowService.checkActiveWindow(companyId, contact);

  let cost = { conversations: 0, templates: 0 };

  switch (type) {
    case 'inbound':
      if (!windowActive) cost.conversations = 1;
      break;
    case 'template':
      cost.templates = 1;
      if (!windowActive) cost.conversations = 1;
      break;
    case 'message':
      if (!windowActive) {
        throw new AppError('Session message not allowed outside 24h window', 403, { code: 'WINDOW_CLOSED' });
      }
      break;
    default:
      throw new AppError('Invalid action type', 400);
  }

  if (cost.conversations === 0 && cost.templates === 0) {
    return { authorized: true, cost };
  }

  const { month, year } = getMonthYear(timestamp || new Date());
  const templatesLimit = plan.templates_limit ?? 0;

  try {
    const result = await tryConsumeUsage({
      clientId: company.client_id,
      year,
      month,
      templatesDelta: cost.templates,
      conversationsDelta: cost.conversations,
      templatesLimit
    });

    if (!result.allowed && (result.reason === 'INVALID_CLIENT_ID' || result.reason === 'UNKNOWN_CLIENT')) {
      throw new AppError('Invalid client_id', 500, { code: 'STRUCTURAL_FAILURE' });
    }

    return {
      authorized: true,
      cost,
      usage: {
        templatesUsed: result.templates_used ?? 0,
        conversationsUsed: result.conversations_used ?? 0,
        overageTemplates: result.overage_templates ?? 0,
        reason: result.reason || 'OK'
      }
    };
  } catch (err) {
    if (isSupabaseAdminUnavailableError(err)) throw err;

    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Usage] degraded: RPC try_consume_usage failed, allowing in non-production', {
        message: err?.message
      });
      return { authorized: true, cost, degraded: true };
    }
    throw err;
  }
}


async function consumeTemplateUsageByCategory({
  companyId,
  templateCategory = 'utility_auth',
  quantity = 1,
  timestamp = new Date()
}) {
  const company = await companyService.getCompany(companyId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const subscription = await companyService.getSubscription(company.client_id);
  if (!subscription) {
    throw new AppError('No subscription found', 403, { code: 'NO_ACTIVE_PLAN' });
  }

  if (['past_due', 'unpaid'].includes(subscription.status)) {
    throw new AppError('Payment required', 402, {
      code: 'PAYMENT_REQUIRED',
      action: 'update_payment'
    });
  }

  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    throw new AppError('Subscription not active', 403, {
      code: 'NO_ACTIVE_PLAN',
      action: 'upgrade_plan'
    });
  }

  const plan = subscription.plan;
  if (!plan) {
    throw new AppError('No plan associated with subscription', 403, {
      code: 'NO_ACTIVE_PLAN',
      action: 'contact_support'
    });
  }

  const { month, year } = getMonthYear(timestamp || new Date());
  const templatesLimit = plan?.templates_limit ?? 0;
  const safeQuantity = Math.max(Number(quantity || 1), 1);

  try {
    const result = await tryConsumeUsage({
      clientId: company.client_id,
      year,
      month,
      templatesDelta: safeQuantity,
      conversationsDelta: 0,
      templatesLimit,
      templateCategory
    });

    return {
      allowed: true,
      reason: result.reason || 'OK',
      usage: {
        templatesUsed: result.templates_used ?? 0,
        conversationsUsed: result.conversations_used ?? 0,
        overageTemplates: result.overage_templates ?? 0
      }
    };
  } catch (err) {
    if (isSupabaseAdminUnavailableError(err)) throw err;

    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Usage] degraded: consumeTemplateUsageByCategory failed in non-production', {
        message: err?.message
      });
      return { allowed: true, degraded: true };
    }
    throw err;
  }
}

async function consumeUsage(params) {
  const { clientId, isNewConversation, requiresTemplate, plan } = params;

  const { month, year } = getMonthYear(new Date());
  const templatesDelta = requiresTemplate ? 1 : 0;
  const conversationsDelta = isNewConversation ? 1 : 0;
  const templatesLimit = plan?.templates_limit ?? 0;

  try {
    const result = await tryConsumeUsage({
      clientId,
      year,
      month,
      templatesDelta,
      conversationsDelta,
      templatesLimit
    });

    return {
      allowed: true,
      reason: result.reason,
      usage: {
        templatesUsed: result.templates_used ?? 0,
        conversationsUsed: result.conversations_used ?? 0,
        overageTemplates: result.overage_templates ?? 0
      }
    };
  } catch (err) {
    if (isSupabaseAdminUnavailableError(err)) throw err;

    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Usage] degraded: RPC try_consume_usage failed in consumeUsage, allowing in non-production', {
        message: err?.message
      });
      return { allowed: true, degraded: true };
    }
    throw err;
  }
}

module.exports = {
  authorizeAction,
  consumeUsage,
  consumeTemplateUsageByCategory,
  getMonthYear
};
