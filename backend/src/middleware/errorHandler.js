function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  console.error(`[ERROR] ${status} — ${message}`);
  if (err.stack && process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
