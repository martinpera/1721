// /api/obtenerimg.js
module.exports = async (req, res) => {
  const sendPlain = (code, text = 'Nada que ver acá 𖠂') => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(text);
  };
  const sendJson = (code, obj) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(obj));
  };

  async function readJSONBody(rq) {
    try {
      let b = rq.body;
      if (b == null) {
        const chunks = [];
        for await (const chunk of rq) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) return null;
        return JSON.parse(raw);
      }
      if (Buffer.isBuffer(b)) return JSON.parse(b.toString('utf8'));
      if (typeof b === 'string') return JSON.parse(b);
      if (typeof b === 'object') return b;
      return null;
    } catch { return null; }
  }

  try {
    if (req.method === 'OPTIONS' || req.method === 'HEAD') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS,HEAD');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept');
      return sendPlain(204, '');
    }

    if (req.method !== 'POST') return sendPlain(405, 'Nada que ver acá 𖠂');

    const { LNK, AN } = process.env;
    if (!LNK || !AN) return sendJson(500, { ok: false, message: 'Nada que ver acá 𖠂' });

    const body = await readJSONBody(req);
    const idRaw = body && (body.id ?? body.ID);
    if (idRaw == null || String(idRaw).trim() === '') {
      return sendJson(400, { ok: false, message: 'Falta parámetro id' });
    }

    const idNumStr = String(idRaw).replace(/[^\d]/g, '');
    if (!idNumStr || idNumStr === '0') {
      return sendJson(400, { ok: false, message: 'id inválido' });
    }

    const base = String(LNK).replace(/\/+$/, '');
    const select = encodeURIComponent('id,codif,usuario,txt');
    const url = `${base}/rest/v1/foto?select=${select}&id=eq.${encodeURIComponent(idNumStr)}&limit=1`;

    const r = await fetch(url, {
      headers: {
        Accept: 'application/json',
        apikey: AN,
        Authorization: `Bearer ${AN}`,
      },
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      return sendJson(r.status, { ok: false, message: 'Consulta rechazada', detail: detail.slice(0, 300) });
    }

    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return sendJson(404, { ok: false, message: 'No encontrado' });
    }

    const row = rows[0] || {};
    return sendJson(200, {
      ok: true,
      foto: {
        id: row.id,
        codif: row.codif || '',
        usuario: row.usuario || 'anon',
        txt: row.txt || '',
      },
    });
  } catch (e) {
    return sendJson(500, { ok: false, message: 'Fallo interno', error: String(e?.message || e) });
  }
};
