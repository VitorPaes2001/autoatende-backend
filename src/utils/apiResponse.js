const success = (res, data, statusCode = 200) => {
  return res.status(statusCode).json(data);
};

const error = (res, message, statusCode = 500, details = null) => {
  const response = {
    error: true,
    message
  };
  if (details) response.details = details;
  return res.status(statusCode).json(response);
};

module.exports = {
  success,
  error
};
