/* ===== State ===== */
let currentModule = 'cards';
let currentPeriod = 'monthly';
let _pollTimer    = null;

/* ===== Utils ===== */
function fmt(n) {
  if (n === undefined || n === null) return '—';
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
function fmtPct(n) { return (n !== undefined && n !== null) ? `${n}%` : '—'; }
function statusLabel(s) {
  return { good: 'Yaxshi', medium: 'O\'rta', critical: 'Kritik' }[s] || s;
}

/* ===== Live indicator + error banner ===== */
function updateLive() {
  const el = document.getElementById('live-indicator');
  if (!el) return;
  el.textContent = `Jonli · yangilandi ${new Date().toTimeString().slice(0, 8)}`;
  el.style.display = '';
}
function showError()  { document.getElementById('error-banner').style.display = 'flex'; }
function hideError()  { document.getElementById('error-banner').style.display = 'none'; }

/* ===== Render: Cards module ===== */
function renderCards(data) {
  const { kpi, departments } = data;
  const chg = kpi.change_vs_prev_pct;
  const chgDisplay = chg === null ? '—' : `${chg >= 0 ? '+' : ''}${chg}%`;
  const chgClass   = chg === null ? '' : `kpi-change-${chg >= 0 ? 'pos' : 'neg'}`;
  const chgColor   = chg === null ? '' : (chg >= 0 ? 'green' : 'red');

  document.getElementById('module-content').innerHTML = `
    <div class="kpi-row">
      <div class="kpi-card"><div class="kpi-label">Jami kirim kartochkalar</div><div class="kpi-value">${fmt(kpi.total_in)}</div></div>
      <div class="kpi-card green"><div class="kpi-label">Bajarilgan kartochkalar</div><div class="kpi-value">${fmt(kpi.completed)}</div></div>
      <div class="kpi-card yellow"><div class="kpi-label">Umumiy samaradorlik</div><div class="kpi-value">${fmtPct(kpi.efficiency_pct)}</div></div>
      <div class="kpi-card ${chgColor}"><div class="kpi-label">O'zgarish</div><div class="kpi-value ${chgClass}">${chgDisplay}</div></div>
    </div>
    <div class="charts-row single">
      <div class="chart-card">
        <h3>Kirdi va Bajarildi — bo'limlar bo'yicha</h3>
        <div class="chart-wrap tall"><canvas id="chart-dept"></canvas></div>
      </div>
    </div>
    <div class="table-card"><h3>Bo'limlar</h3>
      <table><thead><tr>
        <th>Bo'lim</th><th>Kirdi</th><th>Bajarildi</th><th>Samaradorlik</th><th>Status</th>
      </tr></thead><tbody>
        ${departments.map(d => `<tr>
          <td>${d.name}</td><td>${fmt(d.came_in)}</td><td>${fmt(d.completed)}</td>
          <td><div class="progress-label">${fmtPct(d.efficiency)}</div>
              <div class="progress-bar"><div class="progress-fill ${d.status === 'good' ? 'green' : d.status === 'medium' ? 'yellow' : 'red'}"
                   style="width:${Math.min(d.efficiency,100)}%"></div></div></td>
          <td><span class="badge badge-${d.status}">${statusLabel(d.status)}</span></td>
        </tr>`).join('')}
      </tbody></table>
    </div>`;
  CHARTS.renderDeptBarChart('chart-dept', departments);
}

/* ===== Render: Products module ===== */
function renderProducts(data) {
  const { kpi, products, share } = data;
  const bPct = kpi.bajarilish_pct;
  const bColor = bPct === null ? '' : bPct >= 90 ? 'green' : bPct >= 70 ? 'yellow' : 'red';
  const bText  = bPct === null ? '' : bPct >= 90 ? 'kpi-change-pos' : bPct < 70 ? 'kpi-change-neg' : '';

  document.getElementById('module-content').innerHTML = `
    <div class="kpi-row">
      <div class="kpi-card"><div class="kpi-label">Jami reja</div><div class="kpi-value">${fmt(kpi.jami_reja)}</div><div class="kpi-sub">${kpi.product_types} tovar turi</div></div>
      <div class="kpi-card green"><div class="kpi-label">Fakt</div><div class="kpi-value">${fmt(kpi.fakt)}</div><div class="kpi-sub">dona</div></div>
      <div class="kpi-card ${bColor}"><div class="kpi-label">Bajarilish</div><div class="kpi-value ${bText}">${fmtPct(bPct)}</div></div>
      <div class="kpi-card orange"><div class="kpi-label">Eng katta hajm</div><div class="kpi-value">${fmt(kpi.largest.units)}</div><div class="kpi-sub">${kpi.largest.name}</div></div>
    </div>
    <div class="charts-row">
      <div class="chart-card"><h3>Tovarlar bo'yicha ishlab chiqarish</h3>
        <div class="chart-wrap" style="height:340px"><canvas id="chart-products-bar"></canvas></div></div>
      <div class="chart-card"><h3>Ulush (%)</h3>
        <div class="chart-wrap medium"><canvas id="chart-share-doughnut"></canvas></div></div>
    </div>`;
  CHARTS.renderProductsBarChart('chart-products-bar', products);
  CHARTS.renderShareDoughnut('chart-share-doughnut', share);
}

/* ===== Render: Warehouse module ===== */
function renderSklad(data) {
  const { orders, inbound, outbound, avg_lead_time_days, overdue_count } = data;
  const pC = p => p >= 85 ? 'good' : p >= 60 ? 'medium' : 'critical';
  const fC = p => p >= 85 ? 'green' : p >= 60 ? 'yellow' : 'red';
  document.getElementById('module-content').innerHTML = `
    <div class="sklad-cards">
      <div class="sklad-card">
        <div class="sklad-card-header"><div><div class="sklad-card-title">Sklad Zakaz</div><div class="sklad-card-sub">Yangi buyurtmalar</div></div></div>
        <div class="sklad-big-num">${fmt(orders.count)}</div>
      </div>
      <div class="sklad-card">
        <div class="sklad-card-header">
          <div><div class="sklad-card-title">Sklad Kirim</div><div class="sklad-card-sub">Qabul qilingan tovarlar</div></div>
          <span class="badge badge-${pC(inbound.pct)}">${fmtPct(inbound.pct)}</span>
        </div>
        <div class="sklad-row"><span>Kirdi</span><span>${fmt(inbound.came_in)}</span></div>
        <div class="sklad-row"><span>Bajarildi</span><span>${fmt(inbound.completed)}</span></div>
        <div class="progress-bar" style="margin-top:10px"><div class="progress-fill ${fC(inbound.pct)}" style="width:${inbound.pct}%"></div></div>
      </div>
      <div class="sklad-card">
        <div class="sklad-card-header">
          <div><div class="sklad-card-title">Sklad Chiqim</div><div class="sklad-card-sub">Jo'natilgan tovarlar</div></div>
          <span class="badge badge-${pC(outbound.pct)}">${fmtPct(outbound.pct)}</span>
        </div>
        <div class="sklad-row"><span>Kirdi</span><span>${fmt(outbound.came_in)}</span></div>
        <div class="sklad-row"><span>Tasdiqlandi</span><span>${fmt(outbound.approved)}</span></div>
        <div class="progress-bar" style="margin-top:10px"><div class="progress-fill ${fC(outbound.pct)}" style="width:${outbound.pct}%"></div></div>
      </div>
    </div>
    <div class="attention-block">
      <h4>Diqqat talab qiladi</h4>
      <div class="attention-overdue">
        Muddati o'tgan zakazlar: <span class="overdue-num">${overdue_count}</span> ta
        &nbsp;·&nbsp; O'rtacha yetkazish vaqti: <strong>${avg_lead_time_days ?? '—'}</strong> kun
      </div>
    </div>`;
}

/* ===== Module routing ===== */
const MODULES  = { cards: 'Kartochkalar', products: 'Mahsulot', sklad: 'Sklad', wip: 'Jarayonda' };
const FETCH_FN = {
  cards:    p => API.getCards(p),
  products: p => API.getProducts(p),
  sklad:    p => API.getSklad(p),
  wip:      () => API.getWip(),
};
const RENDER_FN = { cards: renderCards, products: renderProducts, sklad: renderSklad, wip: WIP.renderWip };

async function loadModule(module, period) {
  currentModule = module;
  currentPeriod = period;
  document.querySelectorAll('.sidebar nav a').forEach(a =>
    a.classList.toggle('active', a.dataset.module === module));
  document.querySelectorAll('.btn-period').forEach(b =>
    b.classList.toggle('active', b.dataset.period === period));
  document.querySelector('.period-buttons').style.visibility = module !== 'wip' ? 'visible' : 'hidden';
  document.getElementById('module-title').textContent = MODULES[module];

  // Don't blank content on background refresh — only show loader on first load
  const content = document.getElementById('module-content');
  if (content.dataset.module !== module) {
    content.innerHTML = '<div class="state-msg">Yuklanmoqda...</div>';
  }
  content.dataset.module = module;

  try {
    const data = await FETCH_FN[module](period);
    hideError();
    updateLive();
    RENDER_FN[module](data);
  } catch (err) {
    if (err.status === 503) {
      showError();
    } else {
      content.innerHTML = '<div class="state-msg">Ma\'lumot yo\'q</div>';
    }
    console.error(err);
  }
}

/* ===== Polling ===== */
function startPolling() {
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(() => {
    if (!document.hidden) loadModule(currentModule, currentPeriod);
  }, 60000);
}

/* ===== Mobile sidebar ===== */
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
  document.querySelector('.sidebar-overlay').classList.toggle('open');
}

/* ===== Init ===== */
function init() {
  document.querySelectorAll('.sidebar nav a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      if (window.innerWidth <= 768) toggleSidebar();
      loadModule(a.dataset.module, currentPeriod);
    });
  });
  document.querySelectorAll('.btn-period').forEach(b =>
    b.addEventListener('click', () => loadModule(currentModule, b.dataset.period)));
  document.getElementById('btn-logout').addEventListener('click', AUTH.handleLogout);
  document.getElementById('btn-retry').addEventListener('click', () => loadModule(currentModule, currentPeriod));
  document.getElementById('mobile-menu-btn').addEventListener('click', toggleSidebar);
  document.querySelector('.sidebar-overlay').addEventListener('click', toggleSidebar);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadModule(currentModule, currentPeriod);
  });
  startPolling();
  loadModule('cards', 'monthly');
}

window.APP = { init };
