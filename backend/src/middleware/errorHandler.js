const { ZodError } = require('zod');
const multer = require('multer');

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function notFound(req, res, next) {
  next(new ApiError(404, `Not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Validation failed', details: err.flatten() });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Upload error: ${err.code}` });
  }
  const status = err.status || 500;
  const message = err.status ? err.message : 'Internal server error';
  if (status >= 500) console.error(err);
  return res.status(status).json({ message });
}

module.exports = { ApiError, notFound, errorHandler };
