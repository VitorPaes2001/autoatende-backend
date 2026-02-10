const usageService = require('../services/usage.service');
const AppError = require('../utils/AppError');
const logger = require('../../utils/logger'); 

/**
 * Middleware de Enforcement de Limites
 * Intercepta requisições e valida o consumo via UsageService.
 */
const enforceUsage = async (req, res, next) => {
    try {
        // Ignora requisições OPTIONS (CORS)
        if (req.method === 'OPTIONS') return next();

        // Extração de Contexto
        // Tenta obter company_id do body, params ou query
        const companyId = req.body.company_id || req.params.companyId || req.query.companyId;
        
        // Identifica o contato (usuário final)
        // Inbound: 'from'
        // Outbound: 'to'
        const contact = req.body.from || req.body.to;

        // Se não identificar contexto básico, passa para o próximo (pode ser rota pública ou erro de validação posterior)
        // Mas se a rota exige company_id (como as rotas de whatsapp), deveria falhar?
        // Vamos deixar passar e deixar o controller validar se faltar dados, 
        // ou validar aqui se tivermos certeza.
        if (!companyId || !contact) {
            // Não bloqueamos aqui pois pode ser um request malformado que o controller vai tratar
            return next(); 
        }

        // Determinar Tipo de Ação
        let type = 'message'; // Default (outbound session message)
        
        // Se for webhook ou tiver indicativo de inbound
        if (req.originalUrl.includes('webhook') || req.path.includes('webhook')) {
            type = 'inbound';
        } 
        // Se for template (outbound)
        else if (req.body.template || req.body.type === 'template') {
            type = 'template';
        }

        // Chama o Service de Consumo
        // Isso irá validar janela, verificar limites e PERSISTIR o consumo se autorizado.
        await usageService.authorizeAction({
            companyId,
            type,
            contact,
            timestamp: new Date()
        });

        // Marca no request que o uso foi autorizado (para evitar dupla contagem se necessário)
        req.usageAuthorized = true;

        next();
    } catch (err) {
        if (err.code === 'LIMIT_EXCEEDED' || err.code === 'WINDOW_CLOSED' || err.code === 'NO_ACTIVE_PLAN') {
             logger.warn(`Usage enforcement blocked action: ${err.message}`, { 
                 companyId: req.body?.company_id,
                 code: err.code 
             });
             // Garante status code apropriado
             if (!err.statusCode) err.statusCode = 403; // 402 Payment Required ou 403 Forbidden
        }
        next(err);
    }
};

module.exports = enforceUsage;
