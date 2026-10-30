const segmentPalette = {
  Enterprise: '#3b82f6',
  'Mid-Market': '#8b5cf6',
  SMB: '#10b981',
  'Self-Serve': '#f59e0b',
};

const dataset = generateDataset();
const state = { start: '', end: '' };

const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const revenueChart = document.getElementById('revenueChart');
const retentionChart = document.getElementById('retentionChart');
const tableBody = document.getElementById('breakdownTableBody');
const revenueRangeLabel = document.getElementById('revenueRangeLabel');
const totalRevenueValue = document.getElementById('totalRevenueValue');
const growthValue = document.getElementById('growthValue');
const churnValue = document.getElementById('churnValue');
const growthMeta = document.getElementById('growthMeta');
const churnMeta = document.getElementById('churnMeta');
const tooltip = document.getElementById('tooltip');
const rangeButtons = [...document.querySelectorAll('.range-btn')];

function generateDataset() {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const records = [];

  for (let i = 0; i < 24; i += 1) {
    const date = new Date(2024, i, 1);
    const year = date.getFullYear();
    const monthLabel = monthNames[i % 12];
    const revenueBase = 340000 + i * 24000 + Math.sin(i / 2) * 18000;
    const revenue = Math.round(revenueBase);
    const growth = 7.4 + (i * 0.22) + Math.sin(i / 2.8) * 2.1;
    const churn = 2.6 + (i % 5) * 0.14 + Math.cos(i / 2.4) * 0.45;
    const retention = 97.2 - i * 0.08 + Math.sin(i / 3.2) * 0.5;
    const customers = Math.round(1180 + i * 32 + Math.cos(i / 2.4) * 18);

    const segments = {
      Enterprise: {
        revenue: Math.round(revenue * 0.38 + 32000 * Math.sin(i / 2)),
        growth: 11.4 + i * 0.32,
        churn: 1.8 + (i % 4) * 0.15,
        customers: Math.round(customers * 0.26),
      },
      'Mid-Market': {
        revenue: Math.round(revenue * 0.27 + 18000 * Math.cos(i / 3)),
        growth: 8.9 + i * 0.28,
        churn: 2.4 + (i % 5) * 0.2,
        customers: Math.round(customers * 0.31),
      },
      SMB: {
        revenue: Math.round(revenue * 0.22 + 14000 * Math.sin(i / 4 + 1.2)),
        growth: 9.1 + i * 0.18,
        churn: 3.1 + (i % 4) * 0.22,
        customers: Math.round(customers * 0.28),
      },
      'Self-Serve': {
        revenue: Math.round(revenue * 0.13 + 13000 * Math.cos(i / 3.8)),
        growth: 6.1 + i * 0.16,
        churn: 4.3 + (i % 3) * 0.25,
        customers: Math.round(customers * 0.15),
      },
    };

    records.push({
      date: formatDateKey(date),
      label: `${monthLabel} ${year}`,
      revenue,
      growth,
      churn,
      retention,
      customers,
      segments,
    });
  }

  return records;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return formatCurrency(value);
}

function formatPercent(value) {
  return `${Number(value).toFixed(1)}%`;
}

function getSelectedRangeData() {
  if (!state.start || !state.end) {
    return dataset.slice(-12);
  }

  const start = new Date(`${state.start}T00:00:00`);
  const end = new Date(`${state.end}T23:59:59`);

  return dataset.filter((item) => {
    const itemDate = new Date(`${item.date}T00:00:00`);
    return itemDate >= start && itemDate <= end;
  });
}

function setRangeByPreset(range) {
  const selectedData = {
    '30d': dataset.slice(-2),
    '90d': dataset.slice(-3),
    '6m': dataset.slice(-6),
    '12m': dataset.slice(-12),
    all: dataset,
  };

  const data = selectedData[range] || dataset.slice(-12);
  state.start = data[0]?.date || dataset[0].date;
  state.end = data[data.length - 1]?.date || dataset[dataset.length - 1].date;

  startDateInput.value = state.start;
  endDateInput.value = state.end;
}

function updateRangeButtons(activeRange) {
  rangeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.range === activeRange);
  });
}

function updateKpis(filteredData) {
  const totalRevenue = filteredData.reduce((sum, item) => sum + item.revenue, 0);
  const avgGrowth = filteredData.reduce((sum, item) => sum + item.growth, 0) / filteredData.length;
  const avgChurn = filteredData.reduce((sum, item) => sum + item.churn, 0) / filteredData.length;

  totalRevenueValue.textContent = formatCompactCurrency(totalRevenue);
  growthValue.textContent = formatPercent(avgGrowth);
  churnValue.textContent = formatPercent(avgChurn);

  const firstIndex = dataset.findIndex((item) => item.date === filteredData[0].date);
  const previousWindow = firstIndex > 0 ? dataset.slice(0, firstIndex) : [];
  const previousRevenue = previousWindow.reduce((sum, item) => sum + item.revenue, 0);
  const revenueDelta = previousRevenue ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

  growthMeta.textContent = `${revenueDelta >= 0 ? '+' : ''}${revenueDelta.toFixed(1)}% vs prior period`;
  growthValue.classList.toggle('positive-text', revenueDelta >= 0);
  growthValue.classList.toggle('negative-text', revenueDelta < 0);

  const churnTone = avgChurn <= 3 ? 'positive' : 'negative';
  churnMeta.textContent = avgChurn <= 3 ? 'Within target threshold' : 'Above target threshold';
  churnValue.classList.toggle('positive-text', churnTone === 'positive');
  churnValue.classList.toggle('negative-text', churnTone === 'negative');
}

function buildLinePath(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
}

function renderRevenueChart(data) {
  const width = 680;
  const height = 260;
  const margin = { top: 18, right: 18, bottom: 30, left: 48 };

  const values = data.map((d) => d.revenue);
  const minValue = Math.min(...values) * 0.9;
  const maxValue = Math.max(...values) * 1.08;
  const xStep = (width - margin.left - margin.right) / Math.max(data.length - 1, 1);

  const yScale = (value) => {
    const range = maxValue - minValue || 1;
    return height - margin.bottom - ((value - minValue) / range) * (height - margin.top - margin.bottom);
  };

  const points = data.map((item, index) => ({
    x: margin.left + index * xStep,
    y: yScale(item.revenue),
    label: item.label,
    value: item.revenue,
  }));

  const linePath = buildLinePath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - margin.bottom} L ${points[0].x} ${height - margin.bottom} Z`;

  const yTicks = 5;
  const gridLines = Array.from({ length: yTicks + 1 }, (_, index) => {
    const value = minValue + ((maxValue - minValue) / yTicks) * index;
    const y = yScale(value);
    return `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="rgba(148, 163, 184, 0.25)" stroke-width="1" />
      <text x="14" y="${y + 4}" fill="#62708a" font-size="11">${formatCompactCurrency(value)}</text>
    `;
  }).join('');

  const xLabels = data.map((item, index) => {
    if (index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 4) === 0) {
      const x = margin.left + index * xStep;
      return `<text x="${x}" y="${height - 8}" text-anchor="middle" fill="#62708a" font-size="11">${item.label.split(' ')[0]}</text>`;
    }
    return '';
  }).join('');

  const circles = points.map((point) => `
    <circle
      cx="${point.x}"
      cy="${point.y}"
      r="5"
      fill="#ffffff"
      stroke="#2b5cff"
      stroke-width="3"
      class="chart-point"
      data-label="${point.label}"
      data-value="${formatCurrency(point.value)}"
      data-type="Revenue"
    />
  `).join('');

  revenueChart.innerHTML = `
    <defs>
      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2b5cff" stop-opacity="0.22" />
        <stop offset="100%" stop-color="#2b5cff" stop-opacity="0.04" />
      </linearGradient>
    </defs>
    ${gridLines}
    <path d="${areaPath}" fill="url(#revenueFill)"></path>
    <path d="${linePath}" fill="none" stroke="#2b5cff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
    ${circles}
    ${xLabels}
  `;

  revenueChart.querySelectorAll('.chart-point').forEach((circle) => {
    circle.addEventListener('mousemove', (event) => showTooltip(event, `<strong>${circle.dataset.label}</strong>${circle.dataset.type}: ${circle.dataset.value}`));
    circle.addEventListener('mouseleave', hideTooltip);
  });
}

function renderRetentionChart(data) {
  const width = 680;
  const height = 260;
  const margin = { top: 18, right: 18, bottom: 30, left: 52 };
  const min = 94;
  const max = 99.5;
  const xStep = (width - margin.left - margin.right) / Math.max(data.length - 1, 1);

  const yScale = (value) => {
    const range = max - min || 1;
    return height - margin.bottom - ((value - min) / range) * (height - margin.top - margin.bottom);
  };

  const points = data.map((item, index) => ({
    x: margin.left + index * xStep,
    y: yScale(item.retention),
    label: item.label,
    value: item.retention,
  }));

  const linePath = buildLinePath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - margin.bottom} L ${points[0].x} ${height - margin.bottom} Z`;

  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = min + ((max - min) / 4) * index;
    const y = yScale(value);
    return `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="rgba(148, 163, 184, 0.2)" stroke-width="1" />
      <text x="10" y="${y + 4}" fill="#62708a" font-size="11">${value.toFixed(1)}%</text>
    `;
  }).join('');

  const xLabels = data.map((item, index) => {
    if (index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 4) === 0) {
      const x = margin.left + index * xStep;
      return `<text x="${x}" y="${height - 8}" text-anchor="middle" fill="#62708a" font-size="11">${item.label.split(' ')[0]}</text>`;
    }
    return '';
  }).join('');

  const circles = points.map((point) => `
    <circle
      cx="${point.x}"
      cy="${point.y}"
      r="5"
      fill="#ffffff"
      stroke="#10b981"
      stroke-width="3"
      class="chart-point"
      data-label="${point.label}"
      data-value="${point.value.toFixed(1)}%"
      data-type="Retention"
    />
  `).join('');

  retentionChart.innerHTML = `
    <defs>
      <linearGradient id="retentionFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.18" />
        <stop offset="100%" stop-color="#10b981" stop-opacity="0.04" />
      </linearGradient>
    </defs>
    ${grid}
    <path d="${areaPath}" fill="url(#retentionFill)"></path>
    <path d="${linePath}" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
    ${circles}
    ${xLabels}
  `;

  retentionChart.querySelectorAll('.chart-point').forEach((circle) => {
    circle.addEventListener('mousemove', (event) => showTooltip(event, `<strong>${circle.dataset.label}</strong>${circle.dataset.type}: ${circle.dataset.value}`));
    circle.addEventListener('mouseleave', hideTooltip);
  });
}

function renderBreakdownTable(data) {
  const summary = Object.fromEntries(
    Object.keys(segmentPalette).map((segment) => [segment, { revenue: 0, growth: 0, churn: 0, customers: 0, count: 0 }])
  );

  data.forEach((entry) => {
    Object.entries(entry.segments).forEach(([segment, values]) => {
      const bucket = summary[segment];
      bucket.revenue += values.revenue;
      bucket.growth += values.growth;
      bucket.churn += values.churn;
      bucket.customers += values.customers;
      bucket.count += 1;
    });
  });

  const rows = Object.entries(summary).map(([segment, stats]) => {
    const avgGrowth = stats.count ? stats.growth / stats.count : 0;
    const avgChurn = stats.count ? stats.churn / stats.count : 0;
    return `
      <tr>
        <td>
          <span class="segment-pill">
            <span class="segment-dot" style="background:${segmentPalette[segment]};"></span>
            ${segment}
          </span>
        </td>
        <td>${formatCompactCurrency(stats.revenue)}</td>
        <td class="positive-text">+${avgGrowth.toFixed(1)}%</td>
        <td class="${avgChurn <= 3 ? 'positive-text' : 'negative-text'}">${avgChurn.toFixed(1)}%</td>
        <td>${stats.customers.toLocaleString()}</td>
      </tr>
    `;
  }).join('');

  tableBody.innerHTML = rows;
}

function showTooltip(event, content) {
  tooltip.hidden = false;
  tooltip.innerHTML = content;
  tooltip.style.left = `${event.clientX + 14}px`;
  tooltip.style.top = `${event.clientY + 14}px`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

function renderDashboard() {
  const filteredData = getSelectedRangeData();
  if (!filteredData.length) return;

  updateKpis(filteredData);
  renderRevenueChart(filteredData);
  renderRetentionChart(filteredData);
  renderBreakdownTable(filteredData);

  const first = filteredData[0].label;
  const last = filteredData[filteredData.length - 1].label;
  revenueRangeLabel.textContent = `${first} - ${last}`;
}

rangeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const range = button.dataset.range;
    setRangeByPreset(range);
    updateRangeButtons(range);
    renderDashboard();
  });
});

startDateInput.addEventListener('change', (event) => {
  state.start = event.target.value;
  updateRangeButtons('custom');
  renderDashboard();
});

endDateInput.addEventListener('change', (event) => {
  state.end = event.target.value;
  updateRangeButtons('custom');
  renderDashboard();
});

function initialize() {
  const defaultRange = '12m';
  setRangeByPreset(defaultRange);
  updateRangeButtons(defaultRange);
  renderDashboard();
}

window.addEventListener('resize', renderDashboard);
initialize();
