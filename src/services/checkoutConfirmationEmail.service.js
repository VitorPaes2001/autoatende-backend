const Stripe = require('stripe');
const nodemailer = require('nodemailer');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  timeout: 20000,
  maxNetworkRetries: 2,
});

function pickEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && String(value).trim()) return String(value).trim();
  }
  return '';
}

function getSmtpConfig() {
  const host = pickEnv('AA_SMTP_HOST', 'SMTP_HOST');
  const port = Number(pickEnv('AA_SMTP_PORT', 'SMTP_PORT') || 587);
  const user = pickEnv('AA_SMTP_USER', 'SMTP_USER');
  const pass = pickEnv('AA_SMTP_PASS', 'SMTP_PASS');
  const from = pickEnv('AA_EMAIL_FROM', 'SMTP_FROM');
  const secureRaw = pickEnv('AA_SMTP_SECURE', 'SMTP_SECURE');
  const secure = secureRaw ? ['1', 'true', 'yes'].includes(secureRaw.toLowerCase()) : port === 465;

  return {
    host,
    port,
    user,
    pass,
    from,
    secure,
    configured: Boolean(host && user && pass && from),
  };
}

function safeText(value) {
  return String(value || '')
    .replace(/[<>&"]/g, (char) => ({
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
    }[char]))
    .slice(0, 700);
}

function moneyBRL(cents) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(cents || 0) / 100);
}

function getPlanName(session) {
  const metadataPlan =
    session.metadata?.planName ||
    session.metadata?.plan_name ||
    session.metadata?.plan ||
    session.metadata?.planKey ||
    session.metadata?.plan_key;

  if (!metadataPlan) return 'AutoAtendeAI';

  const normalized = String(metadataPlan).toLowerCase();

  if (normalized.includes('prof')) return 'Profissional';
  if (normalized.includes('business')) return 'Business';
  if (normalized.includes('essencial') || normalized.includes('starter')) return 'Essencial';

  return String(metadataPlan);
}

function buildEmail({ session, lineItems }) {
  const customerName = safeText(session.customer_details?.name || session.customer_name || 'Cliente');
  const customerEmail = safeText(session.customer_details?.email || session.customer_email || '');
  const planName = safeText(getPlanName(session));
  const amountTotal = moneyBRL(session.amount_total);
  const sessionId = safeText(session.id);
  const onboardingUrl = `https://autoatendeai.com.br/onboarding/?session_id=${encodeURIComponent(session.id)}`;

  const items = (lineItems?.data || [])
    .map((item) => {
      const description = safeText(item.description || 'AutoAtendeAI');
      const amount = moneyBRL(item.amount_total);
      return `<tr><td style="padding:10px 0;border-bottom:1px solid #e9eee9">${description}</td><td style="padding:10px 0;border-bottom:1px solid #e9eee9;text-align:right;font-weight:700">${amount}</td></tr>`;
    })
    .join('');

  const subject = `Contratação confirmada — AutoAtendeAI ${planName}`;

  const text = [
    `Olá, ${customerName}.`,
    '',
    `Sua contratação da AutoAtendeAI foi confirmada com sucesso.`,
    `Plano: ${planName}`,
    `Total inicial: ${amountTotal}`,
    `Código da contratação: ${sessionId}`,
    '',
    `Próximo passo: iniciar o onboarding assistido.`,
    onboardingUrl,
    '',
    `Durante o onboarding, vamos entender sua operação, configurar o assistente e preparar o uso real da plataforma.`,
    '',
    `AutoAtendeAI`,
  ].join('\n');

  const html = `
<!doctype html>
<html>
  <body style="margin:0;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#102016">
    <div style="max-width:680px;margin:0 auto;padding:28px">
      <div style="background:#03120a;border-radius:24px;padding:28px;color:#f5f8f6">
        <div style="font-size:22px;font-weight:800;letter-spacing:-.5px">AutoAtendeAI</div>
        <div style="margin-top:18px;display:inline-block;background:#28d77c;color:#02120a;border-radius:999px;padding:8px 12px;font-weight:800;font-size:13px">Pagamento confirmado</div>
        <h1 style="margin:22px 0 10px;font-size:32px;line-height:1.05;letter-spacing:-1.4px">Sua contratação foi confirmada.</h1>
        <p style="margin:0;color:#cfe0d6;font-size:16px;line-height:1.55">
          Agora começa a etapa de onboarding assistido, onde vamos estruturar a operação da empresa e preparar o uso real da AutoAtendeAI.
        </p>
      </div>

      <div style="background:#ffffff;border-radius:22px;margin-top:16px;padding:26px;border:1px solid #e1e8e3">
        <p style="margin:0 0 14px;font-size:16px">Olá, <strong>${customerName}</strong>.</p>
        <p style="margin:0 0 18px;color:#44544a;line-height:1.6">
          Recebemos a confirmação da sua contratação. A partir de agora, o próximo passo é iniciar o onboarding assistido para configurar a operação conforme a realidade da sua empresa.
        </p>

        <table style="width:100%;border-collapse:collapse;margin:18px 0">
          <tr><td style="padding:10px 0;border-bottom:1px solid #e9eee9">Plano</td><td style="padding:10px 0;border-bottom:1px solid #e9eee9;text-align:right;font-weight:700">${planName}</td></tr>
          ${items}
          <tr><td style="padding:12px 0">Total inicial</td><td style="padding:12px 0;text-align:right;font-size:18px;font-weight:800">${amountTotal}</td></tr>
        </table>

        <div style="background:#f3fbf6;border:1px solid #caedd8;border-radius:16px;padding:16px;margin:18px 0">
          <strong>O que acontece agora?</strong>
          <p style="margin:8px 0 0;color:#44544a;line-height:1.55">
            Vamos entender sua operação, organizar informações comerciais, ajustar o assistente, definir regras iniciais e preparar a plataforma para começar com mais clareza.
          </p>
        </div>

        <a href="${onboardingUrl}" style="display:inline-block;background:#28d77c;color:#02120a;text-decoration:none;padding:14px 18px;border-radius:999px;font-weight:800">Iniciar onboarding</a>

        <p style="margin:20px 0 0;color:#6b7b72;font-size:13px;line-height:1.5">
          Código da contratação: <strong>${sessionId}</strong><br>
          E-mail da contratação: ${customerEmail}
        </p>
      </div>

      <p style="text-align:center;color:#7d8b83;font-size:12px;margin:18px 0 0">
        AutoAtendeAI · CNPJ 64.059.758/0001-88
      </p>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}

async function getSubscription(session) {
  if (!session.subscription) return null;
  if (!stripe.subscriptions || typeof stripe.subscriptions.retrieve !== 'function') return null;

  return stripe.subscriptions.retrieve(session.subscription);
}

async function getCustomer(session) {
  if (!session.customer) return null;
  if (!stripe.customers || typeof stripe.customers.retrieve !== 'function') return null;

  const customer = await stripe.customers.retrieve(session.customer);
  if (customer && !customer.deleted) return customer;
  return null;
}

function getSentMetadata(session, subscription, customer) {
  return (
    session.metadata?.aa_confirmation_email_sent_at ||
    subscription?.metadata?.aa_confirmation_email_sent_at ||
    customer?.metadata?.aa_confirmation_email_sent_at ||
    null
  );
}

async function markEmailSent({ session, subscription, customer, to, messageId, sentAt }) {
  const patch = {
    aa_confirmation_email_sent_at: sentAt,
    aa_confirmation_email_to: String(to || '').slice(0, 240),
    aa_confirmation_email_message_id: String(messageId || '').slice(0, 240),
    aa_confirmation_email_session_id: String(session.id || '').slice(0, 240),
  };

  if (subscription?.id && stripe.subscriptions && typeof stripe.subscriptions.update === 'function') {
    await stripe.subscriptions.update(subscription.id, {
      metadata: {
        ...(subscription.metadata || {}),
        ...patch,
      },
    });

    return 'subscription';
  }

  if (customer?.id && stripe.customers && typeof stripe.customers.update === 'function') {
    await stripe.customers.update(customer.id, {
      metadata: {
        ...(customer.metadata || {}),
        ...patch,
      },
    });

    return 'customer';
  }

  if (stripe.checkout?.sessions && typeof stripe.checkout.sessions.update === 'function') {
    await stripe.checkout.sessions.update(session.id, {
      metadata: {
        ...(session.metadata || {}),
        ...patch,
      },
    });

    return 'checkout_session';
  }

  return 'not_available';
}

async function sendCheckoutConfirmationEmail(sessionId, options = {}) {
  if (!sessionId || !String(sessionId).startsWith('cs_')) {
    const error = new Error('invalid_session_id');
    error.statusCode = 400;
    throw error;
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 10,
    expand: ['data.price.product'],
  });

  const paymentStatus = session.payment_status;
  const onboardingAllowed = paymentStatus === 'paid' && session.status === 'complete';

  if (!onboardingAllowed) {
    return {
      ok: true,
      sent: false,
      skipped: true,
      reason: 'payment_not_confirmed',
      paymentStatus,
      sessionStatus: session.status,
    };
  }

  const to = session.customer_details?.email || session.customer_email;

  if (!to) {
    return {
      ok: true,
      sent: false,
      skipped: true,
      reason: 'customer_email_missing',
      paymentStatus,
      sessionStatus: session.status,
    };
  }

  const [subscription, customer] = await Promise.all([
    getSubscription(session).catch(() => null),
    getCustomer(session).catch(() => null),
  ]);

  const alreadySentAt = getSentMetadata(session, subscription, customer);

  if (alreadySentAt && !options.force) {
    return {
      ok: true,
      sent: false,
      skipped: true,
      alreadySent: true,
      reason: 'already_sent',
      sentAt: alreadySentAt,
      to,
      paymentStatus,
      sessionStatus: session.status,
      markerSource: subscription?.metadata?.aa_confirmation_email_sent_at ? 'subscription' : 'customer_or_session',
    };
  }

  const smtp = getSmtpConfig();

  if (!smtp.configured) {
    return {
      ok: true,
      sent: false,
      skipped: true,
      reason: 'smtp_not_configured',
      to,
      paymentStatus,
      sessionStatus: session.status,
      requiredEnv: ['AA_SMTP_HOST', 'AA_SMTP_PORT', 'AA_SMTP_USER', 'AA_SMTP_PASS', 'AA_EMAIL_FROM'],
    };
  }

  const email = buildEmail({ session, lineItems });

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  const info = await transporter.sendMail({
    from: smtp.from,
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  const sentAt = new Date().toISOString();

  const markerSource = await markEmailSent({
    session,
    subscription,
    customer,
    to,
    messageId: info.messageId,
    sentAt,
  });

  return {
    ok: true,
    sent: true,
    skipped: false,
    to,
    sentAt,
    messageId: info.messageId || null,
    paymentStatus,
    sessionStatus: session.status,
    markerSource,
  };
}

module.exports = {
  sendCheckoutConfirmationEmail,
  getSmtpConfig,
};
