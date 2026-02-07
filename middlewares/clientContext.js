const pool = require('../src/db/pool');

/**
 * clientContext
 * Middleware SERVER-TO-SERVER
 * Valida company_id diretamente na tabela clients
 */
module.exports = async function clientContext(req, res, next) {
  try {
    const companyId =
      req.body.company_id ||
      req.query.company_id ||
      req.params.company_id;

    if (!companyId) {
      return res.status(400).json({
        error: 'company_id is required'
      });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM public.clients
      WHERE id = $1
      LIMIT 1
      `,
      [companyId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Client not found',
        detail: 'Tenant or user not found'
      });
    }

    // Anexa o client no request
    req.client = result.rows[0];
    req.company_id = companyId;

    next();
  } catch (err) {
    console.error('[CLIENT CONTEXT ERROR]', err);
    return res.status(500).json({
      error: 'Internal client validation error',
      detail: err.message
    });
  }
};

