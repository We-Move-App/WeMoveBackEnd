const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: err.success || false,
    statusCode,
    message,
    errors: err.errors || [],
    data: err.data || null,
  });
};

module.exports = errorHandler;
