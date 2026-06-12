const COLORS = {
  blue:   '#3b82f6',
  orange: '#f97316',
  green:  '#22c55e',
  yellow: '#f59e0b',
  red:    '#ef4444',
  purple: '#a855f7',
  cyan:   '#06b6d4',
};

const DOUGHNUT_PALETTE = [
  COLORS.blue, COLORS.orange, COLORS.green, COLORS.yellow, COLORS.purple, COLORS.red,
];

const TT = {
  backgroundColor: '#1a1f2e',
  borderColor: '#2a3142',
  borderWidth: 1,
  titleColor: '#e6e9ef',
  bodyColor: '#8b93a7',
};

let _charts = {};

// Disable datalabels globally; enable per-chart as needed
Chart.register(ChartDataLabels);
Chart.defaults.set('plugins.datalabels', { display: false });

function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

function renderDeptBarChart(canvasId, departments) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: departments.map(d => d.name),
      datasets: [
        {
          label: 'Kirdi',
          data: departments.map(d => d.came_in),
          backgroundColor: COLORS.blue,
          borderRadius: 4,
          barPercentage: .38,
          categoryPercentage: .75,
        },
        {
          label: 'Bajarildi',
          data: departments.map(d => d.completed),
          backgroundColor: COLORS.orange,
          borderRadius: 4,
          barPercentage: .38,
          categoryPercentage: .75,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        subtitle: {
          display: true,
          text: 'Davr davomida kartochkalar oqimi',
          color: '#8b93a7',
          font: { size: 12 },
          padding: { bottom: 12 },
        },
        legend: { labels: { color: '#8b93a7', font: { size: 12 } } },
        tooltip: {
          ...TT,
          mode: 'index',
          callbacks: {
            title: (items) => items[0].label,
            label: (item) => {
              const label = item.dataset.label;
              return `  ${label}: ${item.raw} ta`;
            },
            afterBody: (items) => {
              const d = departments[items[0].dataIndex];
              return [`  Samaradorlik: ${d.efficiency}%`];
            },
          },
        },
        datalabels: {
          display: true,
          anchor: 'end',
          align: 'top',
          color: '#8b93a7',
          font: { size: 10, weight: '600' },
          formatter: (v) => v,
        },
      },
      scales: {
        x: { ticks: { color: '#8b93a7', font: { size: 11 } }, grid: { color: 'rgba(42,49,66,.5)' } },
        y: { ticks: { color: '#8b93a7' }, grid: { color: 'rgba(42,49,66,.5)' }, beginAtZero: true },
      },
    },
  });
}

function renderProductsBarChart(canvasId, products) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: products.map(p => p.name),
      datasets: [
        {
          label: 'Reja',
          data: products.map(p => p.reja),
          backgroundColor: 'rgba(59,130,246,0.35)',
          borderColor: 'rgba(59,130,246,0.7)',
          borderWidth: 1,
          borderRadius: 3,
          barPercentage: .45,
          categoryPercentage: .8,
        },
        {
          label: 'Fakt',
          data: products.map(p => p.fakt),
          backgroundColor: COLORS.orange,
          borderRadius: 3,
          barPercentage: .45,
          categoryPercentage: .8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { labels: { color: '#8b93a7', font: { size: 12 } } },
        tooltip: {
          ...TT,
          mode: 'index',
          callbacks: {
            title: (items) => items[0].label,
            label: (item) => {
              const lbl = item.dataset.label;
              return `  ${lbl}: ${item.raw} dona`;
            },
            afterBody: (items) => {
              const p = products[items[0].dataIndex];
              const pct = p.reja ? Math.round(p.fakt / p.reja * 1000) / 10 : 0;
              return [`  Bajarilish: ${pct}%`];
            },
          },
        },
        datalabels: { display: false },
      },
      scales: {
        x: { ticks: { color: '#8b93a7' }, grid: { color: 'rgba(42,49,66,.5)' }, beginAtZero: true },
        y: { ticks: { color: '#8b93a7', font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
}

function renderShareDoughnut(canvasId, share) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  _charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: share.map(s => s.name),
      datasets: [{
        data: share.map(s => s.pct),
        backgroundColor: DOUGHNUT_PALETTE,
        borderColor: '#1a1f2e',
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#8b93a7',
            font: { size: 12 },
            padding: 14,
            generateLabels(chart) {
              const { data } = chart;
              return data.labels.map((label, i) => ({
                text: `${label} — ${data.datasets[0].data[i]}%`,
                fillStyle: data.datasets[0].backgroundColor[i],
                strokeStyle: 'transparent',
                lineWidth: 0,
                hidden: false,
                index: i,
              }));
            },
          },
        },
        tooltip: { ...TT },
        datalabels: { display: false },
      },
    },
  });
}

window.CHARTS = { renderDeptBarChart, renderProductsBarChart, renderShareDoughnut };
