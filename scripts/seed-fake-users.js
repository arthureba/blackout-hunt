/**
 * seed-fake-users.js
 * Insere participantes falsos para prova social no ranking.
 * Nenhum completa os 4 checkpoints — não podem vencer.
 *
 * Uso:
 *   DATABASE_URL="postgres://..." node scripts/seed-fake-users.js
 *   ou
 *   railway run node scripts/seed-fake-users.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

// ── NOMES BRASILEIROS REAIS ──────────────────────────────
const NOMES = [
  'Gabriel Silva',    'Lucas Oliveira',   'Matheus Santos',
  'Pedro Almeida',    'Rafael Costa',     'Bruno Ferreira',
  'Diego Rodrigues',  'Felipe Martins',   'Guilherme Lima',
  'Henrique Souza',   'Igor Pereira',     'João Carvalho',
  'Caio Gomes',       'Daniel Barbosa',   'Eduardo Ribeiro',
  'Fábio Araújo',     'Gustavo Mendes',   'Hugo Nunes',
  'Leandro Castro',   'Marcelo Dias',     'Natalia Moreira',
  'Amanda Rocha',     'Bianca Cardoso',   'Carolina Pinto',
  'Daniela Teixeira', 'Fernanda Lopes',   'Giovana Freitas',
  'Helena Azevedo',   'Isabela Melo',     'Juliana Macedo',
  'Kamila Batista',   'Larissa Andrade',  'Mariana Correia',
  'Nicole Vieira',    'Patricia Monteiro','Renata Cunha',
  'Sabrina Paiva',    'Thais Cavalcanti', 'Viviane Borges',
  'Aline Campos',
];

// ── CONFIG ────────────────────────────────────────────────
const TOTAL_FAKE  = parseInt(process.argv[2] || '10', 10); // padrão: 10
const SPREAD_DAYS = parseInt(process.argv[3] || '7',  10); // distribuir em N dias
const NOW         = Date.now();
const DAY_MS      = 24 * 60 * 60 * 1000;

// Distribuição: mais gente nos dias do meio (curva de sino)
function randomDayOffset() {
  // beta distribution aproximada: concentra no meio do período
  const u = Math.random(), v = Math.random();
  const normal = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  const t = Math.max(0, Math.min(1, 0.5 + normal * 0.2));
  return Math.floor(t * SPREAD_DAYS * DAY_MS);
}

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Tempo realista de checkpoint (em ms a partir da ativação do QR)
// Entre 3 min e 45 min por checkpoint
function randomCheckpointTime() {
  return randBetween(3 * 60 * 1000, 45 * 60 * 1000);
}

function fakeEmail(nome) {
  const slug = nome.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.') + randBetween(10, 999);
  const domains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'icloud.com'];
  return `${slug}@${domains[randBetween(0, domains.length - 1)]}`;
}

function fakePhone() {
  const ddd = [11,11,11,21,31,41,51,61,71,81][randBetween(0,9)];
  return `+55${ddd}9${randBetween(10000000, 99999999)}`;
}

function fakeInsta(nome) {
  if (Math.random() < 0.5) return null; // 50% não tem insta
  const slug = nome.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(' ')[0] + randBetween(1, 99);
  return `@${slug}`;
}

// Quantos checkpoints cada fake completa (1, 2 ou 3 — nunca 4)
function howManyCheckpoints() {
  const r = Math.random();
  if (r < 0.25) return 1;   // 25% — só o primeiro
  if (r < 0.65) return 2;   // 40% — dois checkpoints
  return 3;                  // 35% — quase lá, mas não chega
}

async function seed() {
  const client = await pool.connect();
  console.log(`\n🚀 Inserindo ${TOTAL_FAKE} participantes falsos (distribuídos em ${SPREAD_DAYS} dias)...\n`);

  const nomesSelecionados = [...NOMES].sort(() => Math.random() - 0.5).slice(0, TOTAL_FAKE);

  for (const nome of nomesSelecionados) {
    const email    = fakeEmail(nome);
    const phone    = fakePhone();
    const instagram = fakeInsta(nome);
    const checkpoints = howManyCheckpoints();
    const createdAt = new Date(NOW - randomDayOffset() - DAY_MS); // no passado

    // Tempos individuais por checkpoint
    const t1 = checkpoints >= 1 ? randomCheckpointTime() : null;
    const t2 = checkpoints >= 2 ? randomCheckpointTime() : null;
    const t3 = checkpoints >= 3 ? randomCheckpointTime() : null;
    const t4 = null; // NUNCA completa o 4º

    const totalMs = (t1 || 0) + (t2 || 0) + (t3 || 0);

    try {
      await client.query(`
        INSERT INTO users
          (name, email, phone, instagram,
           qr1_time_ms, qr2_time_ms, qr3_time_ms, qr4_time_ms,
           total_qr, total_time_ms, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT DO NOTHING
      `, [
        nome, email, phone, instagram,
        t1, t2, t3, t4,
        checkpoints, totalMs,
        createdAt,
      ]);

      const bar = '█'.repeat(checkpoints) + '░'.repeat(4 - checkpoints);
      console.log(`  ✓ ${nome.padEnd(22)} [${bar}] ${checkpoints}/4 checkpoints`);
    } catch (err) {
      console.error(`  ✗ ${nome}: ${err.message}`);
    }
  }

  client.release();
  await pool.end();
  console.log('\n✅ Concluído! Confira o ranking em www.blackouthunt.com.br\n');
}

seed().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
