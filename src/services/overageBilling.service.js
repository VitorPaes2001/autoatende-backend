const stripe = require('../config/stripe');
const supabase = require('../config/supabase');
const { OVERAGE_TEMPLATE_PRICE_BRL_CENTS, getPlanByName } = require('../config/plans');
const companyService = require('./company.service');

function getPeriod(date = new Date()) {
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

async function getMonthlyUsage(clientId, { month, year }) {
  const { data } = await supabase
    .from('monthly_usage')
    .select('templates_used, conversations_used, overage_templates')
    .eq('client_id', clientId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  return {
    templatesUsed: data?.templates_used || 0,
    conversationsUsed: data?.conversations_used || 0,
    overageTemplates: data?.overage_templates || 0
  };
}

async function getPlanLimitByClient(clientId) {
  const subscription = await companyService.getSubscription(clientId);
  if (subscription?.plan?.templates_limit) {
    return subscription.plan.templates_limit;
  }

  const { data: company } = await supabase
    .from('companies')
    .select('plan')
    .eq('client_id', clientId)
    .maybeSingle();

  return getPlanByName(company?.plan).limits.templates;
}

async function getMonthlyUsageSummary(clientId, period = getPeriod()) {
  const planTemplatesLimit = await getPlanLimitByClient(clientId);
  const usage = await getMonthlyUsage(clientId, period);
  const computedOverage = Math.max(usage.templatesUsed - planTemplatesLimit, 0);

  return {
    year: period.year,
    month: period.month,
    templatesLimit: planTemplatesLimit,
    templatesUsed: usage.templatesUsed,
    conversationsUsed: usage.conversationsUsed,
    overageTemplates: Math.max(usage.overageTemplates, computedOverage),
    overageAmountBrlCents: Math.max(usage.overageTemplates, computedOverage) * OVERAGE_TEMPLATE_PRICE_BRL_CENTS,
    overageUnitAmountBrlCents: OVERAGE_TEMPLATE_PRICE_BRL_CENTS
  };
}

async function chargeMonthlyOverage({ clientId, month, year, dryRun = false }) {
  const summary = await getMonthlyUsageSummary(clientId, { month, year });

  if (summary.overageTemplates <= 0) {
    return { billed: false, reason: 'NO_OVERAGE', summary };
  }

  const { data: existing } = await supabase
    .from('monthly_overage_invoice_items')
    .select('*')
    .eq('client_id', clientId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  if (existing?.stripe_invoice_item_id) {
    return { billed: false, reason: 'ALREADY_BILLED', invoiceItemId: existing.stripe_invoice_item_id, summary };
  }

  const subscription = await companyService.getSubscription(clientId);
  const customerId = subscription?.stripe_customer_id;

  if (!customerId) {
    return { billed: false, reason: 'MISSING_CUSTOMER', summary };
  }

  const amount = summary.overageAmountBrlCents;
  const description = `Excedente de templates ${String(month).padStart(2, '0')}/${year} - ${summary.overageTemplates} template(s)`;

  if (dryRun) {
    return { billed: false, reason: 'DRY_RUN', summary, payload: { customerId, amount, description } };
  }

  const invoiceItem = await stripe.invoiceItems.create({
    customer: customerId,
    currency: 'brl',
    amount,
    description,
    metadata: {
      client_id: clientId,
      month: String(month),
      year: String(year),
      type: 'template_overage_v1'
    }
  }, {
    idempotencyKey: `overage:${clientId}:${year}-${month}`
  });

  await supabase
    .from('monthly_overage_invoice_items')
    .upsert({
      client_id: clientId,
      month,
      year,
      overage_templates: summary.overageTemplates,
      unit_amount_cents: OVERAGE_TEMPLATE_PRICE_BRL_CENTS,
      amount_cents: amount,
      stripe_invoice_item_id: invoiceItem.id,
      status: 'billed',
      updated_at: new Date().toISOString()
    }, { onConflict: 'client_id,year,month' });

  return { billed: true, invoiceItemId: invoiceItem.id, summary };
}

module.exports = {
  getPeriod,
  getMonthlyUsageSummary,
  chargeMonthlyOverage
};
