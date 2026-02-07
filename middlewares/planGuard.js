const usageService = require('../services/usage.service');

module.exports = async function planGuard(req, res, next) {
    try {
        const companyId =
            req.client_id ||
            req.body.company_id ||
            req.query.company_id;

        if (!companyId) {
            return res.status(400).json({ error: 'company_id obrigatório' });
        }

        await usageService.assertCanUse(companyId, 'conversations');
        next();
    } catch (err) {
        if (err.code === 'USAGE_LIMIT_REACHED') {
            return res.status(403).json({
                error: true,
                code: 'PLAN_LIMIT_REACHED',
                ...err.meta
            });
        }

        return res.status(500).json({ error: 'Erro ao validar plano' });
    }
};

