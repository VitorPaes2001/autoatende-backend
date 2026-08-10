const supabase = require("../config/supabase");
const { isSupabaseAdminUnavailableError } = supabase;

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Token de autenticação não fornecido" });

    const token = authHeader.replace("Bearer ", "").trim();

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.error("[Auth] Token inválido ou expirado", error);
      return res.status(401).json({ error: "Sessão inválida ou expirada" });
    }

    let company = null;
    let resolvedRole = user.app_metadata?.role || user.user_metadata?.role || null;

    // 1) tenta owner
    const { data: ownerCompany, error: ownerCompanyError } = await supabase
      .from("companies")
      .select("id, name, client_id")
      .eq("client_id", user.id)
      .maybeSingle();

    if (ownerCompanyError) {
      console.error("[Auth] Erro ao buscar empresa do owner", ownerCompanyError);
      return res.status(500).json({ error: "Erro interno ao validar permissões" });
    }

    if (ownerCompany) {
      company = ownerCompany;
      resolvedRole = resolvedRole || "company";
    } else {
      // 2) fallback: usuário interno da empresa (agente/admin)
      const { data: userRow, error: userRowError } = await supabase
        .from("users")
        .select("id, company_id, name, email, role")
        .eq("id", user.id)
        .maybeSingle();

      if (userRowError) {
        console.error("[Auth] Erro ao buscar vínculo do usuário", userRowError);
        return res.status(500).json({ error: "Erro interno ao validar permissões" });
      }

      if (!userRow || !userRow.company_id) {
        return res.status(403).json({ error: "Usuário não possui empresa associada" });
      }

      const { data: linkedCompany, error: linkedCompanyError } = await supabase
        .from("companies")
        .select("id, name, client_id")
        .eq("id", userRow.company_id)
        .maybeSingle();

      if (linkedCompanyError) {
        console.error("[Auth] Erro ao buscar empresa vinculada", linkedCompanyError);
        return res.status(500).json({ error: "Erro interno ao validar permissões" });
      }

      if (!linkedCompany) {
        return res.status(403).json({ error: "Empresa vinculada ao usuário não encontrada" });
      }

      company = linkedCompany;
      resolvedRole = userRow.role || resolvedRole || "agent";
      req.userProfile = userRow;
    }

    req.user = user;
    req.user.role = resolvedRole || "company";
    req.companyId = company.id;
    req.company = company;

    if (req.query.companyId && String(req.query.companyId) !== String(company.id)) {
      req.query.companyId = company.id;
    }
    if (req.body && req.body.companyId && String(req.body.companyId) !== String(company.id)) {
      req.body.companyId = company.id;
    }

    next();
  } catch (err) {
    if (isSupabaseAdminUnavailableError(err)) {
      return res.status(503).json({
        error: "Serviço de autenticação temporariamente indisponível",
        code: err.code
      });
    }

    console.error("[Auth] Erro inesperado", err);
    return res.status(500).json({ error: "Erro interno de autenticação" });
  }
};

module.exports = authMiddleware;
