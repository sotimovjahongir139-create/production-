const cardsData    = require('../data/mock/cards.json');
const productsData = require('../data/mock/products.json');
const skladData    = require('../data/mock/sklad.json');
const wipData      = require('../data/mock/wip.json');

function getCards(period) {
  const data = cardsData[period];
  if (!data) throw Object.assign(new Error('Invalid period'), { status: 400 });

  const { kpi, prev_kpi, departments } = data;
  let change_vs_prev_pct = null;
  if (prev_kpi && prev_kpi.completed) {
    change_vs_prev_pct = Math.round(
      ((kpi.completed - prev_kpi.completed) / prev_kpi.completed) * 1000
    ) / 10;
  }

  return { kpi: { ...kpi, change_vs_prev_pct }, departments };
}

function getProducts(period) {
  const data = productsData[period];
  if (!data) throw Object.assign(new Error('Invalid period'), { status: 400 });
  return data;
}

function getSklad(period) {
  const data = skladData[period];
  if (!data) throw Object.assign(new Error('Invalid period'), { status: 400 });
  return data;
}

function getWip() {
  return wipData;
}

module.exports = { getCards, getProducts, getSklad, getWip };
