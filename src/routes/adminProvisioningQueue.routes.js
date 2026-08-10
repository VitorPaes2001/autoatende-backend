const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const adminProvisioningQueueService = require('../services/adminProvisioningQueue.service');
const allowedRoles = ['company', 'admin', 'owner'];

const router = express.Router();



const aaAdminGuards = [
  authMiddleware,
  requireRole(allowedRoles),
].filter(Boolean);

function asyncHandler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      const statusCode = error.statusCode || error.status || 500;

      return res.status(statusCode).json({
        ok: false,
        error: error.message || 'admin_provisioning_queue_error',
        details: error.details || undefined,
      });
    }
  };
}

router.get('/queue', ...aaAdminGuards, asyncHandler(async (req, res) => {
  const result = await adminProvisioningQueueService.listQueue(req.query || {});
  return res.status(200).json(result);
}));

router.get('/queue/:id', ...aaAdminGuards, asyncHandler(async (req, res) => {
  const result = await adminProvisioningQueueService.getQueueById(req.params.id);
  return res.status(200).json(result);
}));

router.patch('/queue/:id', ...aaAdminGuards, asyncHandler(async (req, res) => {
  const result = await adminProvisioningQueueService.updateQueueItem(req.params.id, req.body || {});
  return res.status(200).json(result);
}));


// __AUTOATENDE_STRIPE_PHASE2R_D5D_B_ADMIN_COMPANY_ACTIVATION_ROUTE__
// Prepara empresa/client/subscription a partir de contratação paga.
// Protegido por auth + role e também pelo platformOwnerOnly global em app.js.
router.post('/queue/:id/prepare-activation', ...aaAdminGuards, asyncHandler(async (req, res) => {
  const actor = {
    id: req.user?.id || req.userId || null,
    user_id: req.user?.user_id || null,
    email: req.user?.email || req.auth?.email || null,
    role: req.user?.role || req.auth?.role || null,
  };

  const result = await adminProvisioningQueueService.prepareCompanyActivation(req.params.id, actor);

  return res.status(result.idempotent ? 200 : 201).json(result);
}));


// __AUTOATENDE_STRIPE_PHASE2R_D5E_B_OWNER_ACCESS_ROUTE__
// Cria/vincula acesso do dono da empresa já preparada.
// Protegido por auth + role e também por platformOwnerOnly global no app.js.
router.post('/queue/:id/prepare-owner-access', ...aaAdminGuards, asyncHandler(async (req, res) => {
  const actor = {
    id: req.user?.id || req.userId || null,
    user_id: req.user?.user_id || null,
    email: req.user?.email || req.auth?.email || null,
    role: req.user?.role || req.auth?.role || null,
  };

  const result = await adminProvisioningQueueService.prepareOwnerAccess(
    req.params.id,
    req.body || {},
    actor
  );

  return res.status(result.idempotent ? 200 : 201).json(result);
}));

module.exports = router;
