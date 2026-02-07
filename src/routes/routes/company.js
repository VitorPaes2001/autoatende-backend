const express = require('express');
const router = express.Router();
const { getActivePlan } = require('../services/company.service');

router.get('/:companyId/plan', async (req, res) => {
  const plan = await getActivePlan(req.params.companyId);
  res.json(plan);
});

module.exports = router;

