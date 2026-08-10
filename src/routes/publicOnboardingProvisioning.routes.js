'use strict';

/**
 * __AUTOATENDE_STRIPE_PHASE2R_D5C_PUBLIC_ONBOARDING_PROVISIONING_STATUS__
 *
 * Endpoint público e limitado para a tela pós-pagamento:
 * GET /api/public/billing/onboarding/provisioning?session_id=cs_...
 *
 * Segurança:
 * - Não lista fila.
 * - Não aceita busca genérica.
 * - Não retorna notes internas.
 * - Não retorna metadados sensíveis.
 * - Só consulta um registro por checkout_session_id.
 * - session_id do Stripe é tratado como segredo de posse do link pós-pagamento.
 *
 * Esta fase é read-only: não escreve no banco.
 */

const express = require('express');

const router = express.Router();

const MARKER = '__AUTOATENDE_STRIPE_PHASE2R_D5C_PUBLIC_ONBOARDING_PROVISIONING_STATUS__';

function getSupabaseClient() {
  const { createClient } = require('@supabase/supabase-js');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    const error = new Error('Supabase env missing');
    error.code = 'supabase_env_missing';
    throw error;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeSessionId(value) {
  return String(value || '').trim();
}

function isValidCheckoutSessionId(value) {
  const sessionId = normalizeSessionId(value);
  return /^cs_(test|live)_[A-Za-z0-9_]+$/.test(sessionId) && sessionId.length >= 20 && sessionId.length <= 255;
}

function publicStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();

  const map = {
    pending: 'Aguardando contato inicial',
    contacted: 'Contato inicial realizado',
    in_progress: 'Implantação em andamento',
    done: 'Implantação concluída',
    completed: 'Implantação concluída',
    canceled: 'Implantação cancelada',
    cancelled: 'Implantação cancelada',
  };

  return map[normalized] || 'Em análise pela equipe AutoAtendeAI';
}

function nextStepForStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();

  const map = {
    pending: 'Nossa equipe deve fazer o primeiro contato e confirmar os dados da empresa.',
    contacted: 'A próxima etapa é coletar e validar as informações operacionais da empresa.',
    in_progress: 'Estamos configurando a operação, WhatsApp, assistente e testes iniciais.',
    done: 'Sua implantação foi marcada como concluída. A operação pode seguir para uso real acompanhado.',
    completed: 'Sua implantação foi marcada como concluída. A operação pode seguir para uso real acompanhado.',
    canceled: 'Entre em contato com a equipe AutoAtendeAI para revisar a situação da implantação.',
    cancelled: 'Entre em contato com a equipe AutoAtendeAI para revisar a situação da implantação.',
  };

  return map[normalized] || 'Acompanhe as próximas orientações da equipe AutoAtendeAI.';
}

function pickPublicProvisioning(row) {
  if (!row) return null;

  return {
    id: row.id || null,
    checkoutSessionId: row.checkout_session_id || null,
    companyName: row.company_name || row.customer_name || 'Empresa em implantação',
    customerEmail: row.customer_email || null,
    customerPhone: row.customer_phone || null,
    planKey: row.plan_key || null,
    planName: row.plan_name || row.plan_key || null,
    amountTotal: Number(row.amount_total || 0),
    currency: row.currency || 'brl',
    paymentStatus: row.payment_status || null,
    subscriptionStatus: row.subscription_status || null,
    status: row.status || 'pending',
    publicStatusLabel: publicStatusLabel(row.status),
    nextStep: nextStepForStatus(row.status),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

router.get('/api/public/billing/onboarding/provisioning', async (req, res) => {
  try {
    const sessionId = normalizeSessionId(req.query.session_id || req.query.sessionId);

    if (!isValidCheckoutSessionId(sessionId)) {
      return res.status(400).json({
        ok: false,
        code: 'CHECKOUT_SESSION_ID_INVALID',
        message: 'session_id inválido ou ausente.',
      });
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('billing_provisioning_queue')
      .select([
        'id',
        'checkout_session_id',
        'company_name',
        'customer_name',
        'customer_email',
        'customer_phone',
        'plan_key',
        'plan_name',
        'amount_total',
        'currency',
        'payment_status',
        'subscription_status',
        'status',
        'created_at',
        'updated_at',
      ].join(','))
      .eq('checkout_session_id', sessionId)
      .maybeSingle();

    if (error) {
      console.error(`[${MARKER}] supabase_error`, error);
      return res.status(500).json({
        ok: false,
        code: 'ONBOARDING_PROVISIONING_LOOKUP_FAILED',
        message: 'Não foi possível consultar a implantação agora.',
      });
    }

    if (!data) {
      return res.status(404).json({
        ok: false,
        code: 'ONBOARDING_PROVISIONING_NOT_FOUND',
        message: 'Ainda não encontramos uma implantação para este checkout.',
        provisioning: null,
      });
    }

    return res.json({
      ok: true,
      marker: MARKER,
      provisioning: pickPublicProvisioning(data),
    });
  } catch (error) {
    console.error(`[${MARKER}] unexpected_error`, error);

    return res.status(500).json({
      ok: false,
      code: error.code || 'ONBOARDING_PROVISIONING_UNEXPECTED_ERROR',
      message: 'Falha ao consultar status da implantação.',
    });
  }
});

module.exports = router;
