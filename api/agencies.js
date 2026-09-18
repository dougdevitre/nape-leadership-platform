// GET /api/agencies — returns the NAPE partner directory (Resource Links + Sponsors),
// NAPE's own contact details (NAPE Org Info), and the editable Connections content
// (Category Profiles + Role Profiles) from Airtable. Read-only; no user input is forwarded.
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
// Multiline "one item per line" field -> array of trimmed, non-empty lines
const lines = (v, max) => text(v, 4000).split(/\r?\n/).map(l => l.replace(/^[•\-*]\s*/, "").trim()).filter(Boolean).slice(0, max);
const soft = (table) => (e) => { console.error(`${table} table unavailable:`, e.message); return []; };
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
    const [links, sponsors, orgInfo, catRows, roleRows] = await Promise.all([
      fetchAll(baseId, token, "Resource Links"),
      fetchAll(baseId, token, "Sponsors").catch(soft("Sponsors")),
      fetchAll(baseId, token, "NAPE Org Info").catch(soft("NAPE Org Info")),
      fetchAll(baseId, token, "Category Profiles").catch(soft("Category Profiles")),
      fetchAll(baseId, token, "Role Profiles").catch(soft("Role Profiles"))
    ]);

    // Editable Connections content. The page keeps built-in defaults for anything missing here.
    const categories = {};
    catRows.forEach(r => {
      const name = text(r.fields.Category, 80);
      if (!name) return;
      categories[name] = {
        offers: lines(r.fields["What They Offer"], 8),
        wants: lines(r.fields["What They Value"], 8),
        opener: text(r.fields.Opener, 400),
        ask: text(r.fields["First Ask"], 400),
        sharedGoal: text(r.fields["Shared Goals"], 300)
      };
    });
    const bySort = (a, b) => (a.sort - b.sort) || a.role.localeCompare(b.role);
    const roles = { mine: [], partner: [] };
    roleRows.forEach(r => {
      const role = text(r.fields.Role, 80);
      const kind = text(r.fields.Kind, 40);
      const sort = Number.isFinite(Number(r.fields["Sort Order"])) ? Number(r.fields["Sort Order"]) : 999;
      if (!role) return;
      if (kind === "Your role") roles.mine.push({ role, sort, offers: lines(r.fields["What You Can Offer"], 8) });
      else if (kind === "Partner role") roles.partner.push({ role, sort, opens: text(r.fields["Opens the Door To"], 400) });
    });
    roles.mine.sort(bySort); roles.partner.sort(bySort);
    roles.mine.forEach(r => delete r.sort); roles.partner.forEach(r => delete r.sort);
    const content = { categories, roles };

    // "NAPE Org Info" is a Field/Value list; pick out the contact details the page uses.
    const info = {};
    orgInfo.forEach(r => { const k = text(r.fields.Field, 80); if (k) info[k] = text(r.fields.Value, 500); });
    const nape = {
      name: info["Organization Name"] || "National Association of Probation Executives (NAPE)",
      contactName: info["Contact Name"] || "",
      contactEmail: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(info["Contact Email"] || "") ? info["Contact Email"] : "",
      contactPhone: info["Contact Phone"] || "",
      sourcePage: httpUrl(info["Source Page"])
    };

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
    res.status(200).json({ ok: true, source: "airtable", generatedAt: new Date().toISOString(), nape, content, agencies });
  } catch (e) {
    console.error("Directory fetch failed:", e);
    res.status(502).json({ ok: false, error: "Could not load the partner directory." });
  }
};
