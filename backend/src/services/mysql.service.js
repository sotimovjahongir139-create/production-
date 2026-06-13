const db = require('../db/mysql');

// ── helpers ─────────────────────────────────────────────────────────────────

function getPeriodDates(period) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fmt = d => d.toISOString().slice(0, 10);

  if (period === 'daily') {
    const from     = new Date(today); from.setDate(today.getDate() - 1);
    const to       = new Date(today);
    const prevFrom = new Date(today); prevFrom.setDate(today.getDate() - 2);
    const prevTo   = new Date(from);
    return { from: fmt(from), to: fmt(to), prevFrom: fmt(prevFrom), prevTo: fmt(prevTo) };
  }
  if (period === 'weekly') {
    const wd       = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const from     = new Date(today); from.setDate(today.getDate() - wd);
    const to       = new Date(from);  to.setDate(from.getDate() + 7);
    const prevFrom = new Date(from);  prevFrom.setDate(from.getDate() - 7);
    const prevTo   = new Date(from);
    return { from: fmt(from), to: fmt(to), prevFrom: fmt(prevFrom), prevTo: fmt(prevTo) };
  }
  // monthly
  const from     = new Date(today.getFullYear(), today.getMonth(), 1);
  const to       = new Date(today); to.setDate(today.getDate() + 1);
  const prevFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevTo   = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: fmt(from), to: fmt(to), prevFrom: fmt(prevFrom), prevTo: fmt(prevTo) };
}

function deptStatus(eff, kirdi) {
  if (!kirdi) return 'good';
  return eff >= 85 ? 'good' : eff >= 60 ? 'medium' : 'critical';
}

async function wrap(fn) {
  try   { return await fn(); }
  catch { const e = new Error("Bazaga ulanib bo'lmadi"); e.status = 503; throw e; }
}

// ── getCards ─────────────────────────────────────────────────────────────────

async function runCards(f, t) {
  return db.query(`
    SELECT j.id, j.name,
      COUNT(CASE WHEN p.started >= ? AND p.started < ? THEN 1 END) AS kirdi,
      COUNT(CASE WHEN p.started  >= ? AND p.started  < ?
                 AND p.finished >= ? AND p.finished < ? THEN 1 END) AS bajarildi
    FROM production_proizvodstvo p
    JOIN production_jarayon j ON p.jarayon_id = j.id
    WHERE p.started >= ? AND p.started < ?
    GROUP BY j.id, j.name ORDER BY j.id`,
    [f, t, f, t, f, t, f, t]
  );
}

async function getCards(period) {
  return wrap(async () => {
    const { from, to, prevFrom, prevTo } = getPeriodDates(period);
    const [cur, prv] = await Promise.all([runCards(from, to), runCards(prevFrom, prevTo)]);

    const total     = cur.reduce((s, r) => s + (r.kirdi     || 0), 0);
    const completed = cur.reduce((s, r) => s + (r.bajarildi || 0), 0);
    const prevTotal = prv.reduce((s, r) => s + (r.kirdi     || 0), 0);
    const eff = total ? Math.round(completed / total * 1000) / 10 : 0;
    const chg = prevTotal ? Math.round((total - prevTotal) / prevTotal * 1000) / 10 : null;

    const departments = cur.map(r => {
      const e = r.kirdi ? Math.round(r.bajarildi / r.kirdi * 1000) / 10 : 0;
      return { name: r.name, came_in: r.kirdi || 0, completed: r.bajarildi || 0,
               efficiency: e, status: deptStatus(e, r.kirdi || 0) };
    });

    return { kpi: { total_in: total, completed, efficiency_pct: eff,
                    change_vs_prev_pct: chg }, departments };
  });
}

// ── getSklad ─────────────────────────────────────────────────────────────────

async function getSklad(period) {
  return wrap(async () => {
    const { from, to } = getPeriodDates(period);

    const [[ov], [ord], [ib], [ob], [avg]] = await Promise.all([
      db.query(
        `SELECT COUNT(*) AS karta, COALESCE(SUM(quantity),0) AS dona
         FROM production_zakaz
         WHERE finished IS NULL AND deadline >= ? AND deadline < ?
           AND (status IS NULL OR status <> 'Otmen')`,
        [from, to]
      ),
      db.query(
        `SELECT COUNT(*) AS zakaz_soni FROM production_skladzakaz
         WHERE created >= ? AND created < ?`,
        [from, to]
      ),
      db.query(
        `SELECT COUNT(*) AS kirdi, COALESCE(SUM(quantity),0) AS dona,
                COUNT(CASE WHEN finished IS NOT NULL THEN 1 END) AS bajarildi
         FROM production_proizvodstvo
         WHERE jarayon_id = 5 AND started >= ? AND started < ?`,
        [from, to]
      ),
      db.query(
        `SELECT COUNT(*) AS chiqim, COALESCE(SUM(quantity),0) AS dona,
                SUM(approved=1) AS tasdiqlangan
         FROM production_sotuv
         WHERE sold_date >= ? AND sold_date < ?`,
        [from, to]
      ),
      db.query(
        `SELECT ROUND(AVG(DATEDIFF(s.sold_date, z.created)),1) AS ortacha_kun
         FROM production_sotuv s JOIN production_zakaz z ON s.order_id = z.id
         WHERE s.approved = 1 AND s.sold_date >= ? AND s.sold_date < ?`,
        [from, to]
      ),
    ]);

    const ibKirdi = Number(ib.kirdi)        || 0;
    const ibBaj   = Number(ib.bajarildi)    || 0;
    const obKirdi = Number(ob.chiqim)       || 0;
    const obTasd  = Number(ob.tasdiqlangan) || 0;

    return {
      orders:   { count: ord.zakaz_soni || 0 },
      inbound:  { came_in: ibKirdi, completed: ibBaj,
                  pct: ibKirdi ? Math.round(ibBaj / ibKirdi * 1000) / 10 : 0 },
      outbound: { came_in: obKirdi, approved: obTasd,
                  pct: obKirdi ? Math.round(obTasd / obKirdi * 1000) / 10 : 0 },
      avg_lead_time_days: avg.ortacha_kun ?? null,
      overdue_count: ov.karta || 0,
    };
  });
}

// ── getWip ───────────────────────────────────────────────────────────────────

async function getWip(period = 'monthly') {
  return wrap(async () => {
    const { from, to } = getPeriodDates(period);

    const [deptRows, cardRows] = await Promise.all([
      db.query(`
        SELECT j.name AS bolim,
          COALESCE(COUNT(CASE WHEN p.finished IS NULL
            AND p.started >= ? AND p.started < ? THEN 1 END), 0) AS soni
        FROM production_jarayon j
        LEFT JOIN production_proizvodstvo p ON p.jarayon_id = j.id
        GROUP BY j.id, j.name ORDER BY j.id`,
        [from, to]
      ),
      db.query(`
        SELECT p.id AS prod_id, p.zp_id, j.name AS bolim,
          p.started, zp.order_id, zp.quantity,
          DATEDIFF(CURDATE(), p.started) AS necha_kun
        FROM production_proizvodstvo p
        JOIN production_jarayon j ON p.jarayon_id = j.id
        LEFT JOIN production_zakazproizvodstvo zp ON p.zp_id = zp.id
        WHERE p.finished IS NULL AND p.started >= ? AND p.started < ?
        ORDER BY j.id, p.started`,
        [from, to]
      ),
    ]);

    const colMap = {};
    for (const d of deptRows) {
      colMap[d.bolim] = { department: d.bolim, count: 0, cards: [] };
    }
    for (const r of cardRows) {
      if (!colMap[r.bolim]) colMap[r.bolim] = { department: r.bolim, count: 0, cards: [] };
      const title = r.order_id ? `Zakaz #${r.order_id}` : `Kartochka #${r.prod_id}`;
      colMap[r.bolim].cards.push({
        id: String(r.prod_id), title,
        days_in_stage: r.necha_kun || 0,
        quantity: r.quantity || null,
        status: 'ok',
      });
      colMap[r.bolim].count++;
    }

    const columns = Object.values(colMap);
    const all = columns.flatMap(c => c.cards);
    return {
      summary: { total: all.length, overdue: 0, due_soon: 0 },
      columns,
    };
  });
}

// ── getProducts ───────────────────────────────────────────────────────────────

async function getProducts(period) {
  return wrap(async () => {
    const { from, to } = getPeriodDates(period);

    const [[kpiRow], products] = await Promise.all([
      db.query(`
        SELECT COALESCE(SUM(d.quantity),0) AS jami_fakt,
               COUNT(DISTINCT d.product_id) AS tovar_turi
        FROM production_dailyproductproduction d
        WHERE d.date >= ? AND d.date < ?`,
        [from, to]
      ),
      db.query(`
        SELECT m.name AS mahsulot, SUM(d.quantity) AS fakt,
               ROUND(SUM(d.quantity) / SUM(SUM(d.quantity)) OVER() * 100, 1) AS ulush_pct
        FROM production_dailyproductproduction d
        JOIN production_mahsulot m ON d.product_id = m.id
        WHERE d.date >= ? AND d.date < ?
        GROUP BY m.id, m.name
        ORDER BY fakt DESC`,
        [from, to]
      ),
    ]);

    const totalFakt = Number(kpiRow.jami_fakt)  || 0;
    const tovarTuri = Number(kpiRow.tovar_turi) || 0;
    const top5      = products.slice(0, 5);
    const othFakt   = products.slice(5).reduce((s, p) => s + (Number(p.fakt) || 0), 0);

    const share = [
      ...top5.map(p => ({ name: p.mahsulot, pct: Number(p.ulush_pct) || 0 })),
      ...(othFakt && totalFakt
        ? [{ name: 'Boshqalar', pct: Math.round(othFakt / totalFakt * 1000) / 10 }]
        : []),
    ];
    const productList = products.map(p => ({ name: p.mahsulot, fakt: Number(p.fakt) || 0, reja: null }));
    const largest     = productList[0] || { name: '—', fakt: 0 };

    return {
      kpi: { jami_reja: null, fakt: totalFakt, bajarilish_pct: null,
             product_types: tovarTuri,
             largest: { name: largest.name, units: largest.fakt } },
      products: productList,
      share,
    };
  });
}

module.exports = { getCards, getProducts, getSklad, getWip };
