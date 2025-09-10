// /api/imagen.js
'use strict';

/* ============= helpers ============= */
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
function normCodif(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  const low = s.toLowerCase();
  if (low.includes('básic') || low.includes('basic')) return 'Basico';
  if (low.includes('denso')) return 'Denso';
  if (low.includes('númer') || low.includes('numer')) return 'Numeros';
  if (low.includes('bloq')) return 'Bloques';
  if (['Basico','Denso','Numeros','Bloques'].includes(s)) return s;
  return s;
}

/* ============= handler ============= */
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

    const { LNK, AN } = process.env; // 👈 SOLO LNK (base) y AN (anon key)
    if (!LNK || !AN) return sendJson(res, 500, { ok: false, message: 'Error del servidor' });

    const body  = await parseBody(req);
    const txt   = String(body.txt || '').trim();
    const codif = normCodif(body.codif);
    const user  = String(body.user || '').trim();

    if (!user)  return sendJson(res, 400, { ok: false, message: 'Falta usuario' });
    if (!txt)   return sendJson(res, 400, { ok: false, message: 'Falta txt' });
    if (!codif) return sendJson(res, 400, { ok: false, message: 'Falta codif' });

    const payload = { usuario: user, codif, txt };

    const url = `${trimBase(LNK)}/rest/v1/foto`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        apikey: AN,
        Authorization: `Bearer ${AN}`,
      },
      body: JSON.stringify(payload),
    });

    const raw = await r.text();
    if (!r.ok) {
      let msg = `No se pudo crear (HTTP ${r.status}).`;
      try {
        const j = JSON.parse(raw);
        const parts = ['message', 'hint', 'details'].map((k) => j?.[k]).filter(Boolean);
        if (parts.length) msg = parts.join(' — ');
      } catch {}
      return sendJson(res, 400, { ok: false, message: msg });
    }

    const rows = raw ? JSON.parse(raw) : [];
    return sendJson(res, 201, { ok: true, foto: rows[0] || null });

  } catch (e) {
    const status = e?.status ? Number(e.status) : 500;
    return sendJson(res, status, { ok: false, message: String(e?.message || e) });
  }
};
