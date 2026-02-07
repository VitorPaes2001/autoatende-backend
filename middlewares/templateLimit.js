const redis = require('../config/redis');
const usageService = require('../services/usage.service');

module.exports = async function templateLimit(req, res, next) {
    try {
        const { company_id, to } = req.body;
        if (!company_id || !to) {
            return res.status(400).json({ error: 'company_id e to obrigatórios' });
        }

        const key = `conversation:${company_id}:${to.replace(/\D/g, '')}`;
        if (await redis.exists(key)) {
            return res.status(400).json({
                error: true,
                code: 'WINDOW_OPEN',
                message: 'Janela aberta — template desnecessário'
            });
        }

        await usageService.assertCanUse(company_id, 'templates');
        await usageService.increment(company_id, 'templates', 1);

        next();
    } catch (err) {
        if (err.code === 'USAGE_LIMIT_REACHED') {
            return res.status(403).json({
                error: true,
                code: 'TEMPLATE_LIMIT_REACHED',
                ...err.meta
            });
        }

        return res.status(500).json({ error: 'Erro ao validar template' });
    }
};

