const express      = require('express');
const path         = require('path');
const cors         = require('cors');
const config       = require('./config/config');
const logger       = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const apiRoutes    = require('./routes/index');

const app = express();

app.use(cors());
app.use(express.json());
app.use(logger);

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../../frontend')));

// API routes
app.use('/api', apiRoutes);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[server] running on http://localhost:${config.port} (DATA_SOURCE=${config.dataSource})`);
});
