const express = require('express');
const { getCompany, getActivePlan } = require('../services/company.service');
const { incrementMonthlyUsage } = require('../services/usage.service');

const router = express.Router();

router.post('/webhook', async (req, res, next) => {
  try {
    const { company_id, from, message } = req.body;

    if (!company_id || !from || !message) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // 1️⃣ Buscar empresa
    const company = await getCompany(company_id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // 2️⃣ Buscar plano ativo
    const plan = await getActivePlan(company.client_id);
    if (!plan) {
      return res.status(403).json({
        blocked: true,
        reason: 'no_active_subscription',
      });
    }

    // 3️⃣ Controle de uso mensal
    const used = await incrementMonthlyUsage(company.client_id);

    if (used > plan.limit) {
      return res.status(403).json({
        blocked: true,
        reason: 'limit_exceeded',
        used,
        limit: plan.limit,
      });
    }

    console.log('[WhatsApp]', {
      company_id,
      from,
      message,
      used,
      limit: plan.limit,
    });

    return res.json({
      success: true,
      plan: plan.plan,
      used,
      limit: plan.limit,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

