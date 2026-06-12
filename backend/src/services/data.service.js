const config = require('../config/config');

let service;
if (config.dataSource === 'mysql') {
  service = require('./mysql.service');
} else {
  service = require('./mock.service');
}

module.exports = service;
