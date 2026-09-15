// GET /api/agencies — returns the NAPE partner directory (Resource Links + Sponsors)
// from Airtable for the Connections page. Read-only; no user input is forwarded.
// Env vars on the Vercel project:
//   AIRTABLE_TOKEN             - Airtable personal access token (needs data.records:read on the directory base)
//   AIRTABLE_DIRECTORY_BASE_ID - base holding "Resource Links" and "Sponsors" (defaults to appvCa1Ac6c200uyu)
// Returns 503 until the token is set; the page then falls back to assets/agencies.json.

const DEFAULT_DIRECTORY_BASE = "appvCa1Ac6c200uyu";

async function fetchAll(baseId, token, table) {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      throw new Error(`Airtable ${table} ${r.status}: ${detail.slice(0, 300)}`);
    }
    const data = await r.json();
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return records;
}

const text = (v, max) => (v == null ? "" : String(v)).trim().slice(0, max);
const httpUrl = (v) => (/^https?:\/\//i.test(String(v || "").trim()) ? String(v).trim().slice(0, 500) : "");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_DIRECTORY_BASE_ID || DEFAULT_DIRECTORY_BASE;
  if (!token) {
    res.status(503).json({ ok: false, error: "not_configured" });
    return;
  }
  try {
    const [links, sponsors] = await Promise.all([
      fetchAll(baseId, token, "Resource Links"),
      fetchAll(baseId, token, "Sponsors").catch(e => { console.error("Sponsors table unavailable:", e.message); return []; })
    ]);

    const agencies = links.map(r => ({
      id: r.id,
      name: text(r.fields.Organization, 200),
      acronym: text(r.fields.Acronym, 40),
      category: text(r.fields.Category, 80) || "Other",
      description: text(r.fields.Description, 1000),
      url: httpUrl(r.fields["Homepage URL"]),
      notes: text(r.fields.Notes, 500)
    })).filter(a => a.name);

    const byName = new Map(agencies.map(a => [a.name.toLowerCase(), a]));
    sponsors.forEach(r => {
      const name = text(r.fields["Sponsor Name"], 200);
      if (!name) return;
      const tier = text(r.fields.Tier, 40);
      const existing = byName.get(name.toLowerCase());
      if (existing) { existing.sponsorTier = tier; return; }
      agencies.push({
        id: r.id,
        name,
        acronym: "",
        category: "NAPE Event Sponsor",
        description: text(r.fields.Notes, 500),
        url: httpUrl(r.fields.Website),
        notes: "",
        sponsorTier: tier
      });
    });

    agencies.sort((a, b) => a.name.localeCompare(b.name));
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");
    res.status(200).json({ ok: true, source: "airtable", generatedAt: new Date().toISOString(), agencies });
  } catch (e) {
    console.error("Directory fetch failed:", e);
    res.status(502).json({ ok: false, error: "Could not load the partner directory." });
  }
};
