const supabase = require('../config/supabase');
const apiResponse = require('../utils/apiResponse');

/**
 * Middleware de Autenticação
 * Valida o JWT do Supabase e injeta o contexto da empresa (companyId)
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // 1. Validar Token com Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('[Auth] Token inválido ou expirado', error);
      return res.status(401).json({ error: 'Sessão inválida ou expirada' });
    }

    // 2. Resolver company_id associado ao usuário (client_id)
    // Assumindo que client_id na tabela companies é o ID do usuário do Supabase
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, client_id')
      .eq('client_id', user.id)
      .maybeSingle();

    if (companyError) {
      console.error('[Auth] Erro ao buscar empresa', companyError);
      return res.status(500).json({ error: 'Erro interno ao validar permissões' });
    }

    if (!company) {
      return res.status(403).json({ error: 'Usuário não possui empresa associada' });
    }

    // 3. Injetar Contexto Seguro
    req.user = user;
    req.companyId = company.id;
    req.company = company;

    // 4. Determinar Role (RBAC)
    // Prioridade: app_metadata > user_metadata > 'company' (padrão para owner)
    const role = user.app_metadata?.role || user.user_metadata?.role || 'company';
    req.user.role = role;

    // 5. Segurança: Garantir que companyId na query/body (se houver) bata com o token
    // Ou simplesmente sobrescrever para garantir integridade
    if (req.query.companyId && Number(req.query.companyId) !== company.id) {
       // Sobrescreve silenciosamente para garantir segurança
       req.query.companyId = company.id;
    }
    if (req.body.companyId && Number(req.body.companyId) !== company.id) {
       req.body.companyId = company.id;
    }
    
    next();
  } catch (err) {
    console.error('[Auth] Erro inesperado', err);
    return res.status(500).json({ error: 'Erro interno de autenticação' });
  }
};

module.exports = authMiddleware;
