// /api/obtain.js
module.exports = async (req, res) => {
  // Helpers de salida (compatibles con Node 22 en Vercel)
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

  try {
    if (req.method !== 'GET') return sendPlain(405, 'Nada que ver acá 𖠂');

    const { LNK, AN } = process.env;
    if (!LNK || !AN) return sendJson(500, { ok: false, message: 'Nada que ver acá 𖠂' });

    // Parsear query ?limit=… (funciona tanto con req.query como con req.url)
    let limit = 100;
    try {
      const urlObj = new URL(req.url, 'http://local');
      const qLimit = urlObj.searchParams.get('limit') ??
                     (req.query ? req.query.limit : undefined);
      limit = Math.min(parseInt(qLimit || '100', 10) || 100, 200);
    } catch { /* usa 100 */ }

    const base = String(LNK).replace(/\/+$/, '');
    const order = 'id.desc';
    // OJO: "user" es palabra reservada; hay que citarla
    const select = encodeURIComponent('id,created_at,text,"user"');

    const url = `${base}/rest/v1/post?select=${select}&order=${encodeURIComponent(order)}&limit=${limit}`;

    const r = await fetch(url, {
      headers: {
        Accept: 'application/json',
        apikey: AN,
        Authorization: `Bearer ${AN}`,
      },
    });

    if (!r.ok) return sendJson(r.status, { ok: false, message: 'Consulta rechazada' });

    const rows = await r.json();
    return sendJson(200, { ok: true, posts: Array.isArray(rows) ? rows : [] });
  } catch (e) {
    return sendJson(500, { ok: false, message: 'Fallo interno',error: String(e?.message || e) });
  }
};
