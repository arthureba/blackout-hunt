const express = require('express');
const router = express.Router();
const db = require('../db');

function formatMs(ms) {
  if (ms == null) return null;
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

router.get('/', async (req, res) => {
  try {
    const [rankingResult, stateResult] = await Promise.all([
      db.query(
        `SELECT id, name, instagram, total_qr, total_time_ms,
                qr1_time_ms, qr2_time_ms, qr3_time_ms, qr4_time_ms
         FROM users
         ORDER BY total_qr DESC, total_time_ms ASC
         LIMIT 100`
      ),
      db.query('SELECT winner_user_id FROM system_state WHERE id = 1'),
    ]);

    const winnerId = stateResult.rows[0]?.winner_user_id || null;

    const ranking = rankingResult.rows.map((u, idx) => ({
      position: idx + 1,
      id: u.id,
      name: u.name,
      instagram: u.instagram,
      total_qr: u.total_qr,
      total_time_ms: u.total_time_ms,
      total_time_formatted: formatMs(u.total_time_ms),
      is_winner: winnerId != null && u.id === winnerId,
      qr_times: {
        qr1: formatMs(u.qr1_time_ms),
        qr2: formatMs(u.qr2_time_ms),
        qr3: formatMs(u.qr3_time_ms),
        qr4: formatMs(u.qr4_time_ms),
      },
    }));

    return res.json({ ok: true, winner_id: winnerId, ranking });
  } catch (err) {
    console.error('Ranking error:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
  }
});

module.exports = router;
