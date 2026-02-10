const logger = require('../../utils/logger');

/**
 * Middleware de Auditoria
 * Registra ações críticas de escrita (POST, PUT, DELETE, PATCH)
 */
const auditLogger = (req, res, next) => {
  // Apenas audita métodos de escrita
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const user = req.user ? `${req.user.id} (${req.user.role})` : 'Anonymous';
    const company = req.companyId || 'N/A';
    
    // Log estruturado para ingestão futura (ex: Elastic, Datadog)
    const auditEntry = {
      timestamp: new Date().toISOString(),
      type: 'AUDIT_LOG',
      action: req.method,
      path: req.originalUrl,
      user: user,
      company_id: company,
      ip: req.ip,
      // Evitar logar senhas ou dados sensíveis do body
      body_summary: sanitizeBody(req.body) 
    };

    // Usa o logger existente
    logger.info(JSON.stringify(auditEntry));
  }
  next();
};

function sanitizeBody(body) {
  if (!body) return {};
  const sanitized = { ...body };
  // Remover campos sensíveis
  ['password', 'token', 'secret', 'credit_card'].forEach(field => {
    if (sanitized[field]) sanitized[field] = '***MASKED***';
  });
  return sanitized;
}

module.exports = auditLogger;
