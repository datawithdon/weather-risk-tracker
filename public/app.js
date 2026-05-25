const PROVINCES = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba',
  NB: 'New Brunswick', NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia', NT: 'Northwest Territories',
  NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island',
  QC: 'Quebec', SK: 'Saskatchewan', YT: 'Yukon',
};

const LEVEL_ORDER = { extreme: 4, high: 3, moderate: 2, low: 1, none: 0 };
const REFRESH_MS = 5 * 60 * 1000;

let currentProvince = '';
let refreshTimer = null;
let countdownTimer = null;

// Populate province dropdown
const sel = document.getElementById('province-filter');
Object.entries(PROVINCES).forEach(([code, name]) => {
  const o = document.createElement('option');
  o.value = code;
  o.textContent = `${name} (${code})`;
  sel.appendChild(o);
});
sel.addEventListener('change', () => { currentProvince = sel.value; loadData(); });

async function api(endpoint) {
  const pq = currentProvince ? `?province=${currentProvince}` : '';
  const res = await fetch(`/api/${endpoint}${pq}`);
  return res.json();
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmt(n) {
  if (n === undefined || n === null) return '—';
  return Number(n).toLocaleString();
}

function fmtHa(ha) {
  if (!ha) return '0';
  if (ha >= 1e6) return (ha / 1e6).toFixed(1) + 'M';
  if (ha >= 1000) return (ha / 1000).toFixed(0) + 'K';
  return ha.toLocaleString();
}

function levelColor(level) {
  return ({ extreme: '#dc2626', high: '#f97316', moderate: '#ca8a04', low: '#16a34a', none: '#94a3b8' })[level] || '#94a3b8';
}

function wmoEmoji(code) {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}

function topLevel(levels) {
  const max = Math.max(...levels.map(l => LEVEL_ORDER[l] || 0));
  return Object.keys(LEVEL_ORDER).find(k => LEVEL_ORDER[k] === max) || 'none';
}

async function loadData() {
  clearTimeout(refreshTimer);
  clearInterval(countdownTimer);

  const btn = document.getElementById('refresh-btn');
  btn.disabled = true;
  document.getElementById('last-updated').textContent = 'Refreshing…';

  try {
    const [summaryRes, alertsRes, weatherRes, firesRes] = await Promise.all([
      api('summary'), api('alerts'), api('weather'), api('wildfires'),
    ]);

    renderSummary(summaryRes.data);
    renderAlerts(alertsRes.data || []);
    renderWeather(weatherRes.data || []);
    renderWildfires(firesRes.data || [], summaryRes.data);
    renderProvinceTable(summaryRes.data?.byProvince || []);

    const now = new Date();
    const t = now.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
    startCountdown(t);
  } catch (err) {
    console.error(err);
    document.getElementById('last-updated').textContent = 'Error — check console';
  } finally {
    btn.disabled = false;
  }
}

function startCountdown(timeStr) {
  let secs = REFRESH_MS / 1000;
  const el = document.getElementById('last-updated');
  const tick = () => {
    const m = Math.floor(secs / 60), s = secs % 60;
    el.textContent = `Updated ${timeStr} · Next in ${m}:${String(s).padStart(2, '0')}`;
    secs--;
    if (secs < 0) clearInterval(countdownTimer);
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
  refreshTimer = setTimeout(loadData, REFRESH_MS);
}

function renderSummary(data) {
  if (!data) return;
  const { counts, riskCategories } = data;

  document.getElementById('stat-total-alerts').textContent = fmt(counts?.totalAlerts);
  document.getElementById('stat-extreme').textContent = fmt(counts?.extremeAlerts);
  document.getElementById('stat-severe').textContent = fmt(counts?.severeAlerts);
  document.getElementById('stat-fires').textContent = fmt(counts?.activeWildfires);
  document.getElementById('stat-hectares').textContent = fmtHa(counts?.totalFireHectares);

  const cats = [
    { key: 'storm', id: 'storm', countKey: 'alertCount', unit: 'alert' },
    { key: 'winter', id: 'winter', countKey: 'alertCount', unit: 'alert' },
    { key: 'wildfire', id: 'wildfire', countKey: 'activeCount', unit: 'fire' },
    { key: 'flooding', id: 'flooding', countKey: 'alertCount', unit: 'alert' },
  ];
  cats.forEach(({ key, id, countKey, unit }) => {
    const cat = riskCategories?.[key] || {};
    const badge = document.getElementById(`badge-${id}`);
    const countEl = document.getElementById(`count-${id}`);
    const level = cat.level || 'none';
    badge.textContent = level.toUpperCase();
    badge.className = `risk-badge ${level}`;
    const n = cat[countKey] ?? 0;
    countEl.textContent = `${n} active ${unit}${n !== 1 ? 's' : ''}`;
  });
}

function renderAlerts(alerts) {
  const list = document.getElementById('alerts-list');
  document.getElementById('alerts-count-badge').textContent = alerts.length;

  if (!alerts.length) {
    list.innerHTML = `<div class="empty-msg">No active alerts${currentProvince ? ' for this province' : ''}</div>`;
    return;
  }

  const sevOrder = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };
  alerts.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9));

  list.innerHTML = alerts.map(a => `
    <div class="alert-item">
      <div class="sev-dot ${(a.severity || 'unknown').toLowerCase()}"></div>
      <div class="alert-body">
        <div class="alert-event">${esc(a.event)}</div>
        <div class="alert-tags">
          <span class="tag tag-sev ${a.severity}">${esc(a.severity)}</span>
          ${a.province ? `<span class="tag tag-prov">${a.province}</span>` : ''}
          <span class="tag tag-cat">${esc(a.category || 'other')}</span>
        </div>
        ${a.headline ? `<div class="alert-sub">${esc(a.headline.substring(0, 100))}${a.headline.length > 100 ? '…' : ''}</div>` : ''}
        ${a.area ? `<div class="alert-sub" style="color:#b0bec5">${esc(a.area.substring(0, 80))}${a.area.length > 80 ? '…' : ''}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function renderWeather(data) {
  const list = document.getElementById('weather-list');
  if (!data.length) {
    list.innerHTML = '<div class="empty-msg">Weather data unavailable</div>';
    return;
  }

  data.sort((a, b) => {
    const aMax = Math.max(...(a.risks || []).map(r => LEVEL_ORDER[r.level] || 0), 0);
    const bMax = Math.max(...(b.risks || []).map(r => LEVEL_ORDER[r.level] || 0), 0);
    return bMax - aMax;
  });

  list.innerHTML = data.map(w => {
    const temp = w.temperature !== undefined ? `${Math.round(w.temperature)}°C` : '—';
    const dots = (w.risks || []).map(r =>
      `<span class="risk-dot" style="background:${levelColor(r.level)}" title="${r.type}: ${r.level}"></span>`
    ).join('');
    const okLabel = dots ? '' : '<span style="font-size:.62rem;color:#94a3b8">OK</span>';
    return `
      <div class="weather-row">
        <div>
          <div class="weather-city">${esc(w.city)}</div>
          <div class="weather-prov-code">${w.province}</div>
        </div>
        <div class="weather-right">
          <div class="weather-temp">${wmoEmoji(w.weatherCode)} ${temp}</div>
          <div class="weather-desc">${esc(w.weatherDesc || '')}</div>
        </div>
        <div class="risk-dots">${dots}${okLabel}</div>
      </div>
    `;
  }).join('');
}

function renderWildfires(fires, summaryData) {
  const el = document.getElementById('wildfire-body');
  const counts = summaryData?.counts || {};

  const byProvince = {};
  fires.forEach(f => {
    if (f.province) byProvince[f.province] = (byProvince[f.province] || 0) + 1;
  });

  const topProvs = Object.entries(byProvince).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const provRows = topProvs.length
    ? topProvs.map(([code, n]) => `
        <div class="wf-prov-row">
          <span>${PROVINCES[code] || code}</span>
          <span class="wf-count">${n}</span>
        </div>`).join('')
    : '<div class="empty-msg" style="padding:8px">No active fires detected</div>';

  el.innerHTML = `
    <div class="wf-stats">
      <div class="wf-stat">
        <span class="wf-num">${fmt(counts.activeWildfires ?? fires.length)}</span>
        <span class="wf-lbl">Active Fires</span>
      </div>
      <div class="wf-stat">
        <span class="wf-num">${fmt(counts.largeWildfires ?? 0)}</span>
        <span class="wf-lbl">Large (&gt;1,000 ha)</span>
      </div>
      <div class="wf-stat full">
        <span class="wf-num">${fmtHa(counts.totalFireHectares ?? 0)} ha</span>
        <span class="wf-lbl">Total Area Burned</span>
      </div>
    </div>
    ${topProvs.length ? `
    <div class="wf-prov-list">
      <div class="wf-prov-hdr">By Province</div>
      ${provRows}
    </div>` : provRows}
  `;
}

function renderProvinceTable(provinces) {
  const wrap = document.getElementById('province-table-wrap');

  const rows = provinces
    .filter(p => currentProvince ? p.code === currentProvince : true)
    .map(p => {
      const riskLevels = (p.weatherRisks || []).map(r => r.level);
      const maxLevel = riskLevels.length ? topLevel(riskLevels) : 'none';
      const dots = (p.weatherRisks || []).slice(0, 4).map(r =>
        `<span style="width:8px;height:8px;border-radius:50%;background:${levelColor(r.level)};display:inline-block" title="${r.type}"></span>`
      ).join('');
      return { ...p, maxLevel, dots };
    })
    .sort((a, b) => (LEVEL_ORDER[b.maxLevel] || 0) - (LEVEL_ORDER[a.maxLevel] || 0) || b.alertCount - a.alertCount);

  if (!rows.length) {
    wrap.innerHTML = '<div class="empty-msg">No data</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Province / Territory</th>
          <th>Code</th>
          <th>Active Alerts</th>
          <th>Active Fires</th>
          <th>Weather Risks</th>
          <th>Risk Level</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(p => `
          <tr>
            <td style="font-weight:500">${esc(p.name)}</td>
            <td style="font-family:monospace;color:#64748b;font-size:.75rem">${p.code}</td>
            <td>${p.alertCount > 0
              ? `<strong style="color:${p.alertCount > 5 ? 'var(--extreme)' : 'var(--text)'}">${p.alertCount}</strong>`
              : '<span style="color:#94a3b8">0</span>'}</td>
            <td>${p.fireCount > 0
              ? `<strong style="color:${p.fireCount > 10 ? 'var(--high)' : 'var(--text)'}">${p.fireCount}</strong>`
              : '<span style="color:#94a3b8">0</span>'}</td>
            <td><div class="dot-row">${p.dots || '<span style="color:#94a3b8;font-size:.72rem">—</span>'}</div></td>
            <td><span class="risk-badge ${p.maxLevel}" style="font-size:.62rem">${p.maxLevel.toUpperCase()}</span></td>
          </tr>`).join('')}
      </tbody>
    </table>
  `;
}

loadData();
