function pct(a, b) {
  if (!b) return 0;
  return Math.round((a / b) * 1000) / 10;
}

function changePct(current, previous) {
  if (!previous) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function deptStatus(efficiency) {
  if (efficiency >= 85) return 'good';
  if (efficiency >= 60) return 'medium';
  return 'critical';
}

module.exports = { pct, changePct, deptStatus };
