require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const scanRouter = require('./routes/scan');
const rankingRouter = require('./routes/ranking');
const adminRouter = require('./routes/admin');
const db = require('./db');

async function initDb(retries = 5) {
  for (let i = 1; i <= retries; i++) {
    try {
      const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
      await db.query(schema);
      console.log('Database schema initialized');
      return;
    } catch (err) {
      console.error(`DB init attempt ${i}/${retries} failed:`, err.message);
      if (i < retries) await new Promise(r => setTimeout(r, 3000 * i));
    }
  }
  console.error('DB init failed after all retries — app will still start');
}

const app = express();
const PORT = process.env.PORT || 3000;

// CORS
const allowedOrigins = [
  'https://blackouthunt.com.br',
  'https://www.blackouthunt.com.br',
];
const corsOrigin = process.env.NODE_ENV === 'production'
  ? (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (/\.railway\.app$/.test(origin)) return cb(null, true);
      return cb(new Error('CORS'));
    }
  : true;
app.use(cors({ origin: corsOrigin }));

app.set('trust proxy', 1);
app.use(express.json());

// Rate limiting
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Muitas requisições. Tente novamente em 1 minuto.' },
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Muitas requisições admin. Tente novamente em 1 minuto.' },
});

// Serve frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// API routes
app.use('/scan', scanLimiter, scanRouter);
app.use('/ranking', rankingRouter);
app.use('/admin', adminLimiter, adminRouter);

// Fallback to frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`BLACKOUT HUNT server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});
