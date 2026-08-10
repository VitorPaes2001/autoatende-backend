/**
 * __AUTOATENDE_V4_R12D_B2R1_EFFECTIVE_TENANT_ONLY_BILLING_STATUS__
 *
 * Middleware mínimo para /api/billing/status.
 *
 * Problema:
 * - Usuário agent não tem plano próprio.
 * - O plano pertence à empresa/client/titular.
 * - Se billing/status resolve pelo user_id do agent, cai em plano errado/default.
 *
 * Regra:
 * - Se a sessão for agent, buscar users.company_id.
 * - Depois buscar companies.client_id.
 * - Dentro do request atual, trocar req.user.id para o client_id efetivo.
 * - Preservar originalAgentUserId para auditoria.
 */

const https = require("https");
const {
  getSupabaseAdminConfig,
  isSupabaseAdminUnavailableError,
} = require("../config/supabase");

const MARKER = "__AUTOATENDE_V4_R12D_B2R1_EFFECTIVE_TENANT_ONLY_BILLING_STATUS__";

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isAgentRole(value) {
  return ["agent", "agente", "atendente", "operator", "support"].includes(normalize(value));
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

function getReqUser(req) {
  return req.user || req.auth || req.authenticatedUser || req.session?.user || {};
}

function getUserId(req) {
  const user = getReqUser(req);

  return firstNonEmpty(
    user.id,
    user.user_id,
    user.userId,
    user.sub,
    req.userId,
    req.user_id,
    req.auth?.id,
    req.auth?.user_id
  );
}

function getRoleFromReq(req) {
  const user = getReqUser(req);

  return firstNonEmpty(
    user.role,
    user.perfil,
    user.profile,
    user.user_metadata?.role,
    user.app_metadata?.role,
    req.role,
    req.perfil
  );
}

function restGet(path) {
  const { url, key } = getSupabaseAdminConfig();

  const baseUrl = String(url).replace(/\/+$/, "");
  const fullUrl = `${baseUrl}/rest/v1/${path}`;

  return new Promise((resolve) => {
    const req = https.request(
      fullUrl,
      {
        method: "GET",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json"
        }
      },
      (res) => {
        let body = "";

        res.on("data", (chunk) => {
          body += chunk;
        });

        res.on("end", () => {
          try {
            const parsed = body ? JSON.parse(body) : null;
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              data: parsed,
              error: null
            });
          } catch (error) {
            resolve({
              ok: false,
              status: res.statusCode,
              data: null,
              error: error.message,
              raw: body
            });
          }
        });
      }
    );

    req.on("error", (error) => {
      resolve({
        ok: false,
        status: 0,
        data: null,
        error: error.message
      });
    });

    req.setTimeout(7000, () => {
      req.destroy(new Error("supabase_rest_timeout"));
    });

    req.end();
  });
}

async function getSingle(table, query) {
  const response = await restGet(`${table}?${query}&limit=1`);

  if (!response.ok || !Array.isArray(response.data) || response.data.length === 0) {
    return null;
  }

  return response.data[0] || null;
}

async function effectiveBillingTenantForAgent(req, res, next) {
  try {
    const currentUser = getReqUser(req);
    const originalUserId = getUserId(req);

    if (!originalUserId) {
      return next();
    }

    let role = getRoleFromReq(req);
    let userRow = null;

    if (!isAgentRole(role)) {
      userRow = await getSingle(
        "users",
        `select=id,email,name,role,company_id&id=eq.${encodeURIComponent(originalUserId)}`
      );

      role = firstNonEmpty(userRow?.role, role);
    }

    if (!isAgentRole(role)) {
      return next();
    }

    if (!userRow) {
      userRow = await getSingle(
        "users",
        `select=id,email,name,role,company_id&id=eq.${encodeURIComponent(originalUserId)}`
      );
    }

    const companyId = firstNonEmpty(
      userRow?.company_id,
      currentUser.company_id,
      currentUser.companyId,
      currentUser.user_metadata?.company_id,
      req.company_id,
      req.companyId
    );

    if (!companyId) {
      req.effectiveBillingTenant = {
        marker: MARKER,
        applied: false,
        reason: "agent_without_company_id",
        original_user_id: originalUserId,
        role
      };

      return next();
    }

    const companyRow = await getSingle(
      "companies",
      `select=id,name,client_id,status&id=eq.${encodeURIComponent(companyId)}`
    );

    const clientId = firstNonEmpty(companyRow?.client_id);

    if (!clientId) {
      req.effectiveBillingTenant = {
        marker: MARKER,
        applied: false,
        reason: "company_without_client_id",
        original_user_id: originalUserId,
        company_id: companyId,
        role
      };

      return next();
    }

    req.originalAgentUserId = originalUserId;
    req.original_agent_user_id = originalUserId;
    req.effectiveBillingTenant = {
      marker: MARKER,
      applied: true,
      role,
      original_user_id: originalUserId,
      client_id: clientId,
      company_id: companyId,
      company_name: companyRow?.name || null
    };

    req.clientId = clientId;
    req.client_id = clientId;
    req.companyId = companyId;
    req.company_id = companyId;

    req.user = {
      ...currentUser,
      id: clientId,
      user_id: clientId,
      userId: clientId,
      client_id: clientId,
      clientId,
      company_id: companyId,
      companyId,
      role,
      original_agent_id: originalUserId,
      originalAgentId: originalUserId,
      effectiveBillingTenant: req.effectiveBillingTenant
    };

    return next();
  } catch (error) {
    if (isSupabaseAdminUnavailableError(error)) {
      return res.status(503).json({
        ok: false,
        code: error.code,
        message: "Serviço administrativo de tenant temporariamente indisponível."
      });
    }

    console.warn("[R12D-B2R1] effectiveBillingTenantForAgent failed:", error?.message || error);
    return next();
  }
}

module.exports = effectiveBillingTenantForAgent;
module.exports.effectiveBillingTenantForAgent = effectiveBillingTenantForAgent;
module.exports.MARKER = MARKER;
