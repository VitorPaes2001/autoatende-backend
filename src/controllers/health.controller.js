const healthService = require('../services/health.service');
const apiResponse = require('../utils/apiResponse');
const AppError = require('../utils/AppError');
const logger = require('../../utils/logger');

const check = (req, res) => {
  return apiResponse.success(res, { status: 'ok' });
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
      services.database = 'error';
      logger.error(`Health check failed: Database - ${err.message}`);
    }

    // Check Redis
    try {
      await healthService.checkRedis();
      services.redis = 'ok';
    } catch (err) {
      services.redis = 'error';
      logger.error(`Health check failed: Redis - ${err.message}`);
    }

    // Verify status
    if (services.database === 'error' || services.redis === 'error') {
      let message = 'Dependency failure';
      if (services.database === 'error' && services.redis === 'error') {
        message = 'Database and Redis unavailable';
      } else if (services.database === 'error') {
        message = 'Database unavailable';
      } else if (services.redis === 'error') {
        message = 'Redis unavailable';
      }

      const error = new AppError(message, 503, services);
      error.code = 'DEPENDENCY_FAILURE';
      throw error;
    }

    return apiResponse.success(res, {
      status: 'ok',
      services
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  check,
  deepCheck
};
