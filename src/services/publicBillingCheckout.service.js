const crypto = require('crypto');
const stripe = require('../config/stripe');

const TEST_PRICE_IDS = {
  essencial: {
    monthly: 'price_1TqOb2GgAlIA1MzzxmpzUqCZ',
    implementation: 'price_1TqOb3GgAlIA1Mzz6HOYjGJA',
  },
  profissional: {
    monthly: 'price_1TqOb5GgAlIA1Mzz6xJZDXzP',
    implementation: 'price_1TqOb5GgAlIA1Mzz9p63W3Ab',
  },
  business: {
    monthly: 'price_1TqOb7GgAlIA1MzzNCO0R9CS',
    implementation: 'price_1TqOb7GgAlIA1Mzzr2kELC0f',
  },
};

const PLAN_DEFINITIONS = {
  essencial: {
    key: 'essencial',
    internalPlan: 'starter',
    displayName: 'Essencial',
    monthlyAmount: 24990,
    implementationAmount: 49000,
    monthlyEnv: ['STRIPE_PRICE_ESSENCIAL', 'STRIPE_PRICE_STARTER'],
    implementationEnv: ['STRIPE_PRICE_IMPLEMENTATION_ESSENCIAL', 'STRIPE_PRICE_IMPLEMENTATION_STARTER'],
    testMonthlyPriceId: TEST_PRICE_IDS.essencial.monthly,
    testImplementationPriceId: TEST_PRICE_IDS.essencial.implementation,
  },
  profissional: {
    key: 'profissional',
    internalPlan: 'pro',
    displayName: 'Profissional',
    monthlyAmount: 44990,
    implementationAmount: 69000,
    monthlyEnv: ['STRIPE_PRICE_PROFISSIONAL', 'STRIPE_PRICE_PRO'],
    implementationEnv: ['STRIPE_PRICE_IMPLEMENTATION_PROFISSIONAL', 'STRIPE_PRICE_IMPLEMENTATION_PRO'],
    testMonthlyPriceId: TEST_PRICE_IDS.profissional.monthly,
    testImplementationPriceId: TEST_PRICE_IDS.profissional.implementation,
  },
  business: {
    key: 'business',
    internalPlan: 'business',
    displayName: 'Business',
    monthlyAmount: 69990,
    implementationAmount: 99000,
    monthlyEnv: ['STRIPE_PRICE_BUSINESS'],
    implementationEnv: ['STRIPE_PRICE_IMPLEMENTATION_BUSINESS'],
    testMonthlyPriceId: TEST_PRICE_IDS.business.monthly,
    testImplementationPriceId: TEST_PRICE_IDS.business.implementation,
  },
};

const PLAN_ALIASES = {
  start: 'essencial',
  starter: 'essencial',
  essencial: 'essencial',
  essential: 'essencial',
  pro: 'profissional',
  profissional: 'profissional',
  professional: 'profissional',
  business: 'business',
};

function makePublicError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function cleanMetadataValue(value, maxLength = 240) {
  return normalizeString(value)
    .replace(/[\r\n\t]/g, ' ')
    .slice(0, maxLength);
}

function normalizeEmail(email) {
  return normalizeString(email).toLowerCase();
}

function normalizePlanKey(plan) {
  const raw = normalizeString(plan).toLowerCase();

  if (!raw) {
    throw makePublicError(400, 'PLAN_REQUIRED', 'Informe o plano desejado.');
  }

  const key = PLAN_ALIASES[raw];

  if (!key || !PLAN_DEFINITIONS[key]) {
    throw makePublicError(400, 'PLAN_INVALID', 'Plano inválido para contratação.');
  }

  return key;
}

function isTestStripeMode() {
  return String(process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_');
}

function resolvePriceId(planConfig, role) {
  const envNames = role === 'monthly'
    ? planConfig.monthlyEnv
    : planConfig.implementationEnv;

  for (const envName of envNames) {
    const value = normalizeString(process.env[envName]);
    if (value) return value;
  }

  if (isTestStripeMode()) {
    return role === 'monthly'
      ? planConfig.testMonthlyPriceId
      : planConfig.testImplementationPriceId;
  }

  throw makePublicError(500, 'PRICE_NOT_CONFIGURED', 'Preço não configurado para este plano.');
}

function getDefaultPublicUrl() {
  return normalizeString(process.env.PUBLIC_URL) || 'https://autoatendeai.com.br';
}

function withSessionPlaceholder(url) {
  if (url.includes('{CHECKOUT_SESSION_ID}')) return url;

  const joiner = url.includes('?') ? '&' : '?';
  return url + joiner + 'session_id={CHECKOUT_SESSION_ID}';
}

function isAllowedUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const allowedHosts = new Set([
      'autoatendeai.com.br',
      'www.autoatendeai.com.br',
      'app.autoatendeai.com.br',
      'localhost',
      '127.0.0.1',
    ]);

    return ['https:', 'http:'].includes(parsed.protocol) && allowedHosts.has(parsed.hostname);
  } catch (error) {
    return false;
  }
}

function resolveReturnUrls(input = {}) {
  const defaultPublicUrl = getDefaultPublicUrl().replace(/\/+$/, '');

  const defaultSuccessUrl =
    normalizeString(process.env.STRIPE_CHECKOUT_SUCCESS_URL) ||
    defaultPublicUrl + '/contratacao/sucesso?session_id={CHECKOUT_SESSION_ID}';

  const defaultCancelUrl =
    normalizeString(process.env.STRIPE_CHECKOUT_CANCEL_URL) ||
    defaultPublicUrl + '/contratacao/cancelada';

  let successUrl = normalizeString(input.successUrl) || defaultSuccessUrl;
  let cancelUrl = normalizeString(input.cancelUrl) || defaultCancelUrl;

  if (input.successUrl && !isAllowedUrl(successUrl)) {
    throw makePublicError(400, 'SUCCESS_URL_NOT_ALLOWED', 'URL de sucesso não permitida.');
  }

  if (input.cancelUrl && !isAllowedUrl(cancelUrl)) {
    throw makePublicError(400, 'CANCEL_URL_NOT_ALLOWED', 'URL de cancelamento não permitida.');
  }

  successUrl = withSessionPlaceholder(successUrl);

  return {
    successUrl,
    cancelUrl,
  };
}

function validateCheckoutInput(input) {
  const planKey = normalizePlanKey(input.plan);
  const email = normalizeEmail(input.email);
  const responsibleName = normalizeString(input.name || input.responsibleName);
  const companyName = normalizeString(input.companyName || input.company);
  const whatsapp = normalizeString(input.whatsapp || input.phone);
  const document = normalizeString(input.document || input.cpfCnpj || input.taxId);
  const acceptedTerms = input.acceptedTerms === true || input.acceptedTerms === 'true';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw makePublicError(400, 'EMAIL_INVALID', 'Informe um e-mail válido.');
  }

  if (!companyName) {
    throw makePublicError(400, 'COMPANY_REQUIRED', 'Informe o nome da empresa.');
  }

  if (!acceptedTerms) {
    throw makePublicError(400, 'TERMS_REQUIRED', 'É necessário aceitar os Termos de Uso.');
  }

  return {
    planKey,
    email,
    responsibleName: responsibleName || companyName,
    companyName,
    whatsapp,
    document,
    acceptedTerms,
    dryRun: input.dryRun === true || input.dryRun === 'true',
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  };
}

function normalizeCheckoutSessionId(value) {
  const sessionId = normalizeString(value);

  if (!/^cs_(test|live)_[A-Za-z0-9_]+$/.test(sessionId)) {
    throw makePublicError(400, 'CHECKOUT_SESSION_ID_INVALID', 'Sessão de checkout inválida.');
  }

  if (isTestStripeMode() && !sessionId.startsWith('cs_test_')) {
    throw makePublicError(400, 'CHECKOUT_SESSION_MODE_INVALID', 'Sessão incompatível com o modo Stripe atual.');
  }

  return sessionId;
}

async function findOrCreateCustomer(payload) {
  const existing = await stripe.customers.list({
    email: payload.email,
    limit: 1,
  });

  if (existing.data && existing.data.length > 0) {
    const customer = existing.data[0];

    try {
      await stripe.customers.update(customer.id, {
        name: payload.responsibleName || undefined,
        phone: payload.whatsapp || undefined,
        metadata: {
          aa_last_checkout_source: 'public_checkout',
          aa_company_name: cleanMetadataValue(payload.companyName),
          aa_phone: cleanMetadataValue(payload.whatsapp),
        },
      });
    } catch (error) {
      console.warn('[PublicBillingCheckout] Customer update skipped:', error.message);
    }

    return customer;
  }

  return stripe.customers.create({
    email: payload.email,
    name: payload.responsibleName || undefined,
    phone: payload.whatsapp || undefined,
    metadata: {
      aa_source: 'public_checkout',
      aa_company_name: cleanMetadataValue(payload.companyName),
      aa_phone: cleanMetadataValue(payload.whatsapp),
    },
  });
}

function getPublicPlans() {
  return Object.values(PLAN_DEFINITIONS).map((plan) => ({
    key: plan.key,
    internalPlan: plan.internalPlan,
    name: plan.displayName,
    monthlyAmount: plan.monthlyAmount,
    implementationAmount: plan.implementationAmount,
    currency: 'brl',
  }));
}

function getPlanByMetadataOrPrices(session, lineItems) {
  const metadataPlan = normalizeString(session?.metadata?.aa_plan_key).toLowerCase();
  const mappedFromMetadata = PLAN_ALIASES[metadataPlan];

  if (mappedFromMetadata && PLAN_DEFINITIONS[mappedFromMetadata]) {
    return PLAN_DEFINITIONS[mappedFromMetadata];
  }

  const priceIds = new Set();

  for (const item of lineItems?.data || []) {
    if (item?.price?.id) {
      priceIds.add(item.price.id);
    }
  }

  for (const plan of Object.values(PLAN_DEFINITIONS)) {
    const monthlyPriceId = resolvePriceId(plan, 'monthly');
    const implementationPriceId = resolvePriceId(plan, 'implementation');

    if (priceIds.has(monthlyPriceId) || priceIds.has(implementationPriceId)) {
      return plan;
    }
  }

  return null;
}

function buildGateToken(session, plan, expiresAt) {
  const secret =
    normalizeString(process.env.STRIPE_WEBHOOK_SECRET) ||
    normalizeString(process.env.STRIPE_SECRET_KEY) ||
    'autoatendeai-local-gate-secret';

  const payload = [
    session.id,
    session.customer || '',
    session.subscription || '',
    plan?.key || 'unknown',
    expiresAt,
  ].join('|');

  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

function getCustomerEmail(session, customer) {
  return normalizeString(
    session.customer_details?.email ||
    session.customer_email ||
    customer?.email ||
    ''
  );
}

function getCustomerName(session, customer) {
  return normalizeString(
    session.customer_details?.name ||
    customer?.name ||
    session.metadata?.aa_company_name ||
    ''
  );
}

function getCustomerPhone(session, customer) {
  return normalizeString(
    session.customer_details?.phone ||
    customer?.phone ||
    session.metadata?.aa_phone ||
    ''
  );
}

function getSubscriptionStatus(subscription) {
  if (!subscription) return 'missing';
  if (typeof subscription === 'string') return 'unexpanded';
  return normalizeString(subscription.status || 'unknown');
}

function isCheckoutPaid(session, subscription) {
  const sessionComplete = session.status === 'complete';
  const paymentPaid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
  const subscriptionStatus = getSubscriptionStatus(subscription);

  const subscriptionOk = [
    'active',
    'trialing',
    'incomplete',
    'unexpanded',
    'missing',
  ].includes(subscriptionStatus);

  return sessionComplete && paymentPaid && subscriptionOk;
}

async function createCheckoutSession(input = {}) {
  const payload = validateCheckoutInput(input);
  const plan = PLAN_DEFINITIONS[payload.planKey];

  const monthlyPriceId = resolvePriceId(plan, 'monthly');
  const implementationPriceId = resolvePriceId(plan, 'implementation');
  const { successUrl, cancelUrl } = resolveReturnUrls(payload);

  if (payload.dryRun) {
    return {
      dryRun: true,
      plan: {
        key: plan.key,
        internalPlan: plan.internalPlan,
        name: plan.displayName,
        monthlyAmount: plan.monthlyAmount,
        implementationAmount: plan.implementationAmount,
      },
      lineItems: [
        {
          role: 'monthly',
          price: monthlyPriceId,
          quantity: 1,
        },
        {
          role: 'implementation',
          price: implementationPriceId,
          quantity: 1,
        },
      ],
      successUrl,
      cancelUrl,
    };
  }

  const customer = await findOrCreateCustomer(payload);

  const metadata = {
    aa_source: 'public_checkout',
    aa_checkout_flow: 'public_checkout_v1',
    aa_plan_key: plan.key,
    aa_internal_plan: plan.internalPlan,
    aa_company_name: cleanMetadataValue(payload.companyName),
    aa_phone: cleanMetadataValue(payload.whatsapp),
    aa_doc: cleanMetadataValue(payload.document, 120),
    aa_terms: 'accepted',
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customer.id,
    payment_method_types: ['card'],
    line_items: [
      {
        price: monthlyPriceId,
        quantity: 1,
      },
      {
        price: implementationPriceId,
        quantity: 1,
      },
    ],
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    phone_number_collection: {
      enabled: true,
    },
    client_reference_id: 'aa_' + plan.key + '_' + Date.now(),
    metadata,
    subscription_data: {
      metadata,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return {
    dryRun: false,
    plan: {
      key: plan.key,
      internalPlan: plan.internalPlan,
      name: plan.displayName,
      monthlyAmount: plan.monthlyAmount,
      implementationAmount: plan.implementationAmount,
    },
    customerId: customer.id,
    sessionId: session.id,
    url: session.url,
  };
}

async function getCheckoutSessionStatus(input = {}) {
  const sessionId = normalizeCheckoutSessionId(input.sessionId || input.session_id);

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: [
      'customer',
      'subscription',
      'line_items.data.price.product',
    ],
  });

  const lineItems = session.line_items || await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 20,
    expand: ['data.price.product'],
  });

  const customer = typeof session.customer === 'object' ? session.customer : null;
  const subscription = typeof session.subscription === 'object' ? session.subscription : session.subscription;
  const plan = getPlanByMetadataOrPrices(session, lineItems);
  const subscriptionStatus = getSubscriptionStatus(subscription);
  const onboardingAllowed = isCheckoutPaid(session, subscription);

  const gateExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const gateToken = onboardingAllowed
    ? buildGateToken(session, plan, gateExpiresAt)
    : null;

  return {
    sessionId: session.id,
    mode: session.mode,
    status: session.status,
    paymentStatus: session.payment_status,
    amountSubtotal: session.amount_subtotal,
    amountTotal: session.amount_total,
    currency: session.currency,
    customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
    subscriptionId: typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id || null,
    subscriptionStatus,
    customer: {
      email: getCustomerEmail(session, customer),
      name: getCustomerName(session, customer),
      phone: getCustomerPhone(session, customer),
    },
    company: {
      name: normalizeString(session.metadata?.aa_company_name),
      phone: normalizeString(session.metadata?.aa_phone),
    },
    plan: plan ? {
      key: plan.key,
      internalPlan: plan.internalPlan,
      name: plan.displayName,
      monthlyAmount: plan.monthlyAmount,
      implementationAmount: plan.implementationAmount,
    } : null,
    onboarding: {
      allowed: onboardingAllowed,
      reason: onboardingAllowed
        ? 'payment_confirmed'
        : 'payment_not_confirmed',
      nextStep: onboardingAllowed
        ? 'create_company_onboarding'
        : 'wait_for_payment_confirmation',
      gateToken,
      gateExpiresAt: onboardingAllowed ? gateExpiresAt : null,
    },
  };
}

module.exports = {
  getPublicPlans,
  createCheckoutSession,
  getCheckoutSessionStatus,
};
