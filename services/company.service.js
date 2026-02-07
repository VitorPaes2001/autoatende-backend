const pool = require('../src/db/pool');

async function getActivePlan(companyId) {
  const { rows } = await pool.query(`
    SELECT p.*
    FROM company_plans cp
    JOIN plans p ON p.id = cp.plan_id
    WHERE cp.company_id = $1
      AND cp.active = true
    LIMIT 1
  `, [companyId]);

  return rows[0] || null;
}

module.exports = {
  getActivePlan
};

