function fmtDeadline(iso) {
  const p = iso.split('-');
  return `${p[2]}.${p[1]}`;
}

function statusColor(status) {
  return { ok: 'green', due_soon: 'yellow', overdue: 'red' }[status] || 'green';
}

function cardHTML(card) {
  const color = statusColor(card.status);
  const dlPart = card.deadline
    ? `<div class="kc-deadline">
        <span class="kc-dl-label">Deadline: ${fmtDeadline(card.deadline)}</span>
        <span class="kc-dot dot-${color}"></span>
       </div>`
    : '';
  const bottom = card.quantity != null
    ? `${card.quantity} dona · ${card.days_in_stage} kun`
    : `${card.days_in_stage} kundan beri shu bo'limda`;
  return `
    <div class="kc kc-${card.status}" data-id="${card.id}">
      <div class="kc-id">#${card.id}</div>
      <div class="kc-title">${card.title}</div>
      ${dlPart}
      <div class="kc-days">${bottom}</div>
    </div>`;
}

function columnHTML(col) {
  return `
    <div class="kb-col">
      <div class="kb-col-header">
        <span class="kb-col-name">${col.department}</span>
        <span class="kb-col-badge">${col.count}</span>
      </div>
      <div class="kb-col-body">
        ${col.cards.map(cardHTML).join('')}
      </div>
    </div>`;
}

function renderWip(data) {
  const { summary, columns } = data;
  document.getElementById('module-content').innerHTML = `
    <div class="wip-header">
      <div class="wip-chips">
        <span class="wip-chip">Jami jarayonda: <strong>${summary.total}</strong></span>
        <span class="wip-chip chip-red">Muddati o'tgan: <strong>${summary.overdue}</strong></span>
        <span class="wip-chip chip-yellow">3 kun ichida: <strong>${summary.due_soon}</strong></span>
      </div>
      <input class="wip-search" id="wip-search" type="search" placeholder="Kartochka № ..." />
    </div>
    <div class="kanban">
      ${columns.map(columnHTML).join('')}
    </div>`;

  document.getElementById('wip-search').addEventListener('input', function () {
    const q = this.value.trim().replace(/^#/, '');
    document.querySelectorAll('.kc').forEach(el => {
      const match = !q || el.dataset.id.includes(q);
      el.classList.toggle('kc-hidden', !match);
    });
  });
}

window.WIP = { renderWip };
