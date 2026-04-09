module.exports = async function handler(req, res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { token, chatId, text } = req.body || {};
  if (!token || !chatId || !text) {
    return res.status(400).json({ ok: false, error: "Missing token, chatId, or text" });
  }

  try {
    const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(tgUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const result = await response.json();
    return res.status(200).json({ ok: response.ok, result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
