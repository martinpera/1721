// /api/delete.js
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

/* ================== utils ================== */
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
    const user = String(body.user || '').trim();
    const id    = body.id ? Number(body.id) : null;
    const text  = body.text != null ? String(body.text) : null;

    if (!user) return sendJson(res, 400, { ok:false, message:'user requerido' });
    if (!id && !text) return sendJson(res, 400, { ok:false, message:'id o text requerido' });

    // armamos query: siempre limitamos por user
    const qp = new URLSearchParams();
    qp.set('user', `eq.${user}`);
    if (id)   qp.set('id', `eq.${encodeURIComponent(String(id))}`);
    if (text) qp.set('text', `eq.${encodeURIComponent(text)}`);

    const url = `${trimBase(LNK)}/rest/v1/post?${qp.toString()}`;

    const r = await fetch(url, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'return=representation', // queremos los rows borrados
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
      },
    });

    const raw = await r.text().catch(()=>'');

    if (!r.ok) {
      let msg = `No se pudo borrar (HTTP ${r.status}).`;
      try {
        const j = JSON.parse(raw);
        const parts = ['message','hint','details'].map(k=>j?.[k]).filter(Boolean);
        if (parts.length) msg = parts.join(' — ');
      } catch {}
      return sendJson(res, 400, { ok:false, message: msg });
    }

    let deleted = 0, ids = [];
    try {
      const rows = raw ? JSON.parse(raw) : [];
      if (Array.isArray(rows)) { deleted = rows.length; ids = rows.map(r=>r.id).filter(Boolean); }
    } catch {}
    return sendJson(res, 200, { ok:true, deleted, ids });
  } catch (e) {
    const status = e?.status ? Number(e.status) : 500;
    return sendJson(res, status, { ok:false, message: String(e?.message || e) });
  }
};
