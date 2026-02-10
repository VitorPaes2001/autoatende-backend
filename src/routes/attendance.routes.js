const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const rateLimit = require('../middlewares/rateLimit.middleware');
const auditLogger = require('../middlewares/audit.middleware');
const { requirePlan } = require('../middlewares/plan.middleware');

// Rotas de controle de atendimento
// Auth + RBAC + Audit + RateLimit + Plan

// Todos os perfis (agent, company, admin) podem operar o atendimento
const allowedRoles = ['agent', 'company', 'admin'];

router.post('/transfer/human', 
  authMiddleware, 
  requireRole(allowedRoles), 
  requirePlan('start'),
  rateLimit(50, 60), 
  auditLogger,
  attendanceController.transferToHuman
);

router.post('/transfer/agent', 
  authMiddleware, 
  requireRole(allowedRoles), 
  requirePlan('start'),
  rateLimit(50, 60),
  auditLogger,
  attendanceController.transferToAgent
);

router.post('/return/bot', 
  authMiddleware, 
  requireRole(allowedRoles), 
  requirePlan('start'),
  rateLimit(50, 60),
  auditLogger,
  attendanceController.returnToBot
);

router.get('/state', 
  authMiddleware, 
  requireRole(allowedRoles),
  requirePlan('start'),
  rateLimit(100, 60),
  attendanceController.getState
);

module.exports = router;
