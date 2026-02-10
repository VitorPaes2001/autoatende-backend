const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const supabase = require('../config/supabase'); // Needed for safe auth check

// Fallback JSON constante (Blindagem)
const FALLBACK_STATUS = {
  plan: 'Start',
  status: 'inactive',
  limits: {
    conversations: 400,
    templates: 80,
    agents: 1
  },
  usage: {
    conversations: 0,
    templates: 0,
    agents: 1
  },
  features: {},
  blocked: {
    isBlocked: false
  }
};

/**
 * GET /api/billing/status
 * Rota "Blindada" - Não usa middlewares globais para garantir retorno 200
 * Tenta autenticar manualmente. Se falhar, retorna fallback.
 */
router.get('/status', async (req, res) => {
  try {
    // 1. Tentar Autenticação Manual (Safe Mode)
    const authHeader = req.headers.authorization;
    console.log('[BillingRoute] Received Auth Header:', authHeader ? 'PRESENT' : 'MISSING');
    
    if (!authHeader) {
      console.warn('[BillingRoute] No auth header provided');
      throw new Error('No token');
    }

    const token = authHeader.replace('Bearer ', '');
    // Debug: Log first few chars of token to verify it's not "undefined" or "null"
    console.log('[BillingRoute] Token fragment:', token ? token.substring(0, 10) + '...' : 'EMPTY');

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[BillingRoute] Supabase Auth Failed:', authError?.message || 'No user found');
      throw new Error('Invalid token');
    }

    console.log('[BillingRoute] User Authenticated:', user.email, 'ID:', user.id);

    // 2. Tentar obter contexto da empresa
    // CHANGE: Handle multiple companies by fetching list and picking first one
    const { data: companies, error: companyError } = await supabase
      .from('companies')
      .select('id, name, client_id, plan, status')
      .eq('client_id', user.id);

    if (companyError) {
      console.error('[BillingRoute] Company lookup failed:', companyError.message);
      throw new Error('Company lookup error');
    }

    if (!companies || companies.length === 0) {
      console.error('[BillingRoute] No company found for user');
      throw new Error('Company not found');
    }

    // Heuristic: Pick the one that is 'active' and 'business' if available, otherwise just the first
    const company = companies.find(c => c.plan === 'business' && c.status === 'active') || companies[0];

    console.log('[BillingRoute] Company Found:', company.name, 'ID:', company.id, 'Plan:', company.plan);

    // 3. Se tudo deu certo, injeta contexto e chama controller
    req.user = user;
    req.companyId = company.id;
    req.company = company;

    // Chama o controller (que já tem sua própria blindagem)
    return billingController.getStatus(req, res);

  } catch (error) {
    console.error('[BillingRoute] Safe Mode triggered:', error.message);
    // Em caso de QUALQUER erro (auth, db, código), retorna 200 com Fallback
    return res.status(200).json(FALLBACK_STATUS);
  }
});

// Middlewares padrão para outras rotas
const authMiddleware = require('../middlewares/auth.middleware');
const rateLimit = require('../middlewares/rateLimit.middleware');

// POST /api/billing/portal (Mantém proteção padrão)
router.post('/portal', 
  authMiddleware,
  rateLimit(10, 60), 
  billingController.createPortalSession
);

module.exports = router;
