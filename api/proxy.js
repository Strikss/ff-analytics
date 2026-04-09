async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "user-agent": "Mozilla/5.0",
      ...(options.headers || {}),
    },
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "user-agent": "Mozilla/5.0",
      ...(options.headers || {}),
    },
  });

  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "application/json",
    body: await response.text(),
  };
}

module.exports = async function handler(req, res) {
  const source = req.query.source;
  const proxyPath = req.query.path || "";

  res.setHeader("access-control-allow-origin", "*");

  if (source === "alpha") {
    const endpoints = [
      {
        url: "https://www.binance.com/bapi/composite/v1/public/prism/token-list/query",
        options: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pageIndex: 1, pageSize: 200, type: "ALPHA" }),
        },
      },
      {
        url: "https://www.binance.com/bapi/composite/v1/public/alpha/token/list",
        options: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ page: 1, size: 200 }),
        },
      },
      {
        url: "https://www.binance.com/bapi/asset/v1/public/asset/asset/get-all-asset",
        options: {},
      },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetchJson(endpoint.url, endpoint.options);
        const raw = response.body;
        const list =
          raw?.data?.list ||
          raw?.data?.tokens ||
          raw?.data ||
          (Array.isArray(raw) ? raw : null);

        if (response.status === 200 && Array.isArray(list) && list.length > 0) {
          return res.status(200).json({ source: endpoint.url, tokens: list });
        }
      } catch (_) {}
    }

    return res.status(200).json({ source: null, tokens: [] });
  }

  const upstreamBaseBySource = {
    cg: "https://api.coingecko.com/api/v3",
    fapi: "https://fapi.binance.com/fapi/v1",
    spot24hr: "https://api.binance.com/api/v3/ticker/24hr",
  };

  const upstreamBase = upstreamBaseBySource[source];
  if (!upstreamBase) {
    return res.status(400).json({ error: "Unknown proxy source" });
  }

  // Set CDN cache headers — Vercel edge caches GETs based on s-maxage
  // CG: 5 min, fapi/spot: 30 sec
  const cacheTtl = source === "cg" ? 300 : 30;
  res.setHeader("cache-control", `s-maxage=${cacheTtl}, stale-while-revalidate=${cacheTtl * 2}`);

  try {
    const response = await fetchText(upstreamBase + proxyPath);
    res.setHeader("content-type", response.contentType);
    return res.status(response.status).send(response.body);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
