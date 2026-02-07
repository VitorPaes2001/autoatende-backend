module.exports = function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err);

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    error: true,
    message: err.message || 'Internal server error'
  });
};

