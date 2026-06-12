const db = require('../db/mysql');

// ── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d) { return d.toISOString().slice(0, 10); }

function getRange(period) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tom   = new Date(today); tom.setDate(tom.getDate() + 1);
  let from, to_excl, pf, pt;

  if (period === 'daily') {
    from = today; to_excl = tom;
    pf = new Date(today); pf.setDate(pf.getDate() - 1); pt = today;
  } else if (period === 'weekly') {
    from = new Date(today); from.setDate(from.getDate() - 6); to_excl = tom;
    pf = new Date(from); pf.setDate(pf.getDate() - 7); pt = from;
  } else {
    from = new Date(today.getFullYear(), today.getMonth(), 1); to_excl = tom;
    const len = Math.round((to_excl - from) / 86400000);
    pf = new Date(from); pf.setDate(pf.getDate() - len); pt = from;
  }
  return { from: fmtDate(from), to: fmtDate(to_excl),
           pf: fmtDate(pf),   pt: fmtDate(pt) };
}

function deptStatus(eff) {
  return eff >= 85 ? 'good' : eff >= 60 ? 'medium' : 'critical';
}

async function wrap(fn) {
  try   { return await fn(); }
  catch { const e = new Error("Bazaga ulanib bo'lmadi"); e.status = 503; throw e; }
}

// ── getCards ─────────────────────────────────────────────────────────────────

async function runCards(f, t) {
  const sql = `
    SELECT j.id, j.name,
      SUM(p.started  >= ? AND p.started  < ?) AS kirdi,
      SUM(p.finished >= ? AND p.finished < ?) AS bajarildi
    FROM production_proizvodstvo p
    JOIN production_jarayon j ON p.jarayon_id = j.id
    WHERE (p.started >= ? AND p.started < ?)
       OR (p.finished >= ? AND p.finished < ?)
    GROUP BY j.id, j.name ORDER BY j.id`;
  return db.query(sql, [f, t, f, t, f, t, f, t]);
}

async function getCards(period) {
  return wrap(async () => {
    const { from, to, pf, pt } = getRange(period);
    const [cur, prv] = await Promise.all([runCards(from, to), runCards(pf, pt)]);

    const total     = cur.reduce((s, r) => s + (r.kirdi     || 0), 0);
    const completed = cur.reduce((s, r) => s + (r.bajarildi || 0), 0);
    const prevComp  = prv.reduce((s, r) => s + (r.bajarildi || 0), 0);
    const eff       = total ? Math.round(completed / total * 1000) / 10 : 0;
    const chg       = prevComp ? Math.round((completed - prevComp) / prevComp * 1000) / 10 : null;

    const departments = cur.map(r => {
      const e = r.kirdi ? Math.round(r.bajarildi / r.kirdi * 1000) / 10 : 0;
      return { name: r.name, came_in: r.kirdi || 0, completed: r.bajarildi || 0,
               efficiency: e, status: deptStatus(e) };
    });

    return { kpi: { total_in: total, completed, efficiency_pct: eff,
                    change_vs_prev_pct: chg }, departments };
  });
}

// ── getSklad ─────────────────────────────────────────────────────────────────

async function getSklad(period) {
  return wrap(async () => {
    const { from, to } = getRange(period);

    // Real-time (ignores period)
    const [ov] = await db.query(
      `SELECT COUNT(*) AS karta, COALESCE(SUM(quantity),0) AS dona
       FROM production_zakaz
       WHERE finished IS NULL AND deadline < CURDATE()
         AND (status IS NULL OR status <> 'Otmen')`  // TODO: verify cancel label via inspect-schema
    );
    const [avg] = await db.query(
      `SELECT ROUND(AVG(DATEDIFF(s.sold_date, z.created)),1) AS kun
       FROM production_sotuv s JOIN production_zakaz z ON s.order_id = z.id
       WHERE s.approved = 1 AND s.sold_date >= CURDATE() - INTERVAL 30 DAY`
    );

    // Period-bound
    const [ord] = await db.query(
      `SELECT COUNT(*) AS cnt FROM production_skladzakaz
       WHERE created >= ? AND created < ?`, [from, to]
    );
    const [ib] = await db.query(
      `SELECT SUM(started  >= ? AND started  < ?) AS kirdi,
              SUM(finished >= ? AND finished < ?) AS bajarildi
       FROM production_proizvodstvo
       WHERE jarayon_id = 5
         AND ((started >= ? AND started < ?) OR (finished >= ? AND finished < ?))`,
      [from, to, from, to, from, to, from, to]
    );
    const [ob] = await db.query(
      `SELECT COUNT(*) AS kirdi, SUM(approved=1) AS tasdiqlandi
       FROM production_sotuv WHERE sold_date >= ? AND sold_date < ?`,
      [from, to]
    );

    const ibKirdi = ib[0].kirdi      || 0;
    const ibBaj   = ib[0].bajarildi  || 0;
    const obKirdi = ob[0].kirdi      || 0;
    const obTasd  = ob[0].tasdiqlandi|| 0;

    return {
      orders:   { count: ord[0].cnt || 0 },
      inbound:  { came_in: ibKirdi, completed: ibBaj,
                  pct: ibKirdi ? Math.round(ibBaj / ibKirdi * 1000) / 10 : 0 },
      outbound: { came_in: obKirdi, approved: obTasd,
                  pct: obKirdi ? Math.round(obTasd / obKirdi * 1000) / 10 : 0 },
      avg_lead_time_days: avg[0].kun ?? null,
      overdue_count: ov[0].karta || 0,
    };
  });
}

// ── getWip ───────────────────────────────────────────────────────────────────

async function getWip() {
  return wrap(async () => {
    const rows = await db.query(`
      SELECT p.id, j.id AS jarayon_id, j.name AS bolim, p.started,
             DATEDIFF(CURDATE(), p.started) AS days_in_stage,
             z.id AS zakaz_id, z.deadline,
             CASE WHEN z.deadline IS NULL THEN 'ok'
                  WHEN z.deadline < CURDATE() THEN 'overdue'
                  WHEN z.deadline < CURDATE() + INTERVAL 4 DAY THEN 'due_soon'
                  ELSE 'ok' END AS holat
      FROM production_proizvodstvo p
      JOIN production_jarayon j ON p.jarayon_id = j.id
      LEFT JOIN production_zakazproizvodstvo zp ON p.zp_id = zp.id
      LEFT JOIN production_zakaz z ON zp.order_id = z.id
      WHERE p.finished IS NULL
      ORDER BY j.id,
               FIELD(CASE WHEN z.deadline IS NULL THEN 'ok'
                          WHEN z.deadline < CURDATE() THEN 'overdue'
                          WHEN z.deadline < CURDATE() + INTERVAL 4 DAY THEN 'due_soon'
                          ELSE 'ok' END, 'overdue','due_soon','ok'),
               z.deadline`
    );

    const colMap = {};
    for (const r of rows) {
      if (!colMap[r.bolim]) colMap[r.bolim] = { department: r.bolim, count: 0, cards: [] };
      // TODO: after inspect-schema.js, replace fallback title with real client+product columns
      const title = r.zakaz_id ? `Zakaz #${r.zakaz_id}` : `Kartochka #${r.id}`;
      const dl    = r.deadline ? new Date(r.deadline).toISOString().slice(0, 10) : null;
      colMap[r.bolim].cards.push({ id: String(r.id), title, deadline: dl,
                                   days_in_stage: r.days_in_stage || 0, status: r.holat });
      colMap[r.bolim].count++;
    }
    const columns = Object.values(colMap);
    const all = columns.flatMap(c => c.cards);
    return {
      summary: { total: all.length,
                 overdue:  all.filter(c => c.status === 'overdue').length,
                 due_soon: all.filter(c => c.status === 'due_soon').length },
      columns,
    };
  });
}

// ── getProducts ───────────────────────────────────────────────────────────────
// TODO: run inspect-schema.js to confirm:
//   (1) product name column in production_zakazproizvodstvo or joined mahsulot table
//   (2) actual-units source (production_proizvodstvo.quantity vs COUNT(*))
//   (3) plan source column name
// Interim: groups by zakaz_id; replace GROUP BY + name column after inspection.

async function getProducts(period) {
  return wrap(async () => {
    const { from, to } = getRange(period);
    // Fakt: count finished productions per zakaz in window
    const rows = await db.query(`
      SELECT zp.order_id AS zakaz_id,
             COUNT(p.id) AS fakt,
             SUM(zp.quantity) AS reja
      FROM production_zakazproizvodstvo zp
      JOIN production_zakaz z ON zp.order_id = z.id
      LEFT JOIN production_proizvodstvo p
             ON p.zp_id = zp.id AND p.finished >= ? AND p.finished < ?
      WHERE z.created >= ? AND z.created < ?
      GROUP BY zp.order_id
      HAVING fakt > 0
      ORDER BY fakt DESC
      LIMIT 50`, [from, to, from, to]
    );

    const products = rows.map(r => ({
      name: `Zakaz #${r.zakaz_id}`,  // TODO: replace with real product name after inspection
      reja: r.reja || null,
      fakt: r.fakt || 0,
    }));

    const totalFakt = products.reduce((s, p) => s + p.fakt, 0);
    const totalReja = products.reduce((s, p) => s + (p.reja || 0), 0);
    const baj = totalReja ? Math.round(totalFakt / totalReja * 1000) / 10 : null;
    const top5 = products.slice(0, 5);
    const othFakt = products.slice(5).reduce((s, p) => s + p.fakt, 0);
    const share = [
      ...top5.map(p => ({ name: p.name, pct: totalFakt ? Math.round(p.fakt / totalFakt * 1000) / 10 : 0 })),
      ...(othFakt ? [{ name: 'Boshqalar', pct: Math.round(othFakt / totalFakt * 1000) / 10 }] : []),
    ];
    const largest = products[0] || { name: '—', units: 0 };

    return {
      kpi: { jami_reja: totalReja || null, fakt: totalFakt,
             bajarilish_pct: baj, product_types: products.length,
             largest: { name: largest.name, units: largest.fakt } },
      products, share,
    };
  });
}

module.exports = { getCards, getProducts, getSklad, getWip };
