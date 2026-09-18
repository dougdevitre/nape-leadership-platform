// POST /api/media — opt-in "I published this" notes from the Media page.
// Saves one row to the Airtable "Published Media" table (in the directory base) so NAPE
// can reshare member content from official channels. Sent only when the member uses the
// share panel; this handler accepts only the fields below.
// Env vars:
//   AIRTABLE_TOKEN             - Airtable personal access token (needs data.records:write on the directory base)
//   AIRTABLE_DIRECTORY_BASE_ID - base holding "Published Media" (defaults to appvCa1Ac6c200uyu)
// Returns 503 until the token is set.

const DEFAULT_DIRECTORY_BASE = "appvCa1Ac6c200uyu";

// Per-instance rate limiter (same tradeoff as /api/feedback: a deterrent, not a guarantee).
const RATE = { windowMs: 60_000, max: 6 };
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
const CHANNELS = ["Social post", "One-pager", "NotebookLM"];
const PLATFORMS = ["LinkedIn", "X", "Facebook", "Instagram", "Other"];
const GOALS = ["Start a partnership", "Support an active campaign", "Recognize a supporter", "Educate my community", "Invite peers into NAPE's network"];
const AUDIENCES = ["Peer executives", "County leadership & funders", "My staff", "The public"];

const text = (v, max) => (v == null ? "" : String(v)).trim().slice(0, max);
const httpUrl = (v) => (/^https?:\/\//i.test(String(v || "").trim()) ? String(v).trim().slice(0, 500) : "");

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
    const { resource, category, channel, platform, url, goal, audience, sharedGoal, name, agency, website } = req.body || {};

    // Honeypot: real users never fill "website"
    if (website) {
      res.status(200).json({ ok: true });
      return;
    }
    const resourceName = text(resource, 200);
    if (!resourceName || !CHANNELS.includes(channel)) {
      res.status(400).json({ ok: false, error: "Please include what you published." });
      return;
    }

    const token = process.env.AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_DIRECTORY_BASE_ID || DEFAULT_DIRECTORY_BASE;
    if (!token) {
      res.status(503).json({ ok: false, error: "not_configured" });
      return;
    }

    const fields = {
      Resource: resourceName,
      Channel: channel,
      Published: new Date().toISOString().slice(0, 10),
      Status: "New"
    };
    const cat = text(category, 80);
    if (cat) fields["Resource Category"] = cat;
    if (channel === "Social post" && PLATFORMS.includes(platform)) fields.Platform = platform;
    const postUrl = httpUrl(url);
    if (postUrl) fields["Post URL"] = postUrl;
    if (GOALS.includes(goal)) fields.Goal = goal;
    if (AUDIENCES.includes(audience)) fields.Audience = audience;
    const sg = text(sharedGoal, 300);
    if (sg) fields["Shared Goal"] = sg;
    const from = text(name, 120);
    if (from) fields["Member Name"] = from;
    const ag = text(agency, 200);
    if (ag) fields.Agency = ag;

    const r = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent("Published Media")}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ records: [{ fields }], typecast: true })
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("Airtable rejected published-media submission:", r.status, detail);
      res.status(502).json({ ok: false, error: "Could not send this to NAPE. Please try again." });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Published-media submission failed:", e);
    res.status(500).json({ ok: false, error: "Unexpected error. Please try again." });
  }
};
