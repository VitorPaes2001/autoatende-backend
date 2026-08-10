// __AUTOATENDE_V4_R12D_A6_AGENT_OPERATIONAL_TEMPLATES_ACCESS__
const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/role.middleware");
const {
  getSiteClicksSummary,
  DEFAULT_SNAPSHOT_PATH
} = require("../services/opsSurfaceSnapshot.service");

const router = express.Router();
const { bindAcquisitionToResolvedIdentity } = require("../services/acquisitionAttribution.service");
const { listRecentAcquisitionEvents } = require("../services/acquisitionRead.service");
const { sendAcquisitionTemplate, promoteAcquisitionPilotBlock } = require("../services/acquisitionOperation.service");

const { createTemplateForCompany, listTemplatesForCompany, listApprovedTemplatesForCompany } = require('../services/acquisitionTemplateCatalog.service');
const effectiveBillingTenantForAgent = require('../middlewares/effectiveBillingTenantForAgent.middleware'); // __AUTOATENDE_V4_R12D_B2R2_FIX_MISSING_EFFECTIVE_TENANT_IMPORT__

// __AUTOATENDE_C13D_R7A_B2_OPS_SURFACE_ROUTE__

// __AUTOATENDE_V4_R12D_B2R2_ALLOW_AGENT_FULL_DISPAROS_MODULE__
router.get(
  "/site-clicks-summary",
  authMiddleware,
  requireRole(['company', 'admin', 'owner', 'manager', 'agent']), effectiveBillingTenantForAgent,
  async (_req, res) => {
    try {
      const data = getSiteClicksSummary();
      res.set("Cache-Control", "no-store");
      return res.json({
        ok: true,
        data
      });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        ok: false,
        error: err.code || "OPS_SURFACE_SNAPSHOT_READ_FAILED",
        message: err.message || "Failed to load ops surface snapshot",
        snapshot_path: DEFAULT_SNAPSHOT_PATH,
        meta: err.meta || null
      });
    }
  }
);

// __AUTOATENDE_V4_R12D_B2R2_ALLOW_AGENT_FULL_DISPAROS_MODULE__
router.post("/acquisition/bind-self", authMiddleware, requireRole(['company', 'admin', 'owner', 'agent']), effectiveBillingTenantForAgent, async (req, res) => {
  try {
    const companyId =
      req.companyId ||
      req.company?.id ||
      req.user?.company_id ||
      req.user?.companyId ||
      null;

    const clientId =
      req.company?.client_id ||
      req.user?.client_id ||
      req.user?.clientId ||
      null;

    const userId =
      req.user?.id ||
      null;

    const acquisitionContext =
      req.body?.acquisitionContext ||
      req.body?.context ||
      {};

    const result = await bindAcquisitionToResolvedIdentity({
      acquisitionContext,
      userId,
      companyId,
      clientId
    });

    return res.status(200).json({
      ok: true,
      data: {
        ...result,
        route_marker: "__AUTOATENDE_R10C_C2_BIND_SELF_ROUTE__"
      }
    });
  } catch (error) {
    console.error("[R10C-C2] acquisition bind-self failed", error);
    return res.status(500).json({
      ok: false,
      error: "ACQUISITION_BIND_SELF_FAILED",
      message: error?.message || "Falha ao vincular aquisição à identidade autenticada.",
      route_marker: "__AUTOATENDE_R10C_C2_BIND_SELF_ROUTE__"
    });
  }
});



// __AUTOATENDE_V4_R12D_B2R2_ALLOW_AGENT_FULL_DISPAROS_MODULE__
router.get("/acquisition/templates", authMiddleware, requireRole(['company', 'admin', 'owner', 'agent']), effectiveBillingTenantForAgent, async (req, res) => {
  try {
    const companyId =
      req.companyId ||
      req.company?.id ||
      req.user?.company_id ||
      req.user?.companyId ||
      null;

    if (!companyId) {
      return res.status(400).json({
        ok: false,
        error: "ACQUISITION_TEMPLATE_CATALOG_COMPANY_NOT_RESOLVED",
        message: "Empresa não resolvida para carregar templates aprovados."
      });
    }

    const result = await listApprovedTemplatesForCompany(companyId);

    return res.status(200).json({
      ok: true,
      items: result.items,
      meta: result.meta,
      route_marker: "__AUTOATENDE_C16N_C4A_ACQUISITION_TEMPLATES_ROUTE__"
    });
  } catch (error) {
    const statusCode = error?.statusCode || error?.response?.status || 500;
    return res.status(statusCode).json({
      ok: false,
      error: error?.code || "ACQUISITION_TEMPLATE_CATALOG_FAILED",
      message: error?.message || "Falha ao carregar templates aprovados da Meta.",
      meta: error?.meta || error?.response?.data || null,
      route_marker: "__AUTOATENDE_C16N_C4A_ACQUISITION_TEMPLATES_ROUTE__"
    });
  }
});


// __AUTOATENDE_V4_R12D_B2R2_ALLOW_AGENT_FULL_DISPAROS_MODULE__
router.get("/acquisition/templates/catalog", authMiddleware, requireRole(['company', 'admin', 'owner', 'agent']), effectiveBillingTenantForAgent, async (req, res) => {
  try {
    const companyId =
      req.companyId ||
      req.company?.id ||
      req.user?.company_id ||
      req.user?.companyId ||
      null;

    if (!companyId) {
      return res.status(400).json({
        ok: false,
        error: "ACQUISITION_TEMPLATE_FULL_CATALOG_COMPANY_NOT_RESOLVED",
        message: "Empresa não resolvida para carregar catálogo completo de templates."
      });
    }

    const result = await listTemplatesForCompany(companyId, { approvedOnly: false });

    return res.status(200).json({
      ok: true,
      items: result.items,
      meta: result.meta,
      route_marker: "__AUTOATENDE_C16N_C7C_R1B_FIX1_ACQUISITION_TEMPLATES_CATALOG_ROUTE__"
    });
  } catch (error) {
    const statusCode = error?.statusCode || error?.response?.status || 500;
    return res.status(statusCode).json({
      ok: false,
      error: error?.code || "ACQUISITION_TEMPLATE_FULL_CATALOG_FAILED",
      message: error?.message || "Falha ao carregar catálogo completo de templates da Meta.",
      meta: error?.meta || error?.response?.data || null,
      route_marker: "__AUTOATENDE_C16N_C7C_R1B_FIX1_ACQUISITION_TEMPLATES_CATALOG_ROUTE__"
    });
  }
});


// __AUTOATENDE_V4_R12D_B2R2_ALLOW_AGENT_FULL_DISPAROS_MODULE__
router.post("/acquisition/templates/create", authMiddleware, requireRole(['company', 'admin', 'owner', 'agent']), effectiveBillingTenantForAgent, async (req, res) => {
  try {
    const companyId =
      req.companyId ||
      req.company?.id ||
      req.user?.company_id ||
      req.user?.companyId ||
      null;

    if (!companyId) {
      return res.status(400).json({
        ok: false,
        error: "ACQUISITION_TEMPLATE_CREATE_COMPANY_NOT_RESOLVED",
        message: "Empresa não resolvida para criar template."
      });
    }

    const result = await createTemplateForCompany(companyId, req.body || {});

    return res.status(201).json({
      ok: true,
      result,
      route_marker: "__AUTOATENDE_C16N_C7C_R1C_A_TEMPLATES_CREATE_ROUTE__"
    });
  } catch (error) {
    const statusCode = error?.statusCode || error?.response?.status || 500;

    return res.status(statusCode).json({
      ok: false,
      error: error?.code || "ACQUISITION_TEMPLATE_CREATE_FAILED",
      message: error?.message || "Falha ao criar template na Meta.",
      meta: error?.meta || error?.response?.data || null,
      route_marker: "__AUTOATENDE_C16N_C7C_R1C_A_TEMPLATES_CREATE_ROUTE__"
    });
  }
});

// __AUTOATENDE_V4_R12D_B2R2_ALLOW_AGENT_FULL_DISPAROS_MODULE__
router.post("/acquisition/send-template", authMiddleware, requireRole(['company', 'admin', 'owner', 'agent']), effectiveBillingTenantForAgent, async (req, res) => {
  try {
    const companyId =
      req.companyId ||
      req.company?.id ||
      req.user?.company_id ||
      req.user?.companyId ||
      null;

    const result = await sendAcquisitionTemplate({
      companyId,
      to: req.body?.to,
      templateName: req.body?.template_name || req.body?.templateName,
      languageCode: req.body?.language_code || req.body?.languageCode || 'pt_BR',
      components: req.body?.components || [],
      templateCategory: req.body?.template_category || req.body?.templateCategory || 'utility_auth',
      templatePreviewText: req.body?.template_preview_text || req.body?.templatePreviewText || null
    });

    return res.status(200).json({
      ok: true,
      data: {
        ...result,
        route_marker: "__AUTOATENDE_C16N_B5_ACQUISITION_SEND_TEMPLATE_ROUTE__"
      }
    });
    } catch (error) {
      const statusCode =
        error?.statusCode ||
        error?.response?.status ||
        500;

      const meta =
        error?.meta ||
        error?.response?.data ||
        {
          route_observability_marker: "__AUTOATENDE_C16N_C3H_R4_ROUTE_ERROR_FALLBACK__",
          error_name: error?.name || null,
          error_code: error?.code || null,
          error_message: error?.message || null,
          upstream_status: error?.response?.status || null,
          upstream_headers: error?.response?.headers || null,
          upstream_data: error?.response?.data || null,
          upstream_url: error?.config?.url || null,
          upstream_method: error?.config?.method || null
        };

      return res.status(statusCode).json({
        ok: false,
        error: error?.code || "ACQUISITION_SEND_TEMPLATE_FAILED",
        message: error?.message || "Falha ao enviar template operacional de aquisição.",
        // __AUTOATENDE_C16N_C10M_R1C_ROUTE_META__
        meta: error?.meta || error?.response?.data || null,
        meta,
        route_marker: "__AUTOATENDE_C16N_B5_ACQUISITION_SEND_TEMPLATE_ROUTE__"
      });
    }
});


// __AUTOATENDE_V4_R12D_B2R2_ALLOW_AGENT_FULL_DISPAROS_MODULE__
router.post("/acquisition/lot/promote-pilot", authMiddleware, requireRole(['company', 'admin', 'owner', 'agent']), effectiveBillingTenantForAgent, async (req, res) => {
  try {
    const result = promoteAcquisitionPilotBlock({
      manifest: req.body?.manifest || null,
      currentPilot: req.body?.current_pilot || req.body?.currentPilot || req.body?.pilot || null,
      execution: req.body?.execution || req.body?.run_state || req.body?.runState || null
    });

    return res.status(200).json({
      ok: true,
      data: {
        ...result,
        route_marker: "__AUTOATENDE_C16N_C11B_R2A_PROMOTE_PILOT_ROUTE__"
      }
    });
  } catch (error) {
    const statusCode =
      error?.statusCode ||
      error?.response?.status ||
      500;

    return res.status(statusCode).json({
      ok: false,
      error: error?.code || "ACQUISITION_PROMOTE_PILOT_FAILED",
      message: error?.message || "Falha ao promover o piloto e preparar o próximo bloco.",
      meta: error?.meta || error?.response?.data || null,
      route_marker: "__AUTOATENDE_C16N_C11B_R2A_PROMOTE_PILOT_ROUTE__"
    });
  }
});


// __AUTOATENDE_V4_R12D_B2R2_ALLOW_AGENT_FULL_DISPAROS_MODULE__
router.get("/acquisition/recent", authMiddleware, requireRole(['company', 'admin', 'owner', 'agent']), effectiveBillingTenantForAgent, async (req, res) => {
  try {
    const role =
      req.user?.role ||
      req.user?.resolvedRole ||
      req.company?.role ||
      null;

    const isAdminLike = ["admin", "owner"].includes(String(role || "").trim());

    const companyId =
      req.companyId ||
      req.company?.id ||
      req.user?.company_id ||
      req.user?.companyId ||
      null;

    const onlyBound = req.query?.only_bound;
    const onlyUnbound = req.query?.only_unbound;
    const globalUnbound = req.query?.global_unbound;

    if ((onlyUnbound === "1" || onlyUnbound === "true") && (globalUnbound === "1" || globalUnbound === "true") && !isAdminLike) {
      return res.status(403).json({
        ok: false,
        error: "ACQUISITION_GLOBAL_UNBOUND_FORBIDDEN",
        route_marker: "__AUTOATENDE_R10E_A_RECENT_ROUTE__"
      });
    }

    const result = await listRecentAcquisitionEvents({
      companyId,
      limit: req.query?.limit,
      onlyBound,
      onlyUnbound,
      allowGlobalUnbound: isAdminLike && (globalUnbound === "1" || globalUnbound === "true")
    });

    return res.status(200).json({
      ok: true,
      data: {
        ...result,
        viewer: {
          marker: "__AUTOATENDE_R10E_A3_VIEWER_METADATA__",
          resolved_role: role || null,
          is_admin_like: isAdminLike,
          resolved_company_id: companyId || null
        },
        route_marker: "__AUTOATENDE_R10E_A_RECENT_ROUTE__"
      }
    });
  } catch (error) {
    console.error("[R10E-A1] acquisition recent failed", {
      route_marker: "__AUTOATENDE_R10E_A_RECENT_ROUTE__",
      message: String(error?.message || error)
    });

    const message = String(error?.message || error || "");
    const isBadRequest = ["INVALID_BOUND_FILTER_COMBINATION", "MISSING_COMPANY_SCOPE"].includes(message);

    return res.status(isBadRequest ? 400 : 500).json({
      ok: false,
      error: "ACQUISITION_RECENT_FAILED",
      message,
      route_marker: "__AUTOATENDE_R10E_A_RECENT_ROUTE__"
    });
  }
});

module.exports = router;
