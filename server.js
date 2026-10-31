const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const users = new Map();

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

    records.push({
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`,
      label,
      revenue,
      growth,
      churn,
      retention,
      customers,
      segments: {
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
      },
    });
  }

  return records;
}

const dashboardData = buildDataset();

function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

async function seedAdmin() {
  const adminEmail = 'admin@company.com';
  if (!users.has(adminEmail)) {
    const hash = await bcrypt.hash('Admin@123!', 12);
    users.set(adminEmail, {
      id: 'admin-001',
      name: 'System Admin',
      email: adminEmail,
      passwordHash: hash,
      role: 'admin',
      createdAt: new Date().toISOString(),
    });
  }
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function passwordIsStrong(password) {
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const matchedUser = [...users.values()].find((user) => user.id === decoded.id);
    if (!matchedUser) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = sanitizeUser(matchedUser);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Revenue dashboard API is healthy', timestamp: new Date().toISOString() });
});

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  if (!passwordIsStrong(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and include uppercase, number, and special character.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = [...users.values()].find((user) => user.email === normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const newUser = {
    id: `user_${Date.now()}`,
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
    role: 'user',
    createdAt: new Date().toISOString(),
  };

  users.set(newUser.email, newUser);
  const token = signToken(newUser);

  return res.status(201).json({ token, user: sanitizeUser(newUser) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = users.get(normalizedEmail);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user);
  return res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/admin-login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = users.get(normalizedEmail);

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  const token = signToken(user);
  return res.json({ token, user: sanitizeUser(user) });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/dashboard/overview', authRequired, (req, res) => {
  const totalRevenue = dashboardData.reduce((sum, item) => sum + item.revenue, 0);
  const avgGrowth = dashboardData.reduce((sum, item) => sum + item.growth, 0) / dashboardData.length;
  const avgChurn = dashboardData.reduce((sum, item) => sum + item.churn, 0) / dashboardData.length;
  const avgRetention = dashboardData.reduce((sum, item) => sum + item.retention, 0) / dashboardData.length;

  res.json({
    ok: true,
    data: {
      summary: {
        totalRevenue,
        avgGrowth,
        avgChurn,
        avgRetention,
      },
      dataset: dashboardData.slice(-12),
      generatedAt: new Date().toISOString(),
    },
  });
});

app.get('/api/dashboard/segments', authRequired, (req, res) => {
  const summary = {
    Enterprise: { revenue: 0, growth: 0, churn: 0, customers: 0, count: 0 },
    'Mid-Market': { revenue: 0, growth: 0, churn: 0, customers: 0, count: 0 },
    SMB: { revenue: 0, growth: 0, churn: 0, customers: 0, count: 0 },
    'Self-Serve': { revenue: 0, growth: 0, churn: 0, customers: 0, count: 0 },
  };

  dashboardData.forEach((entry) => {
    Object.entries(entry.segments).forEach(([segment, values]) => {
      const bucket = summary[segment];
      bucket.revenue += values.revenue;
      bucket.growth += values.growth;
      bucket.churn += values.churn;
      bucket.customers += values.customers;
      bucket.count += 1;
    });
  });

  const output = Object.entries(summary).map(([segment, values]) => ({
    segment,
    revenue: values.revenue,
    growth: values.count ? values.growth / values.count : 0,
    churn: values.count ? values.churn / values.count : 0,
    customers: values.customers,
  }));

  res.json({ ok: true, data: output });
});

app.use(express.static(path.join(__dirname)));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

async function start() {
  await seedAdmin();
  app.listen(PORT, () => {
    console.log(`Revenue dashboard running at http://localhost:${PORT}`);
  });
}

start();
