const healthService = require('../services/health.service');
const apiResponse = require('../utils/apiResponse');
const logger = require('../../utils/logger');

const check = (req, res) => {
  return res.status(200).json({ status: 'ok' });
};

const deepCheck = async (req, res, next) => {
  const services = {
    database: 'pending',
    redis: 'pending'
  };

  try {
    // Check Database
    try {
      await healthService.checkDatabase();
      services.database = 'ok';
    } catch (err) {
      services.database = 'down'; // Requirement asks for 'down' on failure
      logger.error(`Health check failed: Database - ${err.message}`);
    }

    // Check Redis
    try {
      await healthService.checkRedis();
      services.redis = 'ok';
    } catch (err) {
      services.redis = 'down'; // Requirement asks for 'down' on failure
      logger.error(`Health check failed: Redis - ${err.message}`);
    }

    // Verify status
    if (services.database === 'down' || services.redis === 'down') {
      // Retorna 503 com formato específico solicitado, evitando o global handler
      return res.status(503).json({
        status: 'error',
        code: 'DEPENDENCY_FAILURE',
        services
      });
    }

    return res.status(200).json({
      status: 'ok',
      services
    });
  } catch (err) {
    // Erro inesperado (ex: crash no código acima)
    logger.error(`Health check critical error: ${err.message}`);
    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
};

module.exports = {
  check,
  deepCheck
};
