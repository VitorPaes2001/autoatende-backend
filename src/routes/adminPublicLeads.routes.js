'use strict';

/**
 * __AUTOATENDE_V4_R37B_LEAD_STATUS_MANAGEMENT_BACKEND_FRONTEND_SAFE__
 * Protected admin route for public landing leads.
 */

const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const {
  listAdminPublicLeads,
  updateAdminPublicLeadStatus
} = require('../services/adminPublicLeads.service');

const router = express.Router();

const allowedRoles = ['company', 'admin', 'owner'];

router.get('/', authMiddleware, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const result = await listAdminPublicLeads(req.query || {});
    return res.json({
      ok: true,
      ...result,
      marker: '__AUTOATENDE_V4_R37B_LEAD_STATUS_MANAGEMENT_BACKEND_FRONTEND_SAFE__'
    });
  } catch (error) {
    error.status = error.status || 500;
    error.code = error.code || 'ADMIN_PUBLIC_LEADS_LIST_FAILED';
    return next(error);
  }
});

router.patch('/:id/status', authMiddleware, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const result = await updateAdminPublicLeadStatus(req.params.id, req.body?.status);
    return res.json({
      ok: true,
      ...result,
      marker: '__AUTOATENDE_V4_R37B_LEAD_STATUS_MANAGEMENT_BACKEND_FRONTEND_SAFE__'
    });
  } catch (error) {
    error.status = error.status || 500;
    error.code = error.code || 'ADMIN_PUBLIC_LEAD_STATUS_UPDATE_FAILED';
    return next(error);
  }
});

module.exports = router;
