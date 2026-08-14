class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    if (details && typeof details === 'object' && !Array.isArray(details)) {
      const reservedKeys = new Set([
        'name',
        'message',
        'statusCode',
        'status',
        'isOperational',
        'stack',
        'details'
      ]);

      for (const [key, value] of Object.entries(details)) {
        if (!reservedKeys.has(key) && this[key] === undefined) {
          this[key] = value;
        }
      }
    }

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
