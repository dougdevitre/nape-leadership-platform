// POST /api/connections — opt-in progress reports from the partner-connection tool.
// Upserts one row per campaign into the Airtable "Partner Connections" table so NAPE can
// see which partnerships are forming. Sent only when the member turns sharing on for a
// campaign; the client never sends the partner contact's name, drafts, or step notes,
// and this handler accepts only the fields below.
// Env vars (same as /api/interest): AIRTABLE_TOKEN, AIRTABLE_BASE_ID. 503 until set.

const RATE = { windowMs: 60_000, max: 12 };
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

const GOALS = { establish: "Establish", reconnect: "Reconnect", support: "Support" };
const STATUSES = ["Active", "Connected", "Paused", "Closed"];
const text = (v, max) => (v == null ? "" : String(v)).trim().slice(0, max);
const int = (v, max) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= max ? n : 0; };

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  const ip = (String(req.headers["x-forwarded-for"] || "").split(",")[0].trim())
    || (req.socket && req.socket.remoteAddress) || "unknown";
  if (rateLimited(ip)) {
    res.status(429).json({ ok: false, error: "Too many updates — please wait a minute and try again." });
    return;
  }
  try {
    const b = req.body || {};

    // Honeypot: real users never fill "website"
    if (b.website) {
      res.status(200).json({ ok: true });
      return;
    }
    if (b.consent !== true) {
      res.status(400).json({ ok: false, error: "Sharing requires your consent." });
      return;
    }
    const campaignId = text(b.campaignId, 40);
    const partner = text(b.partner, 200);
    const agency = text(b.agency, 200);
    if (!/^[a-z0-9]{6,40}$/i.test(campaignId) || !partner || !agency) {
      res.status(400).json({ ok: false, error: "Missing campaign details." });
      return;
    }
    const email = text(b.email, 200).toLowerCase();

    const token = process.env.AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    if (!token || !baseId) {
      res.status(503).json({ ok: false, error: "not_configured" });
      return;
    }

    const fields = {
      "Campaign ID": campaignId,
      "Member Name": text(b.name, 200) || null,
      "Member Email": /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null,
      "Member Role": text(b.role, 120) || null,
      "Member Agency": agency,
      "Partner Organization": partner,
      "Partner Category": text(b.partnerCategory, 120) || null,
      "Partner Record ID": /^rec[A-Za-z0-9]{14}$/.test(String(b.partnerId || "")) ? String(b.partnerId) : null,
      "Role Reached": text(b.partnerRole, 120) || null,
      "Goal": GOALS[String(b.goal || "")] || null,
      "Status": STATUSES.includes(b.status) ? b.status : "Active",
      "Steps Done": int(b.stepsDone, 50),
      "Total Steps": int(b.totalSteps, 50),
      "Last Step": text(b.lastStep, 200) || null,
      "Outcome Note": text(b.note, 2000) || null,
      "Started": /^\d{4}-\d{2}-\d{2}$/.test(String(b.startDate || "")) ? String(b.startDate) : null,
      "Last Updated": new Date().toISOString(),
      "Source": "nape-leadership-platform"
    };

    const send = (extra) => fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent("Partner Connections")}`, {
      method: extra.performUpsert ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...extra, records: [{ fields }], typecast: true })
    });

    let r = await send({ performUpsert: { fieldsToMergeOn: ["Campaign ID"] } });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("Airtable upsert failed, falling back to create:", r.status, detail);
      r = await send({});
    }
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("Airtable rejected connection update:", r.status, detail);
      res.status(502).json({ ok: false, error: "Could not send your update. Please try again." });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Connection update failed:", e);
    res.status(500).json({ ok: false, error: "Unexpected error. Please try again." });
  }
};
