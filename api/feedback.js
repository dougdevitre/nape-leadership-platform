// POST /api/feedback — saves prototype feedback to the Airtable "Prototype Feedback" table.
// Uses the same env vars as /api/interest:
//   AIRTABLE_TOKEN   - Airtable personal access token (scope: data.records:write on the base)
//   AIRTABLE_BASE_ID - the base ID
// No secrets in this file; returns 503 until env vars are set in Vercel.

// Per-instance rate limiter (same tradeoff as /api/interest: a deterrent, not a guarantee).
const RATE = { windowMs: 60_000, max: 5 };
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 1000) {
    for (const [k, v] of hits) {
      if (!v.some(t => now - t < RATE.windowMs)) hits.delete(k);
    }
  }
  return recent.length > RATE.max;
}

// Must match the singleSelect choices in the Airtable table.
const PAGES = ["Home", "Journey", "Growth Plan", "Reflections", "Resources", "Connect", "General"];
const TYPES = ["Bug", "Content", "Design", "Idea", "Question"];

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  const ip = (String(req.headers["x-forwarded-for"] || "").split(",")[0].trim())
    || (req.socket && req.socket.remoteAddress) || "unknown";
  if (rateLimited(ip)) {
    res.status(429).json({ ok: false, error: "Too many submissions — please wait a minute and try again." });
    return;
  }
  try {
    const { text, page, type, from, website } = req.body || {};

    // Honeypot: real users never fill "website"
    if (website) {
      res.status(200).json({ ok: true });
      return;
    }
    const details = String(text || "").trim();
    if (!details) {
      res.status(400).json({ ok: false, error: "Please include your feedback." });
      return;
    }

    const token = process.env.AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    if (!token || !baseId) {
      res.status(503).json({ ok: false, error: "not_configured" });
      return;
    }

    const fields = {
      Summary: details.split("\n")[0].slice(0, 100),
      Details: details.slice(0, 5000),
      "Page / Feature": PAGES.includes(page) ? page : "General",
      Status: "New",
      Received: new Date().toISOString().slice(0, 10)
    };
    if (TYPES.includes(type)) fields.Type = type;
    if (from) fields.From = String(from).slice(0, 200);

    const r = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent("Prototype Feedback")}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ records: [{ fields }], typecast: true })
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("Airtable rejected feedback submission:", r.status, detail);
      res.status(502).json({ ok: false, error: "Could not save your feedback. Please try again." });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Feedback submission failed:", e);
    res.status(500).json({ ok: false, error: "Unexpected error. Please try again." });
  }
};
