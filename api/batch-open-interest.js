const UPSTREAM = "https://fapi.binance.com/fapi/v1/openInterest";

async function fetchOne(symbol) {
  const url = `${UPSTREAM}?symbol=${encodeURIComponent(symbol)}`;
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) return { symbol, openInterest: 0 };
  const data = await response.json();
  return {
    symbol: data.symbol || symbol,
    openInterest: parseFloat(data.openInterest || 0) || 0,
  };
}

async function parseBody(req) {
  if (req.body != null && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return res.status(400).json({ error: "Invalid body" });
  }

  const symbols = body.symbols;
  if (!Array.isArray(symbols) || symbols.length === 0) {
    return res.status(400).json({ error: "symbols must be a non-empty array" });
  }

  const unique = [...new Set(symbols.map((s) => String(s).toUpperCase()))];
  const limit = Math.min(30, Math.max(8, Number(body.concurrency) || 20));
  const openInterestBySymbol = {};
  let idx = 0;

  async function worker() {
    while (idx < unique.length) {
      const i = idx++;
      const sym = unique[i];
      try {
        const row = await fetchOne(sym);
        openInterestBySymbol[sym] = row.openInterest;
      } catch {
        openInterestBySymbol[sym] = 0;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, unique.length) }, worker));

  return res.status(200).json({ openInterestBySymbol });
};
