// /api/post.js
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

/** Elegimos la key más “poderosa” disponible SIN tocar Supabase: 
 *  - SUPABASE_SERVICE_ROLE (si la seteás en el backend, RLS no molesta)
 *  - AN (anon) como fallback
 */
function pickKey() {
  const { SUPABASE_SERVICE_ROLE, SRV, AN } = process.env;
  return SUPABASE_SERVICE_ROLE || SRV || AN || '';
}

async function getPost({ base, key, id }) {
  const url =
    `${trimBase(base)}/rest/v1/post` +
    `?select=id,parent,"user",L,D,text` +
    `&id=eq.${encodeURIComponent(String(id))}` +
    `&limit=1`;
  const r = await fetch(url, {
    headers: { Accept: 'application/json', apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) {
    const raw = await r.text().catch(() => '');
    const e = new Error(`GET post ${id} falló (${r.status}) ${raw || ''}`.trim());
    e.status = r.status;
    throw e;
  }
  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    const e = new Error('No existe el post');
    e.status = 404;
    throw e;
  }
  return rows[0];
}

async function patchRow({ base, key, id, patch }) {
  const url = `${trimBase(base)}/rest/v1/post?id=eq.${encodeURIComponent(String(id))}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(patch),
  });
  const raw = await r.text();
  if (!r.ok) {
    let msg = 'Actualización rechazada';
    try {
      const j = JSON.parse(raw);
      const parts = ['message', 'hint', 'details', 'code'].map((k) => j?.[k]).filter(Boolean);
      if (parts.length) msg = parts.join(' — ');
    } catch {}
    const e = new Error(msg);
    e.status = r.status;
    throw e;
  }
  const rows = raw ? JSON.parse(raw) : [];
  return rows[0] || null;
}

/* ================== handler ================== */
module.exports = async (req, res) => {
  try {
    // CORS básico + preflight (por si tu deploy mete OPTIONS)
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
    const KEY = pickKey(); // 👈 acá usamos service_role si la tenés seteada
    if (!LNK || !KEY) return sendJson(res, 500, { ok: false, message: 'Error del servidor' });

    const body = await parseBody(req);
    const op = String(body.op || '').toLowerCase();

    /* ========= CREAR =========
       Solo guarda { user, text } “tal cual”. No interpretamos r(ID), no seteamos parent, nada más.
    */
    if (op === 'create' || (!op && body.text)) {
      const user = String(body.user || '').trim() || 'anon';
      const text = String(body.text || '').trim();
      if (!text) return sendJson(res, 400, { ok: false, message: 'Falta texto' });

      const payload = { user, text };

      const url = `${trimBase(LNK)}/rest/v1/post`;
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
        // No cambiamos nada en Supabase, pero devolvemos el error bien claro
        let msg = `No se pudo crear (HTTP ${r.status}).`;
        try {
          const j = JSON.parse(raw);
          const parts = ['message', 'hint', 'details'].map((k) => j?.[k]).filter(Boolean);
          if (parts.length) msg = parts.join(' — ');
        } catch {}
        return sendJson(res, 400, { ok: false, message: msg });
      }
      const rows = raw ? JSON.parse(raw) : [];
      return sendJson(res, 201, { ok: true, post: rows[0] || null });
    }

    /* ========= VOTAR =========
       Suma/resta sobre columnas L/D. No toca nada más.
    */
    if (op === 'vote' || (!op && body.id && body.dir)) {
      const id = Number(body.id);
      const dir = String(body.dir || '').toLowerCase(); // 'like' | 'dislike'
      let delta = Number(body.delta);
      if (!Number.isFinite(delta)) delta = 1;

      if (!Number.isFinite(id) || id <= 0 || (dir !== 'like' && dir !== 'dislike')) {
        return sendJson(res, 400, { ok: false, message: 'Datos de voto inválidos' });
      }

      const row = await getPost({ base: LNK, key: KEY, id });
      let L = Number(row.L || 0);
      let D = Number(row.D || 0);

      if (dir === 'like') L = Math.max(0, L + delta);
      if (dir === 'dislike') D = Math.max(0, D + delta);

      const updated = await patchRow({
        base: LNK,
        key: KEY,
        id,
        patch: dir === 'like' ? { L } : { D },
      });

      return sendJson(res, 200, { ok: true, post: updated });
    }

    return sendJson(res, 400, { ok: false, message: 'Operación no soportada' });
  } catch (e) {
    const status = e?.status ? Number(e.status) : 500;
    return sendJson(res, status, { ok: false, message: String(e?.message || e) });
  }
};
