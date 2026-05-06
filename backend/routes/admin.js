const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db');

function adminAuth(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ ok: false, error: 'Não autorizado' });
  }
  next();
}

router.use(adminAuth);

router.post('/activate', async (req, res) => {
  const { step } = req.body;
  const stepNum = parseInt(step, 10);
  if (!stepNum || stepNum < 1 || stepNum > 4) {
    return res.status(400).json({ ok: false, error: 'step deve ser entre 1 e 4' });
  }
  try {
    await db.query(
      `UPDATE qr_codes SET is_active = TRUE, activated_at = NOW() WHERE step = $1`,
      [stepNum]
    );
    return res.json({ ok: true, message: `QR ${stepNum} ativado` });
  } catch (err) {
    console.error('Activate error:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
  }
});

router.post('/deactivate', async (req, res) => {
  const { step } = req.body;
  const stepNum = parseInt(step, 10);
  if (!stepNum || stepNum < 1 || stepNum > 4) {
    return res.status(400).json({ ok: false, error: 'step deve ser entre 1 e 4' });
  }
  try {
    await db.query(
      `UPDATE qr_codes SET is_active = FALSE WHERE step = $1`,
      [stepNum]
    );
    return res.json({ ok: true, message: `QR ${stepNum} desativado` });
  } catch (err) {
    console.error('Deactivate error:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const [qrResult, stateResult, countResult] = await Promise.all([
      db.query('SELECT step, is_active, activated_at FROM qr_codes ORDER BY step'),
      db.query(
        `SELECT ss.winner_user_id, u.name as winner_name, u.instagram as winner_instagram
         FROM system_state ss
         LEFT JOIN users u ON u.id = ss.winner_user_id
         WHERE ss.id = 1`
      ),
      db.query('SELECT COUNT(*) as total FROM users'),
    ]);

    return res.json({
      ok: true,
      qr_codes: qrResult.rows,
      winner: stateResult.rows[0]?.winner_user_id
        ? {
            id: stateResult.rows[0].winner_user_id,
            name: stateResult.rows[0].winner_name,
            instagram: stateResult.rows[0].winner_instagram,
          }
        : null,
      total_users: parseInt(countResult.rows[0].total, 10),
    });
  } catch (err) {
    console.error('Status error:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
  }
});

router.post('/init-db', async (req, res) => {
  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'schema.sql'), 'utf8');
    await db.query(schema);
    return res.json({ ok: true, message: 'Schema inicializado com sucesso' });
  } catch (err) {
    console.error('Init DB error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/reset-all', async (req, res) => {
  try {
    await db.query('UPDATE system_state SET winner_user_id = NULL WHERE id = 1');
    await db.query('UPDATE qr_codes SET is_active = FALSE, activated_at = NULL');
    await db.query('DELETE FROM users');
    return res.json({ ok: true, message: 'Todos os dados resetados' });
  } catch (err) {
    console.error('Reset all error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/reset-winner', async (req, res) => {
  try {
    await db.query('UPDATE system_state SET winner_user_id = NULL WHERE id = 1');
    return res.json({ ok: true, message: 'Vencedor resetado com sucesso' });
  } catch (err) {
    console.error('Reset winner error:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
  }
});

module.exports = router;
