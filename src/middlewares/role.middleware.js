const AppError = require('../utils/AppError');

/**
 * Middleware de Controle de Acesso Baseado em Função (RBAC)
 * @param {string[]} allowedRoles - Lista de roles permitidas (ex: ['admin', 'company'])
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Acesso negado: Perfil não identificado' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.warn(`[RBAC] Bloqueado: User ${req.user.id} (${req.user.role}) tentou acessar ${req.originalUrl}`);
      return res.status(403).json({ 
        error: 'Acesso negado',
        message: `Seu perfil (${req.user.role}) não tem permissão para esta ação.`
      });
    }

    next();
  };
};

module.exports = requireRole;
