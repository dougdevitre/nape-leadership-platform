// POST /api/interest — saves NAPE interest form submissions to Airtable.
// Requires env vars on the Vercel project:
//   AIRTABLE_TOKEN   - Airtable personal access token (scope: data.records:write on the base)
//   AIRTABLE_BASE_ID - appOA3q8s6pP2j54H
// No secrets in this file; nothing works until env vars are set in Vercel.

// Per-instance rate limiter. Serverless instances don't share memory, so this
// only slows a flood hitting one warm instance — a deterrent, not a guarantee.
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
    const { name, email, role, agency, website } = req.body || {};

    // Honeypot: real users never fill "website"
    if (website) {
      res.status(200).json({ ok: true });
      return;
    }
    if (!name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) {
      res.status(400).json({ ok: false, error: "Please provide your name and a valid email." });
      return;
    }

    const token = process.env.AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    if (!token || !baseId) {
      res.status(503).json({ ok: false, error: "not_configured" });
      return;
    }

    // Null (not undefined) for blanked fields so an upsert actually clears them.
    const fields = {
      Name: String(name).slice(0, 200),
      Email: String(email).trim().toLowerCase().slice(0, 200),
      Role: role ? String(role).slice(0, 200) : null,
      Agency: agency ? String(agency).slice(0, 200) : null,
      Source: "nape-leadership-platform",
      Submitted: new Date().toISOString()
    };
    const send = (extra) => fetch(`https://api.airtable.com/v0/${baseId}/Interest`, {
      method: extra.performUpsert ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ...extra, records: [{ fields }], typecast: true })
    });

    // Upsert on Email so resubmits (and "Update my info") update the existing
    // row instead of creating duplicates.
    let r = await send({ performUpsert: { fieldsToMergeOn: ["Email"] } });
    if (!r.ok) {
      // Upsert fails when Email already matches multiple rows (legacy
      // duplicates) — fall back to a plain create so no submission is lost.
      const detail = await r.text().catch(() => "");
      console.error("Airtable upsert failed, falling back to create:", r.status, detail);
      r = await send({});
    }

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("Airtable rejected interest submission:", r.status, detail);
      res.status(502).json({ ok: false, error: "Could not save your submission. Please try again." });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Interest submission failed:", e);
    res.status(500).json({ ok: false, error: "Unexpected error. Please try again." });
  }
};
