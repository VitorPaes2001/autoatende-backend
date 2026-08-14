const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/role.middleware");
const agentSeatLimit = require("../middlewares/agentSeatLimitFailSoft.middleware") // __AUTOATENDE_V4_R12D_A3_FAIL_SOFT_UNRESOLVED_AGENT_SEAT_LIMIT__;
const { checkResourceLimit } = require("../middlewares/plan.middleware");
const usersController = require("../controllers/users.controller");

const effectiveBillingTenantForAgent = require('../middlewares/effectiveBillingTenantForAgent.middleware'); // __AUTOATENDE_V4_R12D_B2R2_ALLOW_AGENT_FULL_DISPAROS_MODULE__

const router = express.Router();
const allowedRoles = ["company", "admin", "owner"]; /* __AUTOATENDE_C16M_B2_R1_USERS_RBAC_ALIGNMENT__ */

// __AUTOATENDE_V4_R12D_B2R2_ALLOW_AGENT_FULL_DISPAROS_MODULE__
router.get(
  "/agents",
  authMiddleware,
  requireRole(allowedRoles),
  usersController.listAgents
);




// __AUTOATENDE_R12B_R1C_AGENT_SEAT_STATUS_ROUTE_START__
// __AUTOATENDE_V4_R12B_R1C_FIX_AGENT_SEAT_STATUS_ROUTE_MIDDLEWARES__
// __AUTOATENDE_V4_R12D_B2R2_ALLOW_AGENT_FULL_DISPAROS_MODULE__
router.get(
  "/agents/seat-status",
  authMiddleware,
  requireRole(allowedRoles),
  async (req, res) => {
    try {
      const status = await agentSeatLimit.resolveAgentSeatStatus(req);

      console.info("[AGENT_SEAT_STATUS]", JSON.stringify(status));

      return res.json({
        ok: true,
        status
      });
    } catch (error) {
      console.warn("[AGENT_SEAT_STATUS]", JSON.stringify({
        marker: "__AUTOATENDE_V4_R12B_R1C_FIX_AGENT_SEAT_STATUS_ROUTE_MIDDLEWARES__",
        action: "status_error",
        error: String(error?.message || error)
      }));

      return res.status(503).json({
        ok: false,
        error: "Não foi possível consultar o limite de agentes neste momento.",
        code: "AGENT_SEAT_STATUS_UNAVAILABLE"
      });
    }
  }
);
// __AUTOATENDE_R12B_R1C_AGENT_SEAT_STATUS_ROUTE_END__

router.post(
  "/agents",
  authMiddleware,
  requireRole(allowedRoles),
  agentSeatLimit(), // __AUTOATENDE_V4_R12B_R1_FIX_AGENT_SEAT_BACKEND_GUARD_REPORT_MODE_NO_HOST_NODE__
  checkResourceLimit,
  usersController.createAgent
);

router.delete(
  "/agents/:id",
  authMiddleware,
  requireRole(allowedRoles),
  usersController.deleteAgent
);


/* __AUTOATENDE_C8C_R3_AGENT_REASSIGN_ROUTE__ */
router.post(
  "/agents/:id/reassign",
  authMiddleware,
  requireRole(allowedRoles),
  usersController.reassignAgentConversations
);

module.exports = router;
