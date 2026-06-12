const express    = require('express');
const router     = express.Router();
const config     = require('../config/config');
const authRoutes = require('./auth.routes');
const dataRoutes = require('./data.routes');

router.get('/health', async (req, res) => {
  if (config.dataSource !== 'mysql') {
    return res.json({ db: 'ok', mode: config.dataSource });
  }
  try {
    const db = require('../db/mysql');
    await db.query('SELECT 1');
    res.json({ db: 'ok' });
  } catch (err) {
    const codeMap = {
      ECONNREFUSED:        'Connection refused',
      ENOTFOUND:           'Host not found',
      ETIMEDOUT:           'Connection timed out',
      ER_ACCESS_DENIED_ERROR: 'Authentication failed',
      ER_BAD_DB_ERROR:     'Database not found',
    };
    res.status(503).json({ db: 'down', error: codeMap[err.code] || 'Connection failed' });
  }
});

router.use('/auth', authRoutes);
router.use('/',     dataRoutes);

module.exports = router;
