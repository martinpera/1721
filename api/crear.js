// /api/crear.js
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

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return sendPlain(res, 405, 'Nada que ver acá 𖠂');
    if ((req.headers['sec-fetch-mode'] || '') === 'navigate') return sendPlain(res, 403, 'Nada que ver acá 𖠂');

    const { LNK, AN } = process.env;
    if (!LNK || !AN) return sendJson(res, 500, { ok: false, message: 'Error del servidor' });

    const body = await parseBody(req);
    const usuario = String(body.nombre || '').trim();
    const pass = String(body.password || '').trim();
    if (!usuario || !pass || !/^[a-zA-Z0-9_.-]{3,32}$/.test(usuario)) {
      return sendPlain(res, 400, 'Nada que ver acá 𖠂');
    }

    // ¿ya existe?
    {
      const qs = new URLSearchParams({ select: 'id', nombre: `eq.${usuario}`, limit: '1' }).toString();
      const checkUrl = `${String(LNK).replace(/\/+$/, '')}/rest/v1/usuarios?${qs}`;
      const r1 = await fetch(checkUrl, {
        headers: { Accept: 'application/json', apikey: AN, Authorization: `Bearer ${AN}` },
      });
      if (r1.ok) {
        const rows = await r1.json();
        if (Array.isArray(rows) && rows.length > 0) {
          return sendJson(res, 409, { ok: false, message: 'Ese usuario ya existe.' });
        }
      }
    }

    // bcryptjs: envolvemos en Promise (o usa hashSync si preferís)
    const hash = await new Promise((resolve, reject) => {
      bcrypt.hash(pass, 12, (err, out) => (err ? reject(err) : resolve(out)));
    });

    const insertUrl = `${String(LNK).replace(/\/+$/, '')}/rest/v1/usuarios`;
    const r2 = await fetch(insertUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        apikey: AN,
        Authorization: `Bearer ${AN}`,
      },
      body: JSON.stringify({ nombre: usuario, pass: hash }),
    });

    const respText = await r2.text();
    if (!r2.ok) {
      let msg = 'No se pudo crear.';
      try {
        const j = JSON.parse(respText);
        const parts = ['message', 'hint', 'details', 'code'].map(k => j?.[k]).filter(Boolean);
        if (parts.length) msg = parts.join(' — ');
      } catch {}
      return sendJson(res, r2.status, { ok: false, message: msg });
    }

    return sendJson(res, 201, { ok: true, message: 'Cuenta creada.' });
  } catch (e) {
    return sendJson(res, 500, { ok: false, message: 'Fallo interno', error: String(e?.message || e) });
  }
};
