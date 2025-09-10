// /api/login.js
const bcrypt = require('bcryptjs');

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => {
      const ct = String(req.headers['content-type'] || '').toLowerCase();
      if (ct.includes('application/json')) resolve(data ? JSON.parse(data) : {});
      else resolve(Object.fromEntries(new URLSearchParams(data)));
    });
  });
}

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

const pareceHash = (s = '') => /^\$(2y|2a|2b)\$|^\$argon2(id|i)\$/.test(s);
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return sendPlain(res, 405, 'Nada que ver acá 𖠂');
    if ((req.headers['sec-fetch-mode'] || '') === 'navigate') return sendPlain(res, 403, 'Nada que ver acá 𖠂');

    const { LNK, AN } = process.env;
    if (!LNK || !AN) return sendJson(res, 500, { ok: false, message: 'Error del servidor' });

    const body = await parseBody(req);
    const usuario = String(body.email || body.nombre || '').trim();
    const pass = String(body.password || '').trim();
    if (!usuario || !pass) return sendPlain(res, 400, 'Nada que ver acá 𖠂');

    const qs = new URLSearchParams({
      select: 'id,nombre,pass',
      nombre: `eq.${usuario}`,
      limit: '1',
    }).toString();
    const url = `${String(LNK).replace(/\/+$/, '')}/rest/v1/usuarios?${qs}`;

    const r = await fetch(url, {
      headers: { Accept: 'application/json', apikey: AN, Authorization: `Bearer ${AN}` },
    });
    if (!r.ok) return sendJson(res, r.status, { ok: false, message: 'Consulta rechazada.' });

    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return sendJson(res, 401, { ok: false, message: 'Usuario o contraseña incorrectos.' });
    }

    const row = rows[0];
    const hash = String(row.pass || '');
    let ok = false;

    if (hash) {
      if (pareceHash(hash)) {
        // bcryptjs compare -> envolver en Promise
        ok = await new Promise((resolve, reject) => {
          bcrypt.compare(pass, hash, (err, same) => (err ? reject(err) : resolve(!!same)));
        });
      } else {
        ok = timingSafeEqual(hash, pass); // solo para entornos de prueba
      }
    }

    if (!ok) {
      return sendJson(res, 401, { ok: false, message: 'Usuario o contraseña incorrectos.' });
    }

    return sendJson(res, 200, {
      ok: true,
      message: 'Bienvenido',
      id: row.id,
      nombre: row.nombre || usuario,
    });
  } catch (e) {
    return sendJson(res, 500, { ok: false, message: 'Fallo interno', error: String(e?.message || e) });
  }
};
