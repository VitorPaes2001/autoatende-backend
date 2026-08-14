const crypto = require("crypto");
const supabase = require("../config/supabase");

const USER_SELECT = "id, company_id, name, email, role, onboarding_completed, created_at";

function makeTempPassword() {
  return `AAI_${crypto.randomBytes(6).toString("hex")}!a9`;
}

async function listAgents(req, res, next) {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(401).json({ error: "Unauthorized: Missing company context" });
    }

    const { data, error } = await supabase
      .from("users")
      .select(USER_SELECT)
      .eq("company_id", companyId)
      .neq("role", "company")
      .order("created_at", { ascending: true });

    if (error) throw error;

    return res.json({ success: true, data: data || [] });
  } catch (err) {
    next(err);
  }
}

async function createAgent(req, res, next) {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(401).json({ error: "Unauthorized: Missing company context" });
    }

    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const providedPassword = String(req.body?.password || "").trim();
    const password = providedPassword || makeTempPassword();

    if (!name || !email) {
      return res.status(400).json({
        error: "Missing required fields",
        details: ["name", "email"]
      });
    }

    if (!email.includes("@")) {
      return res.status(400).json({ error: "Email inválido" });
    }

    const { data: existingUserRow } = await supabase
      .from("users")
      .select("id, email, company_id")
      .eq("email", email)
      .maybeSingle();

    if (existingUserRow) {
      return res.status(409).json({
        error: "Já existe um usuário com este e-mail no sistema",
        code: "USER_EMAIL_ALREADY_EXISTS"
      });
    }

    const { data: createdAuth, error: createAuthError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "agent", company_id: companyId }
    });

    if (createAuthError || !createdAuth?.user?.id) {
      return res.status(400).json({
        error: "Falha ao criar usuário de autenticação",
        details: createAuthError?.message || "Erro desconhecido"
      });
    }

    const authUserId = createdAuth.user.id;

    const { data: insertedRow, error: insertError } = await supabase
      .from("users")
      .insert({
        id: authUserId,
        company_id: companyId,
        name,
        email,
        role: "agent",
        onboarding_completed: false
      })
      .select(USER_SELECT)
      .single();

    if (insertError) {
      try {
        await supabase.auth.admin.deleteUser(authUserId);
      } catch (_) {}
      return res.status(500).json({
        error: "Falha ao gravar agente na tabela users",
        details: insertError.message
      });
    }

    return res.status(201).json({
      success: true,
      data: insertedRow,
      temporary_password: password
    });
  } catch (err) {
    next(err);
  }
}

async function deleteAgent(req, res, next) {
  try {
    const companyId = req.companyId;
    const requesterId = req.user?.id ? String(req.user.id) : null;
    const agentId = String(req.params?.id || "").trim();

    if (!companyId) {
      return res.status(401).json({ error: "Unauthorized: Missing company context" });
    }

    if (!agentId) {
      return res.status(400).json({
        error: "ID do agente é obrigatório",
        code: "MISSING_AGENT_ID"
      });
    }

    const { data: target, error: targetError } = await supabase
      .from("users")
      .select(USER_SELECT)
      .eq("company_id", companyId)
      .eq("id", agentId)
      .maybeSingle();

    if (targetError) {
      console.error("[users.deleteAgent] target lookup error:", targetError);
      return res.status(500).json({
        error: "Falha ao localizar agente",
        details: targetError.message
      });
    }

    if (!target) {
      return res.status(404).json({
        error: "Agente não encontrado",
        code: "AGENT_NOT_FOUND"
      });
    }

    if (String(target.role || "").toLowerCase() === "company") {
      return res.status(403).json({
        error: "O proprietário da empresa não pode ser excluído por esta tela.",
        code: "CANNOT_DELETE_COMPANY_OWNER"
      });
    }

    if (requesterId && requesterId === agentId) {
      return res.status(403).json({
        error: "Você não pode excluir o usuário autenticado no momento.",
        code: "CANNOT_DELETE_CURRENT_USER"
      });
    }

    console.log("[users.deleteAgent] start", {
      requesterId,
      companyId,
      agentId,
      targetEmail: target.email
    });


    /* __AUTOATENDE_C8C_R2_BACKEND_DELETE_AGENT_ENFORCEMENT__ */
    const { data: activeHumanAssignments, error: activeHumanAssignmentsError } = await supabase
      .from("conversation_states")
      .select("id", { count: "exact" })
      .eq("company_id", companyId)
      .eq("mode", "human")
      .eq("assigned_agent_id", agentId);

    if (activeHumanAssignmentsError) {
      console.error("[users.deleteAgent] active human assignment guard error:", activeHumanAssignmentsError.message);
      throw activeHumanAssignmentsError;
    }

    const activeHumanAssignmentsCount = Array.isArray(activeHumanAssignments)
      ? activeHumanAssignments.length
      : 0;

    if (activeHumanAssignmentsCount > 0) {
      return res.status(409).json({
        error: `Este agente possui ${activeHumanAssignmentsCount} conversa(s) humana(s) atribuída(s). Reatribua ou retorne essas conversas ao bot antes de excluir o agente.`,
        code: "AGENT_HAS_ASSIGNED_HUMAN_CONVERSATIONS",
        details: {
          assigned_human_conversations: activeHumanAssignmentsCount,
          agent_id: agentId
        }
      });
    }

    // 1) Limpa referências operacionais que podem impedir exclusão
    try {
      const { error: csError } = await supabase
        .from("conversation_states")
        .update({ assigned_agent_id: null })
        .eq("company_id", companyId)
        .eq("assigned_agent_id", agentId);

      if (csError) {
        console.warn("[users.deleteAgent] conversation_states cleanup warning:", csError.message);
      }
    } catch (e) {
      console.warn("[users.deleteAgent] conversation_states cleanup exception:", e?.message || e);
    }

    try {
      const { error: icError } = await supabase
        .from("inbox_conversations")
        .update({ assigned_user_id: null })
        .eq("company_id", companyId)
        .eq("assigned_user_id", agentId);

      if (icError) {
        console.warn("[users.deleteAgent] inbox_conversations cleanup warning:", icError.message);
      }
    } catch (e) {
      console.warn("[users.deleteAgent] inbox_conversations cleanup exception:", e?.message || e);
    }

    // 2) Apaga da tabela public.users FORÇANDO retorno da linha deletada
    // Isso evita falso positivo em wrappers/builder compat
    const deleteBuilder = supabase
      .from("users")
      .delete()
      .eq("company_id", companyId)
      .eq("id", agentId);

    let deletedRow = null;
    let deleteRowError = null;

    if (typeof deleteBuilder.select === "function") {
      const result = await deleteBuilder.select("id, email").maybeSingle();
      deletedRow = result?.data || null;
      deleteRowError = result?.error || null;
    } else {
      const result = await deleteBuilder;
      deletedRow = result?.data || null;
      deleteRowError = result?.error || null;
    }

    if (deleteRowError) {
      console.error("[users.deleteAgent] delete users row error:", deleteRowError);
      return res.status(500).json({
        error: "Falha ao remover agente da tabela users",
        details: deleteRowError.message
      });
    }

    if (!deletedRow) {
      return res.status(500).json({
        error: "A exclusão não retornou confirmação da linha removida.",
        code: "DELETE_NOT_CONFIRMED"
      });
    }

    // 3) Tenta apagar no Auth como best effort
    let authWarning = null;
    try {
      const authResult = await supabase.auth.admin.deleteUser(agentId);
      const authDeleteError = authResult?.error || null;

      if (authDeleteError) {
        const msg = String(authDeleteError.message || "");
        const lower = msg.toLowerCase();

        if (
          lower.includes("not found") ||
          lower.includes("user not found") ||
          lower.includes("already deleted")
        ) {
          authWarning = "Usuário já não existia no Auth.";
        } else {
          authWarning = msg;
          console.warn("[users.deleteAgent] auth delete warning:", msg);
        }
      }
    } catch (e) {
      authWarning = e?.message || "Falha ao remover usuário no Auth";
      console.warn("[users.deleteAgent] auth delete exception:", authWarning);
    }

    console.log("[users.deleteAgent] success", {
      companyId,
      agentId,
      authWarning
    });

    return res.json({
      success: true,
      data: target,
      ...(authWarning ? { warning: authWarning } : {})
    });
  } catch (err) {
    next(err);
  }
}


/* __AUTOATENDE_C8C_R3_AGENT_REASSIGN_CONTROLLER__ */
async function reassignAgentConversations(req, res, next) {
  try {
    const companyId = req.companyId;
    const sourceAgentId = req.params?.id;
    const targetAgentId = req.body?.target_agent_id || req.body?.targetAgentId || null;

    if (!companyId) {
      return res.status(401).json({ error: "Unauthorized: Missing company context" });
    }

    if (!sourceAgentId) {
      return res.status(400).json({ error: "Agente de origem não informado." });
    }

    if (!targetAgentId) {
      return res.status(400).json({ error: "Agente de destino não informado." });
    }

    if (String(sourceAgentId) === String(targetAgentId)) {
      return res.status(400).json({
        error: "O agente de destino deve ser diferente do agente de origem.",
        code: "AGENT_REASSIGN_SAME_SOURCE_AND_TARGET"
      });
    }

    const { data: sourceAgent, error: sourceAgentError } = await supabase
      .from("users")
      .select("id, company_id, role, name, email")
      .eq("id", sourceAgentId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (sourceAgentError) throw sourceAgentError;

    if (!sourceAgent) {
      return res.status(404).json({
        error: "Agente de origem não encontrado.",
        code: "SOURCE_AGENT_NOT_FOUND"
      });
    }

    const { data: targetAgent, error: targetAgentError } = await supabase
      .from("users")
      .select("id, company_id, role, name, email")
      .eq("id", targetAgentId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (targetAgentError) throw targetAgentError;

    if (!targetAgent) {
      return res.status(404).json({
        error: "Agente de destino não encontrado.",
        code: "TARGET_AGENT_NOT_FOUND"
      });
    }

    if (String(targetAgent.role || "").toLowerCase() === "company") {
      return res.status(400).json({
        error: "O destino precisa ser um agente operacional válido.",
        code: "TARGET_AGENT_INVALID_ROLE"
      });
    }

    const { data: activeAssignments, error: activeAssignmentsError } = await supabase
      .from("conversation_states")
      .select("id, contact, assigned_agent_id, mode")
      .eq("company_id", companyId)
      .eq("mode", "human")
      .eq("assigned_agent_id", sourceAgentId);

    if (activeAssignmentsError) throw activeAssignmentsError;

    const activeAssignmentsCount = Array.isArray(activeAssignments) ? activeAssignments.length : 0;

    if (activeAssignmentsCount === 0) {
      return res.status(200).json({
        success: true,
        source_agent_id: sourceAgentId,
        target_agent_id: targetAgentId,
        reassigned_count: 0,
        message: "Nenhuma conversa humana atribuída foi encontrada para reatribuição."
      });
    }

    const { data: reassignedRows, error: reassignError } = await supabase
      .from("conversation_states")
      .update({ assigned_agent_id: targetAgentId })
      .eq("company_id", companyId)
      .eq("mode", "human")
      .eq("assigned_agent_id", sourceAgentId)
      .select("id, contact, assigned_agent_id");

    if (reassignError) throw reassignError;

    const reassignedCount = Array.isArray(reassignedRows) ? reassignedRows.length : 0;

    console.log("[users.reassignAgentConversations] success", {
      companyId,
      sourceAgentId,
      targetAgentId,
      reassignedCount
    });

    /* __AUTOATENDE_C8C_R4_DELETE_AGENT_SUCCESS_PAYLOAD__ */
    return res.status(200).json({
      success: true,
      deleted_agent_id: agentId,
      deleted_agent_email: target.email || null,
      deleted_agent_name: target.name || null,
      message: `Agente ${target.name || target.email || agentId} excluído com sucesso.`
    });
  } catch (error) {
    return next(error);
  }
}


module.exports = {
  reassignAgentConversations,
  listAgents,
  createAgent,
  deleteAgent
};
