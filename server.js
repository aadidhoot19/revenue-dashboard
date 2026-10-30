const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function buildDataset() {
  const records = [];

  for (let i = 0; i < 24; i += 1) {
    const date = new Date(2024, i, 1);
    const label = `${monthNames[i % 12]} ${date.getFullYear()}`;
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
      label,
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

const dataset = buildDataset();
let visitCount = 0;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'Revenue dashboard backend is running',
    timestamp: new Date().toISOString(),
    visits: visitCount,
  });
});

app.get('/api/overview', (req, res) => {
  visitCount += 1;

  const snapshot = {
    summary: {
      totalRevenue: dataset.reduce((sum, item) => sum + item.revenue, 0),
      avgGrowth: dataset.reduce((sum, item) => sum + item.growth, 0) / dataset.length,
      avgChurn: dataset.reduce((sum, item) => sum + item.churn, 0) / dataset.length,
      avgRetention: dataset.reduce((sum, item) => sum + item.retention, 0) / dataset.length,
    },
    dataset: dataset.slice(-12),
    generatedAt: new Date().toISOString(),
    visits: visitCount,
  };

  res.json(snapshot);
});

app.get('/api/segments', (req, res) => {
  const summary = {
    Enterprise: { revenue: 0, customers: 0, growth: 0, churn: 0, count: 0 },
    'Mid-Market': { revenue: 0, customers: 0, growth: 0, churn: 0, count: 0 },
    SMB: { revenue: 0, customers: 0, growth: 0, churn: 0, count: 0 },
    'Self-Serve': { revenue: 0, customers: 0, growth: 0, churn: 0, count: 0 },
  };

  dataset.forEach((entry) => {
    Object.entries(entry.segments).forEach(([segment, values]) => {
      const bucket = summary[segment];
      bucket.revenue += values.revenue;
      bucket.customers += values.customers;
      bucket.growth += values.growth;
      bucket.churn += values.churn;
      bucket.count += 1;
    });
  });

  const output = Object.entries(summary).map(([segment, values]) => ({
    segment,
    revenue: values.revenue,
    customers: values.customers,
    growth: values.count ? values.growth / values.count : 0,
    churn: values.count ? values.churn / values.count : 0,
  }));

  res.json(output);
});

app.use(express.static(path.join(__dirname)));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Revenue dashboard backend running on http://localhost:${PORT}`);
});
