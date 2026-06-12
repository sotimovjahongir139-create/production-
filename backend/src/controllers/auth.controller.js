const jwt    = require('jsonwebtoken');
const config = require('../config/config');

function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (username !== 'admin' || password !== config.adminPassword) {
      return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
    }
    const token = jwt.sign({ username }, config.jwtSecret, { expiresIn: '8h' });
    res.json({ token });
  } catch (err) {
    next(err);
  }
}

module.exports = { login };
