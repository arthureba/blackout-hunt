require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs   = require('fs');

const scanRouter    = require('./routes/scan');
const rankingRouter = require('./routes/ranking');
const adminRouter   = require('./routes/admin');
const db = require('./db');

// ── DB INIT ──────────────────────────────────────────────
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

const app  = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// ── TRUST PROXY (Railway) ─────────────────────────────────
app.set('trust proxy', 1);

// ── HELMET — headers de segurança HTTP ───────────────────
app.use(helmet({
  // Permite carregar Three.js e fontes do CDN
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      scriptSrcAttr: ["'unsafe-inline'"], // permite onclick inline
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com"],
      imgSrc:      ["'self'", "data:", "https://api.qrserver.com"],
      connectSrc:  ["'self'"],
      objectSrc:   ["'none'"],
      frameAncestors: ["'none'"],   // anti-clickjacking
    },
  },
  crossOriginEmbedderPolicy: false, // necessário para Three.js com CDN
}));

// ── CORS ──────────────────────────────────────────────────
const allowedOrigins = [
  'https://blackouthunt.com.br',
  'https://www.blackouthunt.com.br',
];
const corsOrigin = isProd
  ? (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (/\.railway\.app$/.test(origin)) return cb(null, true);
      return cb(new Error('CORS'));
    }
  : true;

app.use(cors({ origin: corsOrigin }));

// ── BODY PARSER — limite de 20kb (evita payload flood) ───
app.use(express.json({ limit: '20kb' }));

// ── RATE LIMITERS ─────────────────────────────────────────
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,                           // 10 scans/min por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Muitas requisições. Tente novamente em 1 minuto.' },
});

const rankingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,                           // 60 consultas/min por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Muitas requisições. Tente novamente em 1 minuto.' },
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,                           // reduzido: 20/min (era 30)
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Muitas requisições admin. Tente novamente em 1 minuto.' },
});

// ── STATIC FRONTEND ───────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── HEALTH CHECK ──────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true }));

// ── API ROUTES ────────────────────────────────────────────
app.use('/scan',    scanLimiter,    scanRouter);
app.use('/ranking', rankingLimiter, rankingRouter);
app.use('/admin',   adminLimiter,   adminRouter);

// ── FALLBACK SPA ──────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ── GLOBAL ERROR HANDLER ──────────────────────────────────
// Nunca vazar stack trace em produção
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  const status = err.status || 500;
  res.status(status).json({
    ok: false,
    error: isProd ? 'Erro interno do servidor' : err.message,
  });
});

// ── START ─────────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`BLACKOUT HUNT server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});
