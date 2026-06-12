require('dotenv').config();
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

const outPath = path.join(__dirname, 'schema-report.txt');
const stream  = fs.createWriteStream(outPath);

function log(msg = '') {
  console.log(msg);
  stream.write(msg + '\n');
}

const CORE_TABLES = [
  'production_proizvodstvo',
  'production_jarayon',
  'production_zakaz',
  'production_zakazproizvodstvo',
  'production_skladzakaz',
  'production_sotuv',
];

async function desc(conn, table) {
  log(`\n=== DESCRIBE ${table} ===`);
  try {
    const [rows] = await conn.query(`DESCRIBE \`${table}\``);
    rows.forEach(r => log(`  ${r.Field.padEnd(30)} ${r.Type.padEnd(25)} NULL:${r.Null} KEY:${r.Key} DEFAULT:${r.Default}`));
  } catch (e) {
    log(`  ERROR: ${e.message}`);
  }
}

async function main() {
  const conn = await mysql.createConnection({
    host:    process.env.DB_HOST,
    port:    parseInt(process.env.DB_PORT) || 3306,
    user:    process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
  });

  log('=== SHOW TABLES ===');
  const [tables] = await conn.query('SHOW TABLES');
  const tableNames = tables.map(r => Object.values(r)[0]);
  tableNames.forEach(t => log('  ' + t));

  for (const t of CORE_TABLES) {
    await desc(conn, t);
  }

  log('\n=== SELECT * FROM production_jarayon ===');
  const [jars] = await conn.query('SELECT * FROM production_jarayon ORDER BY id');
  jars.forEach(r => log('  ' + JSON.stringify(r)));

  log('\n=== SELECT DISTINCT status FROM production_zakaz ===');
  const [statuses] = await conn.query('SELECT DISTINCT status FROM production_zakaz LIMIT 30');
  statuses.forEach(r => log('  ' + JSON.stringify(r)));

  log('\n=== SELECT DISTINCT status FROM production_sotuv (if exists) ===');
  try {
    const [ss] = await conn.query('SELECT DISTINCT approved FROM production_sotuv LIMIT 10');
    ss.forEach(r => log('  ' + JSON.stringify(r)));
  } catch (e) { log('  ' + e.message); }

  const mahsulotTables = tableNames.filter(t => t.toLowerCase().includes('mahsulot'));
  log(`\n=== MAHSULOT TABLES: ${mahsulotTables.join(', ') || 'NONE'} ===`);
  for (const t of mahsulotTables) {
    await desc(conn, t);
    try {
      const [rows] = await conn.query(`SELECT * FROM \`${t}\` LIMIT 5`);
      log(`  Sample (${rows.length} rows):`);
      rows.forEach(r => log('    ' + JSON.stringify(r)));
    } catch (e) { log('  ' + e.message); }
  }

  // Also describe tables with "product" or "tovar" in name
  const extraTables = tableNames.filter(t =>
    !CORE_TABLES.includes(t) && !mahsulotTables.includes(t) &&
    (t.includes('tovar') || t.includes('product') || t.includes('nomen'))
  );
  if (extraTables.length) {
    log(`\n=== EXTRA PRODUCT-LIKE TABLES: ${extraTables.join(', ')} ===`);
    for (const t of extraTables) await desc(conn, t);
  }

  log('\n=== 3 SAMPLE WIP ROWS + JOIN CHAIN ===');
  const [wipRows] = await conn.query(
    'SELECT * FROM production_proizvodstvo WHERE finished IS NULL ORDER BY id DESC LIMIT 3'
  );
  for (const row of wipRows) {
    log('\n  --- production_proizvodstvo ---');
    log('  ' + JSON.stringify(row));
    if (row.zp_id) {
      const [zpRows] = await conn.query(
        'SELECT * FROM production_zakazproizvodstvo WHERE id = ?', [row.zp_id]
      );
      if (zpRows.length) {
        log('  --- zakazproizvodstvo ---');
        log('  ' + JSON.stringify(zpRows[0]));
        const orderId = zpRows[0].order_id;
        if (orderId) {
          const [zakazRows] = await conn.query(
            'SELECT * FROM production_zakaz WHERE id = ?', [orderId]
          );
          if (zakazRows.length) {
            log('  --- zakaz ---');
            log('  ' + JSON.stringify(zakazRows[0]));
          }
        }
      }
    } else {
      log('  zp_id is NULL — join chain broken for this row');
    }
  }

  log('\n=== VERIFY HISTORICAL COUNTS (May 2026-05-01 to 2026-05-22) ===');
  try {
    const [sk] = await conn.query(
      'SELECT COUNT(*) AS cnt FROM production_skladzakaz WHERE created >= ? AND created < ?',
      ['2026-05-01', '2026-05-22']
    );
    log(`  skladzakaz count: ${sk[0].cnt}  (expect ~111)`);
  } catch (e) { log('  skladzakaz: ' + e.message); }

  try {
    const [ib] = await conn.query(
      `SELECT SUM(started >= '2026-05-01' AND started < '2026-05-22') AS kirdi,
              SUM(finished >= '2026-05-01' AND finished < '2026-05-22') AS bajarildi
       FROM production_proizvodstvo
       WHERE jarayon_id = 5
         AND ((started >= '2026-05-01' AND started < '2026-05-22')
           OR (finished >= '2026-05-01' AND finished < '2026-05-22'))`
    );
    log(`  inbound kirdi: ${ib[0].kirdi}  bajarildi: ${ib[0].bajarildi}  (expect kirdi~89)`);
  } catch (e) { log('  inbound: ' + e.message); }

  try {
    const [ob] = await conn.query(
      `SELECT COUNT(*) AS kirdi, SUM(approved=1) AS tasdiqlandi
       FROM production_sotuv
       WHERE sold_date >= '2026-05-01' AND sold_date < '2026-05-22'`
    );
    log(`  outbound kirdi: ${ob[0].kirdi}  tasdiqlandi: ${ob[0].tasdiqlandi}  (expect ~104/104)`);
  } catch (e) { log('  outbound: ' + e.message); }

  log('\n=== ZAKAZPROIZVODSTVO: sample 5 rows with product columns ===');
  try {
    const [rows] = await conn.query('SELECT * FROM production_zakazproizvodstvo LIMIT 5');
    rows.forEach(r => log('  ' + JSON.stringify(r)));
  } catch (e) { log('  ' + e.message); }

  log('\n=== SOTUV: sample 5 rows ===');
  try {
    const [rows] = await conn.query('SELECT * FROM production_sotuv LIMIT 5');
    rows.forEach(r => log('  ' + JSON.stringify(r)));
  } catch (e) { log('  ' + e.message); }

  log('\n=== ZAKAZ: sample 3 rows ===');
  try {
    const [rows] = await conn.query('SELECT * FROM production_zakaz LIMIT 3');
    rows.forEach(r => log('  ' + JSON.stringify(r)));
  } catch (e) { log('  ' + e.message); }

  await conn.end();
  stream.end();
  console.log(`\nSaved → ${outPath}`);
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  stream.end();
  process.exit(1);
});
