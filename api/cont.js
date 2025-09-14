// /api/cont.js
'use strict';

/* ================== helpers respuesta ================== */
function sendPlain(res, code, text = 'Nada que ver acá 𖠂') {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(text);
}
function sendJson(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

/* ================== parseo body (json o form) ================== */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        const ct = String(req.headers['content-type'] || '').toLowerCase();
        if (ct.includes('application/json')) resolve(data ? JSON.parse(data) : {});
        else resolve(Object.fromEntries(new URLSearchParams(data)));
      } catch (e) {
        reject(Object.assign(new Error('JSON inválido'), { status: 400 }));
      }
    });
  });
}

/* ================== supabase utils ================== */
const trimBase = (u) => String(u || '').replace(/\/+$/, '');

function pickKey() {
  const { SUPABASE_SERVICE_ROLE, SRV, AN } = process.env;
  return SUPABASE_SERVICE_ROLE || SRV || AN || '';
}

/* ================== handler ================== */
module.exports = async (req, res) => {
  try {
    // CORS + preflight
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.end();
    }
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method !== 'POST') return sendPlain(res, 405, 'Nada que ver acá 𖠂');
    if ((req.headers['sec-fetch-mode'] || '') === 'navigate') return sendPlain(res, 403, 'Nada que ver acá 𖠂');

    const { LNK } = process.env;
    const KEY = pickKey();
    if (!LNK || !KEY) return sendJson(res, 500, { ok: false, message: 'Error del servidor' });

    const body = await parseBody(req);

    // Permitimos { usos:1 }, { nuevos:1 } o ambos. Coerción segura.
    let usos = Number(body.usos);
    let nuevos = Number(body.nuevos);
    usos = Number.isFinite(usos) && usos > 0 ? usos : 0;
    nuevos = Number.isFinite(nuevos) && nuevos > 0 ? nuevos : 0;

    if (usos <= 0 && nuevos <= 0) {
      return sendJson(res, 400, { ok: false, message: 'Nada para registrar' });
    }

    // Armamos el payload. El id y created_at los maneja la DB (default/identity).
    const payload = {};
    if (usos > 0) payload.usos = usos;
    if (nuevos > 0) payload.nuevos = nuevos;

    const url = `${trimBase(LNK)}/rest/v1/contadorusos`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const raw = await r.text();
    if (!r.ok) {
      let msg = `No se pudo registrar (HTTP ${r.status}).`;
      try {
        const j = JSON.parse(raw);
        const parts = ['message', 'hint', 'details'].map((k) => j?.[k]).filter(Boolean);
        if (parts.length) msg = parts.join(' — ');
      } catch {}
      return sendJson(res, 400, { ok: false, message: msg });
    }

    const rows = raw ? JSON.parse(raw) : [];
    return sendJson(res, 201, { ok: true, row: rows[0] || null });
  } catch (e) {
    const status = e?.status ? Number(e.status) : 500;
    return sendJson(res, status, { ok: false, message: String(e?.message || e) });
  }
};

