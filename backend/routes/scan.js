const express = require('express');
const router = express.Router();
const db = require('../db');
const CHECKPOINTS = require('../config/checkpoints');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;

// Distância em metros entre dois pontos GPS (fórmula de Haversine)
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // raio da Terra em metros
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxMtwRLnjr3-B2FfST4Le20SsingGQpTBB6qnmlgiFvvzxf8DOkbPBTy6OWgBu0iyhNcQ/exec';

async function sendToSheets(data) {
  try {
    await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.error('Sheets sync error:', err.message);
  }
}

function formatMs(ms) {
  if (ms == null) return null;
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function buildUserPayload(user, thisStep) {
  return {
    id: user.id,
    name: user.name,
    instagram: user.instagram,
    total_qr: user.total_qr,
    total_time_ms: user.total_time_ms,
    total_time_formatted: formatMs(user.total_time_ms),
    progress: {
      qr1: user.qr1_time_ms != null,
      qr2: user.qr2_time_ms != null,
      qr3: user.qr3_time_ms != null,
      qr4: user.qr4_time_ms != null,
    },
    completedCount: user.total_qr,
    qr_times: {
      qr1: formatMs(user.qr1_time_ms),
      qr2: formatMs(user.qr2_time_ms),
      qr3: formatMs(user.qr3_time_ms),
      qr4: formatMs(user.qr4_time_ms),
    },
  };
}

router.post('/', async (req, res) => {
  const { step, name, email, phone, instagram, lat, lng } = req.body;

  // Validate step
  const stepNum = parseInt(step, 10);
  if (!stepNum || stepNum < 1 || stepNum > 4) {
    return res.status(400).json({ ok: false, error: 'step deve ser entre 1 e 4' });
  }

  // ── GEOFENCING — só aceita scan se estiver fisicamente no local ──
  const geo = CHECKPOINTS[stepNum];
  if (geo && geo.enabled) {
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      return res.status(422).json({
        ok: false,
        error: 'Ative a localização do seu celular para registrar este checkpoint.',
        needLocation: true,
      });
    }

    const dist = distanceMeters(userLat, userLng, geo.lat, geo.lng);
    if (dist > geo.radiusMeters) {
      return res.status(403).json({
        ok: false,
        error: 'Você precisa estar no local do checkpoint para registrar. Aproxime-se do QR Code físico.',
        tooFar: true,
      });
    }
  }

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ ok: false, error: 'name é obrigatório (mínimo 2 caracteres)' });
  }
  if (!email || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ ok: false, error: 'email inválido' });
  }
  if (!phone || !PHONE_RE.test(phone.trim())) {
    return res.status(400).json({ ok: false, error: 'telefone inválido' });
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.trim();
  const cleanInsta = instagram ? instagram.trim() : null;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Check QR active
    const qrResult = await client.query(
      'SELECT is_active, activated_at FROM qr_codes WHERE step = $1',
      [stepNum]
    );
    const qr = qrResult.rows[0];
    if (!qr || !qr.is_active) {
      await client.query('ROLLBACK');
      return res.status(403).json({ ok: false, error: `QR ${stepNum} não está ativo ainda` });
    }

    const activatedAt = new Date(qr.activated_at).getTime();

    // Find or create user (by email OR phone)
    let userResult = await client.query(
      'SELECT * FROM users WHERE LOWER(email) = $1 OR phone = $2 LIMIT 1',
      [cleanEmail, cleanPhone]
    );

    let user;
    if (userResult.rows.length === 0) {
      const insertResult = await client.query(
        `INSERT INTO users (name, email, phone, instagram)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [cleanName, cleanEmail, cleanPhone, cleanInsta]
      );
      user = insertResult.rows[0];
    } else {
      user = userResult.rows[0];
      // Update name/instagram if changed
      await client.query(
        'UPDATE users SET name = $1, instagram = $2 WHERE id = $3',
        [cleanName, cleanInsta, user.id]
      );
      user.name = cleanName;
      user.instagram = cleanInsta;
    }

    // Check sequential order
    if (stepNum > 1) {
      const prevCol = `qr${stepNum - 1}_time_ms`;
      if (user[prevCol] == null) {
        await client.query('ROLLBACK');
        return res.status(422).json({
          ok: false,
          error: `Você precisa completar a etapa ${stepNum - 1} antes`,
        });
      }
    }

    // Check duplicate scan
    const qrCol = `qr${stepNum}_time_ms`;
    if (user[qrCol] != null) {
      await client.query('ROLLBACK');

      // Check winner status for step 4
      let winnerStatus = null;
      if (stepNum === 4) {
        const stateResult = await client.query('SELECT winner_user_id FROM system_state WHERE id = 1');
        const winnerId = stateResult.rows[0]?.winner_user_id;
        winnerStatus = winnerId === user.id ? 'winner' : 'already_claimed';
      }

      return res.json({
        ok: true,
        duplicate: true,
        winnerStatus,
        user: buildUserPayload(user, null),
        thisStep: {
          step: stepNum,
          time_ms: user[qrCol],
          time_formatted: formatMs(user[qrCol]),
        },
      });
    }

    // Calculate time spent
    const now = Date.now();
    const timeSpentMs = now - activatedAt;

    // Update user record (parse as int to avoid string concatenation with BIGINT)
    const newTotal = (parseInt(user.total_time_ms, 10) || 0) + timeSpentMs;
    const newTotalQr = (parseInt(user.total_qr, 10) || 0) + 1;

    const updateResult = await client.query(
      `UPDATE users
       SET ${qrCol} = $1,
           total_time_ms = $2,
           total_qr = $3
       WHERE id = $4
       RETURNING *`,
      [timeSpentMs, newTotal, newTotalQr, user.id]
    );
    user = updateResult.rows[0];

    // Handle winner logic for step 4
    let winnerStatus = null;
    if (stepNum === 4) {
      const stateResult = await client.query(
        'SELECT winner_user_id FROM system_state WHERE id = 1'
      );
      const currentWinner = stateResult.rows[0]?.winner_user_id;

      if (!currentWinner) {
        await client.query(
          'UPDATE system_state SET winner_user_id = $1 WHERE id = 1',
          [user.id]
        );
        winnerStatus = 'winner';
      } else if (currentWinner === user.id) {
        winnerStatus = 'winner';
      } else {
        winnerStatus = 'already_claimed';
      }
    }

    await client.query('COMMIT');

    // Sync lead to Google Sheets apenas no primeiro scan
    if (stepNum === 1) {
      sendToSheets({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        instagram: cleanInsta,
        step: stepNum,
      });
    }

    return res.json({
      ok: true,
      duplicate: false,
      winnerStatus,
      user: buildUserPayload(user, stepNum),
      thisStep: {
        step: stepNum,
        time_ms: timeSpentMs,
        time_formatted: formatMs(timeSpentMs),
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Scan error:', err);

    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'Email ou telefone já cadastrado com dados conflitantes' });
    }
    return res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

module.exports = router;
