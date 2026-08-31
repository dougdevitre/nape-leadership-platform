// POST /api/interest — saves NAPE interest form submissions to Airtable.
// Requires env vars on the Vercel project:
//   AIRTABLE_TOKEN   - Airtable personal access token (scope: data.records:write on the base)
//   AIRTABLE_BASE_ID - appOA3q8s6pP2j54H
// No secrets in this file; nothing works until env vars are set in Vercel.

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
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

    const r = await fetch(`https://api.airtable.com/v0/${baseId}/Interest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        records: [{
          fields: {
            Name: String(name).slice(0, 200),
            Email: String(email).slice(0, 200),
            Role: role ? String(role) : undefined,
            Agency: agency ? String(agency).slice(0, 200) : undefined,
            Source: "nape-leadership-platform",
            Submitted: new Date().toISOString()
          }
        }],
        typecast: true
      })
    });

    if (!r.ok) {
      res.status(502).json({ ok: false, error: "Could not save your submission. Please try again." });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Unexpected error. Please try again." });
  }
};
