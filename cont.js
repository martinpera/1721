// /api/cont.js
'use strict';

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

const trimBase = (u) => String(u || '').replace(/\/+$/, '');

function pickKey() {
  const { SUPABASE_SERVICE_ROLE, SRV, AN } = process.env;
  return SUPABASE_SERVICE_ROLE || SRV || AN || '';
}

async function insertUso({ base, key, nuevo }) {
  const payload = { usos: 1, nuevos: nuevo ? 1 : 0 };
  const url = `${trimBase(base)}/rest/v1/contadorusos`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      apikey: key,
      Authorization: `Bearer ${key}`,
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
    const e = new Error(msg);
    e.status = r.status;
    throw e;
  }
  const rows = raw ? JSON.parse(raw) : [];
  return rows[0] || null;
}

module.exports = async (req, res) => {
  try {
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
    const op = String(body.op || 'bump').toLowerCase();

    if (op === 'bump') {
      const nuevo = body.nuevo === true || body.nuevo === 'true' || Number(body.nuevo) === 1;
      const row = await insertUso({ base: LNK, key: KEY, nuevo });
      return sendJson(res, 201, { ok: true, uso: row });
    }

    return sendJson(res, 400, { ok: false, message: 'Operación no soportada' });
  } catch (e) {
    const status = e?.status ? Number(e.status) : 500;
    return sendJson(res, status, { ok: false, message: String(e?.message || e) });
  }
};
