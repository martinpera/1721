// /api/idobtain.js
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

    const { LNK, AN } = process.env;
    if (!LNK || !AN) return sendJson(res, 500, { ok:false, message:'Error del servidor' });

    const body = await parseBody(req);
    const user   = String(body.user || '').trim();
    const idHint = body.id_hint ? Number(body.id_hint) : null;
    const codif  = String(body.codif || '').trim();
    const txt    = typeof body.txt === 'string' ? body.txt : '';

    if(!user) return sendJson(res, 400, { ok:false, message:'Falta usuario' });

    // 1) si viene id_hint, verifico que exista
    if(Number.isFinite(idHint) && idHint > 0){
      const url = `${trimBase(LNK)}/rest/v1/foto?select=id,usuario&id=eq.${encodeURIComponent(idHint)}&limit=1`;
      const r = await fetch(url, { headers:{ Accept:'application/json', apikey:AN, Authorization:`Bearer ${AN}` }});
      const rows = r.ok ? await r.json() : [];
      if(Array.isArray(rows) && rows.length && String(rows[0].usuario||'') === user){
        return sendJson(res, 200, { ok:true, id: rows[0].id });
      }
      // si no coincide usuario o no existe, seguimos con otros métodos
    }

    // 2) si tengo txt+codif, intento match exacto (¡OJO: URL larga!)
    if(txt && codif){
      const url =
        `${trimBase(LNK)}/rest/v1/foto` +
        `?select=id` +
        `&usuario=eq.${encodeURIComponent(user)}` +
        `&codif=eq.${encodeURIComponent(codif)}` +
        `&txt=eq.${encodeURIComponent(txt)}` +
        `&limit=1`;
      const r = await fetch(url, { headers:{ Accept:'application/json', apikey:AN, Authorization:`Bearer ${AN}` }});
      if(r.ok){
        const rows = await r.json();
        if(Array.isArray(rows) && rows.length){
          return sendJson(res, 200, { ok:true, id: rows[0].id });
        }
      }
    }

    // 3) último recurso: tomo el último del usuario
    {
      const url =
        `${trimBase(LNK)}/rest/v1/foto` +
        `?select=id,created_at` +
        `&usuario=eq.${encodeURIComponent(user)}` +
        `&order=created_at.desc` +
        `&limit=1`;
      const r = await fetch(url, { headers:{ Accept:'application/json', apikey:AN, Authorization:`Bearer ${AN}` }});
      const rows = r.ok ? await r.json() : [];
      if(Array.isArray(rows) && rows.length){
        return sendJson(res, 200, { ok:true, id: rows[0].id });
      }
    }

    return sendJson(res, 404, { ok:false, message:'No se encontró la foto' });

  } catch (e) {
    const status = e?.status ? Number(e.status) : 500;
    return sendJson(res, status, { ok:false, message:String(e?.message || e) });
  }
};
