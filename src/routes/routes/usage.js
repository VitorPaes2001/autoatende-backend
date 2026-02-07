const express = require('express');
const router = express.Router();

const companyService = require('../services/company.service');

router.get('/:companyId', async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);

    if (!companyId) {
      return res.status(400).json({ error: 'Invalid companyId' });
    }

    const report = await companyService.getUsageReport(companyId);

    return res.json(report);
  } catch (err) {
    console.error('[USAGE]', err);
    return res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

module.exports = router;

