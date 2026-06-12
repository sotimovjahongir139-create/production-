function logger(req, res, next) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
}

module.exports = logger;
