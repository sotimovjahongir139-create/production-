const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth.middleware');
const { getCards, getProducts, getSklad, getWip } = require('../controllers/data.controller');

router.use(auth);
router.get('/cards',    getCards);
router.get('/products', getProducts);
router.get('/sklad',    getSklad);
router.get('/wip',      getWip);

module.exports = router;
