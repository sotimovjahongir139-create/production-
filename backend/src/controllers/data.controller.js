const dataService = require('../services/data.service');

const VALID_PERIODS = ['daily', 'weekly', 'monthly'];

function getPeriod(req) {
  const p = req.query.period || 'monthly';
  if (!VALID_PERIODS.includes(p)) {
    throw Object.assign(new Error('Invalid period'), { status: 400 });
  }
  return p;
}

async function getCards(req, res, next) {
  try { res.json(await dataService.getCards(getPeriod(req))); }
  catch (err) { next(err); }
}

async function getProducts(req, res, next) {
  try { res.json(await dataService.getProducts(getPeriod(req))); }
  catch (err) { next(err); }
}

async function getSklad(req, res, next) {
  try { res.json(await dataService.getSklad(getPeriod(req))); }
  catch (err) { next(err); }
}

async function getWip(req, res, next) {
  try { res.json(await dataService.getWip(getPeriod(req))); }
  catch (err) { next(err); }
}

module.exports = { getCards, getProducts, getSklad, getWip };
