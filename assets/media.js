/* NAPE Leadership Platform — Media Studio: NotebookLM prompts, social posts + images, PDF one-pagers.
   Directory comes from /api/agencies (Airtable) with assets/agencies.json as fallback.
   Everything generated here stays in this browser — nothing is uploaded. */
(function () {
  const SNAPSHOT_URL = "assets/agencies.json";
  const NAPE_FULL = "National Association of Probation Executives";
  const NAPE_SITE = "https://www.napehome.org";
  const RELATED_LINKS_URL = "https://www.napehome.org/related-links.html";
  const NOTEBOOKLM_URL = "https://notebooklm.google.com";
  const HASHTAGS = "#Probation #CommunityCorrections #LeadershipDevelopment #NAPE";

  /* The platform itself can be promoted alongside any directory listing. */
  const NAPE_SELF = {
    id: "__nape",
    name: "NAPE Executive Leadership Experience",
    acronym: "NAPE",
    category: "NAPE Program",
    description: "A board-approved executive leadership development experience for probation chiefs, deputy chiefs, and rising leaders, built around three stages: Lead Self, Lead Others, and Lead the Organization. Includes a growth plan, guided reflections, a partner-connection tool, and recognition.",
    url: NAPE_SITE,
    notes: "",
    sponsorTier: ""
  };
  const NAPE_SELF_PROFILE = {
    offers: [
      "A structured growth path for probation executives",
      "A peer network of chiefs, deputies, and rising leaders",
      "Practical tools: growth plans, reflections, and partner outreach"
    ],
    wants: [
      "Probation leaders ready to invest in their own development",
      "Agencies that want a leadership pipeline, not just a training day",
      "Feedback that shapes the program before launch"
    ],
    opener: "NAPE is building an executive leadership experience for the probation field",
    ask: "how the experience could serve leaders in your agency",
    sharedGoal: "strong leaders, stronger organizations, and stronger communities"
  };
  const DEFAULT_PROFILE = {
    offers: ["Expertise and resources in their area of focus", "A partner perspective on shared challenges", "Connections in their network"],
    wants: ["Practitioner insight from a working probation agency", "Honest feedback and real-world examples", "A reliable partner for shared goals"],
    opener: "our missions overlap and I'd like to understand how we could work together",
    ask: "what a useful partnership with a probation agency looks like from your side",
    sharedGoal: "safer, stronger communities through effective probation practice"
  };

  /* ---------- Purpose: goal + audience ---------- */
  const GOALS = {
    partner: { label: "Start a partnership" },
    campaign: { label: "Support an active campaign" },
    thanks: { label: "Recognize a supporter" },
    educate: { label: "Educate my community" },
    recruit: { label: "Invite peers into NAPE's network" }
  };
  const AUDIENCES = {
    peers: { label: "peer executives", lens: "what this means for the leaders running probation agencies" },
    funders: { label: "county leadership and funders", lens: "outcomes, accountability, and careful stewardship of public resources" },
    staff: { label: "agency staff", lens: "what this offers the people doing the work day to day" },
    public: { label: "the public", lens: "what this means for community safety and real second chances" }
  };

  /* Saved Connect campaigns for the selected partner (read-only peek at the Connect page's storage). */
  function campaignsFor(id) {
    const d = NAPE.get("nape_connections_v1", null);
    if (!d || !Array.isArray(d.campaigns)) return [];
    return d.campaigns.filter(x => x && x.partner && x.partner.id === id);
  }

  /* ---------- Directory ---------- */
  let DIRECTORY = [];
  let DIR_SOURCE = "";
  let NAPE_INFO = null;
  let CATEGORY_CONTENT = {};

  function normalizeAgency(a) {
    if (!a || typeof a !== "object" || !a.name) return null;
    return {
      id: String(a.id || a.name),
      name: String(a.name).slice(0, 200),
      acronym: String(a.acronym || "").slice(0, 40),
      category: String(a.category || "Other").slice(0, 80),
      description: String(a.description || "").slice(0, 1000),
      url: /^https?:\/\//i.test(String(a.url || "")) ? String(a.url).slice(0, 500) : "",
      notes: String(a.notes || "").slice(0, 500),
      sponsorTier: a.sponsorTier ? String(a.sponsorTier).slice(0, 40) : ""
    };
  }

  async function loadDirectory() {
    const tryFetch = async (url) => {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      if (!data || !Array.isArray(data.agencies)) throw new Error("bad payload");
      return data;
    };
    let data;
    try {
      data = await tryFetch("/api/agencies");
      DIR_SOURCE = "live";
    } catch (e) {
      try {
        data = await tryFetch(SNAPSHOT_URL);
        DIR_SOURCE = "snapshot";
      } catch (e2) {
        data = { agencies: [] };
        DIR_SOURCE = "none";
      }
    }
    DIRECTORY = data.agencies.map(normalizeAgency).filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
    const cats = data.content && data.content.categories;
    if (cats && typeof cats === "object") {
      Object.keys(cats).forEach(k => {
        const p = cats[k];
        if (!p || typeof p !== "object") return;
        CATEGORY_CONTENT[k] = {
          offers: Array.isArray(p.offers) && p.offers.length ? p.offers.map(String) : DEFAULT_PROFILE.offers,
          wants: Array.isArray(p.wants) && p.wants.length ? p.wants.map(String) : DEFAULT_PROFILE.wants,
          opener: p.opener ? String(p.opener) : DEFAULT_PROFILE.opener,
          ask: p.ask ? String(p.ask) : DEFAULT_PROFILE.ask,
          sharedGoal: p.sharedGoal ? String(p.sharedGoal).slice(0, 300) : DEFAULT_PROFILE.sharedGoal
        };
      });
    }
    const n = data.nape && typeof data.nape === "object" ? data.nape : {};
    NAPE_INFO = {
      name: String(n.name || NAPE_FULL).slice(0, 120),
      contactName: String(n.contactName || "").slice(0, 120),
      contactEmail: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(n.contactEmail || "")) ? String(n.contactEmail) : "",
      contactPhone: String(n.contactPhone || "").slice(0, 40)
    };
  }

  /* ---------- DOM helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const esc = napeEscape;

  function fillResourceSelect() {
    const sel = $("m-resource");
    const groups = {};
    DIRECTORY.forEach(a => (groups[a.category] = groups[a.category] || []).push(a));
    const cats = Object.keys(groups).sort((a, b) => {
      if (a === "NAPE Event Sponsor") return 1;
      if (b === "NAPE Event Sponsor") return -1;
      return a.localeCompare(b);
    });
    let html = `<option value="">Select what you want to promote…</option>`;
    html += `<optgroup label="NAPE"><option value="__nape">${esc(NAPE_SELF.name)}</option></optgroup>`;
    cats.forEach(cat => {
      html += `<optgroup label="${esc(cat)}">` + groups[cat].map(a =>
        `<option value="${esc(a.id)}">${esc(a.name)}${a.acronym ? " (" + esc(a.acronym) + ")" : ""}</option>`).join("") + `</optgroup>`;
    });
    sel.innerHTML = html;

    const note = $("m-dir-note");
    if (DIR_SOURCE === "live") note.textContent = "Directory loaded from NAPE's live partner list.";
    else if (DIR_SOURCE === "snapshot") note.textContent = "Live directory unavailable — using the built-in snapshot.";
    else note.textContent = "Couldn't load the partner directory. You can still promote the NAPE program itself.";
  }

  /* ---------- Context ---------- */
  function currentCtx() {
    const val = $("m-resource").value;
    if (!val) return null;
    const isNape = val === "__nape";
    const a = isNape ? NAPE_SELF : DIRECTORY.find(x => x.id === val);
    if (!a) return null;
    const profile = isNape ? NAPE_SELF_PROFILE : (CATEGORY_CONTENT[a.category] || DEFAULT_PROFILE);
    // First sentence, without splitting abbreviations like "U.S." mid-word.
    const firstSentence = (a.description.match(/^.{10,240}?(?<![A-Z])[.!?](?=\s|$)/) || [a.description.slice(0, 200)])[0].trim();
    return {
      isNape,
      id: a.id,
      name: a.name,
      short: a.acronym || a.name,
      acronym: a.acronym,
      category: a.category,
      description: a.description,
      tagline: firstSentence,
      url: a.url,
      sponsorTier: a.sponsorTier,
      offers: profile.offers,
      wants: profile.wants,
      opener: profile.opener,
      ask: profile.ask,
      goal: GOALS[$("m-goal").value] ? $("m-goal").value : "partner",
      audience: AUDIENCES[$("m-audience").value] ? $("m-audience").value : "peers",
      sharedGoal: $("m-shared-goal").value.trim().slice(0, 160) || profile.sharedGoal || "",
      campaigns: isNape ? [] : campaignsFor(a.id),
      you: $("m-your-name").value.trim(),
      agency: $("m-your-agency").value.trim()
    };
  }

  function renderPreview(c) {
    const box = $("m-preview");
    if (!c) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `
      <h3>${esc(c.name)}${c.acronym ? ` <span class="acr">(${esc(c.acronym)})</span>` : ""}</h3>
      <p class="m-preview-meta"><span class="stage-chip chip-others">${esc(c.category)}</span>${c.sponsorTier ? ` <span class="stage-chip chip-org">${esc(c.sponsorTier)} sponsor</span>` : ""}</p>
      <p>${esc(c.description)}</p>
      ${c.url ? `<p class="m-preview-meta"><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.url)}</a></p>` : ""}`;
  }

  /* ---------- Copy ---------- */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      napeToast("Copied to clipboard.");
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.append(ta);
      ta.select();
      try { document.execCommand("copy"); napeToast("Copied to clipboard."); }
      catch (e2) { napeToast("Couldn't copy — select the text manually."); }
      ta.remove();
    }
  }

  function copyWithState(btn, text) {
    copyText(text);
    if (!btn._label) btn._label = btn.textContent;
    btn.textContent = "✓ Copied";
    btn.classList.add("copied");
    clearTimeout(btn._h);
    btn._h = setTimeout(() => { btn.textContent = btn._label; btn.classList.remove("copied"); }, 1600);
  }

  function genCard(label, why, text, opts = {}) {
    const div = document.createElement("div");
    div.className = "gen-card";
    div.innerHTML = `
      <div class="gen-head">
        <div class="gen-title-row">
          ${opts.num ? `<span class="gen-num" aria-hidden="true">${opts.num}</span>` : ""}
          <div><p class="gen-label">${esc(label)}</p>${why ? `<p class="gen-why">${esc(why)}</p>` : ""}</div>
        </div>
        <button class="btn btn-outline btn-small" type="button">Copy</button>
      </div>
      <pre class="gen-text"></pre>
      ${opts.extra ? `<p class="gen-extra">${opts.extra}</p>` : ""}`;
    div.querySelector(".gen-text").textContent = text;
    const btn = div.querySelector("button");
    btn.addEventListener("click", () => copyWithState(btn, text));
    return div;
  }

  /* Editable draft card (social posts): a textarea with a live character count. */
  function postCard(label, text, limit) {
    const div = document.createElement("div");
    div.className = "gen-card";
    div.innerHTML = `
      <div class="gen-head">
        <div class="gen-title-row"><div><p class="gen-label">${esc(label)}</p></div></div>
        <button class="btn btn-outline btn-small" type="button">Copy</button>
      </div>
      <textarea class="gen-edit" rows="5" aria-label="${esc(label)} — editable draft"></textarea>
      <p class="gen-extra"><span class="gen-count"></span></p>`;
    const ta = div.querySelector("textarea");
    ta.value = text;
    const count = div.querySelector(".gen-count");
    const update = () => {
      const n = ta.value.length;
      count.textContent = limit
        ? `${n.toLocaleString()} / ${limit.toLocaleString()} characters${n > limit ? " — over the limit" : ""}`
        : `${n.toLocaleString()} characters`;
      count.classList.toggle("sm-over", !!limit && n > limit);
      ta.style.height = "auto";
      ta.style.height = (ta.scrollHeight + 2) + "px";
    };
    ta.addEventListener("input", update);
    const btn = div.querySelector("button");
    btn.addEventListener("click", () => copyWithState(btn, ta.value));
    div._autosize = update; // call once the card is in the DOM
    return div;
  }

  /* ---------- Tool 1: NotebookLM prompts ---------- */
  let NB_TEXTS = [];

  function buildNotebookPrompts(c) {
    const wrap = $("nb-cards");
    wrap.innerHTML = "";
    NB_TEXTS = [];
    let step = 0;
    const add = (label, why, text) => {
      NB_TEXTS.push(`── ${label} ──\n\n${text}`);
      wrap.append(genCard(label, why, text, { num: ++step }));
    };
    $("nb-copy-all").hidden = false;
    const napeLine = c.isNape
      ? `${NAPE_FULL} (NAPE) is developing this experience for the probation field.`
      : `${c.name} is listed in the partner directory of the ${NAPE_FULL} (NAPE). Listings are not endorsements by NAPE.`;
    const aud = AUDIENCES[c.audience];
    const sgBit = c.sharedGoal ? ` Frame everything around the shared goal of ${c.sharedGoal}.` : "";
    const audBit = ` The audience is ${aud.label} — emphasize ${aud.lens}.`;

    const sources = [
      c.url ? `1. ${c.url} — the organization's own website` : `1. Search the web for ${c.name}'s official website and add it`,
      `2. ${RELATED_LINKS_URL} — NAPE's partner directory (context on the wider network)`,
      `3. ${NAPE_SITE} — about NAPE and its mission`,
      `4. Paste this text as a source:\n"${c.name}${c.acronym ? ` (${c.acronym})` : ""} — ${c.description} ${napeLine}"`
    ].join("\n");
    add(
      "Sources to add to your notebook",
      "In NotebookLM, create a new notebook and add these sources before running any prompt.",
      sources
    );

    add(
      "Audio Overview prompt",
      "Paste into the Audio Overview customization box for a podcast-style briefing.",
      c.isNape
        ? `Focus the conversation on the NAPE Executive Leadership Experience: who it serves (probation chiefs, deputy chiefs, and rising leaders), the three stages — Lead Self, Lead Others, and Lead the Organization — and why leadership development matters in community corrections.${sgBit}${audBit} Explain how a listener can express interest. Keep the tone calm, professional, and practical — no hype. Note that program details are subject to Board approval.`
        : `Focus the conversation on ${c.name}${c.acronym ? ` (${c.acronym})` : ""} and what it offers probation and community-corrections leaders. Cover: what the organization does, why it matters to a probation agency (for example: ${c.offers.slice(0, 2).join("; ").toLowerCase()}), and how a leader connected through the ${NAPE_FULL} (NAPE) could take a sensible first step — such as ${c.ask}.${sgBit}${audBit} Keep the tone calm, professional, and practical. Stick to what the sources support, and note that directory listings are not endorsements by NAPE.`
    );

    add(
      "Briefing document prompt",
      "For the notebook chat — produces a prep document you can bring to a meeting.",
      c.isNape
        ? `Using only the sources in this notebook, write a one-page briefing for a probation executive who is deciding whether to join the NAPE Executive Leadership Experience. Include: (1) what the experience is and who it is for, (2) the three stages and what each develops, (3) what participation would ask of them, and (4) three questions they should ask NAPE before committing. Use plain, professional language and label anything uncertain as "to be confirmed."`
        : `Using only the sources in this notebook, write a one-page briefing for a probation chief preparing for a first conversation with ${c.short}. Include: (1) what ${c.short} does, in two sentences; (2) what it can offer a probation agency (for example: ${c.offers.slice(0, 3).join("; ").toLowerCase()}); (3) what organizations like it tend to value from agencies (for example: ${c.wants.slice(0, 2).join("; ").toLowerCase()}); (4) where the two sides' goals align${c.sharedGoal ? ` — likely around ${c.sharedGoal}` : ""}; and (5) three specific questions the chief should ask. Use plain, professional language and flag anything the sources don't support.`
    );

    add(
      "FAQ prompt",
      "Turns the sources into a shareable Q&A for your leadership team.",
      c.isNape
        ? `Create an FAQ (6–8 questions) about the NAPE Executive Leadership Experience for probation professionals who have just heard about it. Answer only from the sources. Include questions about who it's for, what the three stages cover, what it costs or requires (say "not yet announced" if the sources don't say), and how to stay informed.`
        : `Create an FAQ (6–8 questions) about ${c.name} for probation professionals who have never worked with it. Answer only from the sources. Include: what it is, who it serves, how a probation agency typically engages with it, and where to learn more. If a question can't be answered from the sources, say so rather than guessing.`
    );

    add(
      "Social content prompt",
      "Asks NotebookLM for source-grounded post drafts you can compare with the Social tab here.",
      `Draft three short social media posts a probation leader could share about ${c.isNape ? "the NAPE Executive Leadership Experience" : `${c.name} and the value it offers the probation field`}: one for LinkedIn (professional, 3–5 sentences), one under 280 characters for X, and one for Facebook (warm, 2–3 sentences). The purpose of the posts is: ${GOALS[c.goal].label.toLowerCase()}. Write for ${aud.label}.${c.sharedGoal ? ` Anchor each post in the shared goal of ${c.sharedGoal}.` : ""} Ground every claim in the sources, avoid hype, and do not imply endorsement by any organization. Mention the ${NAPE_FULL} (NAPE) as the community connecting probation executives.`
    );
  }

  /* ---------- Tool 2: Social posts ---------- */
  const PLATFORMS = { linkedin: "LinkedIn", x: "X", facebook: "Facebook", instagram: "Instagram" };
  const PLATFORM_LIMITS = { linkedin: 3000, x: 280, facebook: 0, instagram: 2200 };
  const ANGLES = {
    spotlight: "Partner spotlight",
    resource: "Share a practical resource",
    thanks: "Thank a supporter",
    connect: "Invite peers to connect"
  };

  function fitX(s) {
    if (s.length <= 280) return s;
    return s.slice(0, 277).replace(/\s+\S*$/, "") + "…";
  }

  function socialPosts(c, platform) {
    const link = c.url || RELATED_LINKS_URL;
    const dirLine = c.isNape
      ? `Learn more and follow along: ${NAPE_SITE}`
      : `Found in NAPE's partner directory: ${RELATED_LINKS_URL}`;
    const offer1 = (c.offers[0] || "").toLowerCase();
    const offer2 = (c.offers[1] || c.offers[0] || "").toLowerCase();
    const aud = AUDIENCES[c.audience];
    const sg = c.sharedGoal;
    const sgLine = sg ? `Our shared goal: ${sg}.` : "";
    const nameAcr = `${c.name}${c.acronym ? ` (${c.acronym})` : ""}`;
    const agency = c.agency || "our agency";
    const posts = [];

    if (c.isNape) {
      const base = {
        partner: [
          `Probation leadership is a discipline of its own — and it deserves its own development path.\n\nThe ${NAPE_FULL} (NAPE) is building the Executive Leadership Experience around three stages: Lead Self, Lead Others, Lead the Organization. ${sgLine}\n\nIf you lead (or are preparing to lead) a probation agency, this is being built for you. ${dirLine}\n\n${HASHTAGS}`,
          `What got you promoted won't be what makes you effective as a chief.\n\nNAPE's Executive Leadership Experience is in development to help probation executives make that shift — deliberately, with peers, over time. ${sgLine}\n\n${dirLine}\n\n${HASHTAGS}`
        ],
        campaign: [
          `${agency.charAt(0).toUpperCase() + agency.slice(1)} is investing in its leadership bench — and NAPE's Executive Leadership Experience is part of that plan.\n\n${sgLine} For ${aud.label}, this is ${aud.lens}.\n\n${dirLine}\n\n${HASHTAGS}`,
          `Leadership development is a commitment, not an event.\n\nWe're following NAPE's Executive Leadership Experience as it takes shape, because ${sg || "our field needs prepared leaders"}. More as it develops.\n\n${dirLine}\n\n${HASHTAGS}`
        ],
        thanks: [
          `Grateful for the community behind the ${NAPE_FULL} — the members, partners, and sponsors making an executive leadership experience for probation possible. ${sgLine}\n\n${dirLine}\n\n${HASHTAGS}`,
          `To the probation executives shaping NAPE's Executive Leadership Experience with candid feedback: thank you. This is how a field builds something that lasts.\n\n${dirLine}\n\n${HASHTAGS}`
        ],
        educate: [
          `A resource in progress for the probation field: NAPE's Executive Leadership Experience — a structured path for chiefs, deputies, and rising leaders.\n\n${sgLine} For ${aud.label}, this is ${aud.lens}.\n\n${dirLine}\n\n${HASHTAGS}`,
          `Leadership development shouldn't stop when you reach the chief's office — that's where it matters most.\n\nNAPE's Executive Leadership Experience is being built for exactly that moment: growth plans, guided reflection, and a peer network that understands the job.\n\n${dirLine}\n\n${HASHTAGS}`
        ],
        recruit: [
          `Probation executives: who is in your corner as you grow into bigger leadership?\n\nNAPE is building an Executive Leadership Experience so no chief has to figure it out alone. ${sgLine} Join the interest list and help shape it.\n\n${dirLine}\n\n${HASHTAGS}`,
          `If you lead a probation agency, your own growth can't be an afterthought.\n\nNAPE is building a peer experience for exactly that. Join the interest list — and bring a colleague who's ready for more.\n\n${dirLine}\n\n${HASHTAGS}`
        ]
      };
      (base[c.goal] || base.partner).forEach(p => posts.push(p));
    } else {
      const sponsorBit = c.sponsorTier ? ` and a ${c.sponsorTier.toLowerCase()} sponsor of NAPE events` : "";
      const base = {
        partner: [
          `Partner spotlight: ${nameAcr}.\n\n${c.tagline}\n\n${sgLine} For ${aud.label}, that means ${offer1}${offer2 && offer2 !== offer1 ? ` and ${offer2}` : ""}.\n\n${link}\n${dirLine}\n\n${HASHTAGS}`,
          `Partnerships don't start at conferences — they start with one intentional note.\n\nThis week ours goes to ${nameAcr}${sg ? `, because we're working toward the same thing: ${sg}` : ""}. A first conversation could open the door to ${offer1}.\n\n${dirLine}\n\n${HASHTAGS}`
        ],
        campaign: [
          `${agency.charAt(0).toUpperCase() + agency.slice(1)} is building a working relationship with ${nameAcr}${sg ? ` — because we share a goal: ${sg}` : ""}.\n\n${c.tagline}\n\nMore to come as this partnership takes shape.\n\n${link}\n\n${HASHTAGS}`,
          `Good partnerships are built deliberately, one conversation at a time.\n\nWe're deepening ours with ${c.short}${sg ? `, around a goal we share: ${sg}` : ""}. First on the agenda: ${c.ask}.\n\n${link}\n\n${HASHTAGS}`
        ],
        thanks: [
          `Appreciation post: ${nameAcr} — a partner to the probation field${sponsorBit}.\n\n${sgLine} Organizations like this strengthen the work our agencies do every day.\n\n${link}\n\n${HASHTAGS}`,
          `Partnerships make this field stronger. ${nameAcr} supports the probation community${sponsorBit} — thank you for investing in the people who do this work${sg ? ` and in ${sg}` : ""}.\n\n${link}\n\n${HASHTAGS}`
        ],
        educate: [
          `For ${aud.label}: ${nameAcr} is worth knowing.\n\n${c.tagline}\n\n${sgLine} A good starting point if your community could use ${offer1}.\n\n${link}\n${dirLine}\n\n${HASHTAGS}`,
          `What's one organization more people should know about? Here's mine this week: ${nameAcr}.\n\n${c.tagline}\n\nWorth ten minutes if you care about ${sg || offer1}.\n\n${link}\n${dirLine}\n\n${HASHTAGS}`
        ],
        recruit: [
          `I found ${nameAcr} through NAPE's partner directory — one of many reasons the ${NAPE_FULL} is worth your time if you lead in probation.\n\n${sgLine}\n\n${dirLine}\n\n${HASHTAGS}`,
          `Probation executives: your next partner may already be one directory away.\n\nNAPE connects agencies with organizations like ${c.short}${sg ? `, all working toward ${sg}` : ""}. Start with the related-links page.\n\n${dirLine}\n\n${HASHTAGS}`
        ]
      };
      (base[c.goal] || base.partner).forEach(p => posts.push(p));
    }

    return posts.map(p => p.replace(/[ \t]+\n/g, "\n").replace(/ {2,}/g, " ").replace(/\n{3,}/g, "\n\n")).map(p => {
      if (platform === "x") {
        const compact = p.split("\n\n").slice(0, 2).join(" ").replace(/\n/g, " ");
        return fitX(`${compact} ${link} ${c.isNape ? "#Probation #Leadership" : "#Probation #CommunityCorrections"}`);
      }
      if (platform === "facebook") return p.replace(HASHTAGS, "").trim();
      if (platform === "instagram") return p + "\n\n(Link in bio or comments — Instagram doesn't link captions.)";
      return p; // linkedin
    });
  }

  function renderPosts() {
    const c = currentCtx();
    const wrap = $("sm-posts");
    wrap.innerHTML = "";
    if (!c) { wrap.innerHTML = `<p class="empty-note">Choose what to promote at the top of the page first.</p>`; return; }
    const platform = document.querySelector("#sm-platforms .chip.active").dataset.platform;
    socialPosts(c, platform).forEach((p, i) => {
      const card = postCard(`${PLATFORMS[platform]} draft ${i + 1}`, p, PLATFORM_LIMITS[platform]);
      wrap.append(card);
      card._autosize();
    });
  }

  /* ---------- Tool 2b: Social image ---------- */
  const IMG_SIZES = {
    square: { w: 1080, h: 1080, label: "Square 1080×1080 (LinkedIn, Instagram, Facebook)" },
    landscape: { w: 1200, h: 627, label: "Landscape 1200×627 (LinkedIn, X link cards)" },
    story: { w: 1080, h: 1920, label: "Story 1080×1920 (Instagram/Facebook stories)" }
  };
  const IMG_THEMES = {
    navy: { bg: "#1E2E4F", orb: "#16233D", kicker: "#C9962E", rule: "#C9962E", head: "#FBF9F4", chipBg: "#2E7D6E", chipText: "#FBF9F4", tag: "#CBD4E4", footTitle: "#FBF9F4", footSub: "#8FA0C4", markBg: "#C9962E", markText: "#16233D", dash: "#3D507A" },
    teal: { bg: "#2E7D6E", orb: "#27695D", kicker: "#F7EDD8", rule: "#C9962E", head: "#FBF9F4", chipBg: "#1E2E4F", chipText: "#FBF9F4", tag: "#DCEDE9", footTitle: "#FBF9F4", footSub: "#BFDCD5", markBg: "#C9962E", markText: "#16233D", dash: "#4E9587" },
    paper: { bg: "#FBF9F4", orb: "#F1EBDC", kicker: "#9A701C", rule: "#C9962E", head: "#1E2E4F", chipBg: "#2E7D6E", chipText: "#FBF9F4", tag: "#5A6675", footTitle: "#1E2E4F", footSub: "#5A6675", markBg: "#1E2E4F", markText: "#C9962E", dash: "#D8D2C4" }
  };

  function wrapLines(g, text, maxWidth) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach(w => {
      const t = line ? line + " " + w : w;
      if (g.measureText(t).width > maxWidth && line) { lines.push(line); line = w; }
      else line = t;
    });
    if (line) lines.push(line);
    return lines;
  }

  async function renderImage() {
    const c = currentCtx();
    const canvas = $("sm-canvas");
    const note = $("sm-img-note");
    if (!c) { note.textContent = "Choose what to promote at the top of the page first."; return; }
    note.textContent = "";

    const size = IMG_SIZES[$("sm-size").value] || IMG_SIZES.square;
    canvas.width = size.w;
    canvas.height = size.h;
    const g = canvas.getContext("2d");
    const W = size.w, H = size.h;
    const u = W / 1080; // scale unit
    const tall = H / W > 1.2;

    try {
      await Promise.all([
        document.fonts.load(`700 ${Math.round(72 * u)}px Fraunces`),
        document.fonts.load(`600 ${Math.round(30 * u)}px "Public Sans"`),
        document.fonts.load(`400 ${Math.round(30 * u)}px "Public Sans"`)
      ]);
    } catch (e) { /* fall back to system fonts */ }

    const T = IMG_THEMES[$("sm-theme").value] || IMG_THEMES.navy;

    // Background with a soft corner orb
    g.fillStyle = T.bg;
    g.fillRect(0, 0, W, H);
    g.fillStyle = T.orb;
    g.beginPath();
    g.arc(W * 0.94, H * 0.04, W * 0.40, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(W * 0.02, H * 1.02, W * 0.22, 0, Math.PI * 2);
    g.fill();

    const pad = 84 * u;
    let y = tall ? H * 0.2 : pad + 40 * u;

    // Kicker, letterspaced
    const kicker = c.isNape ? "NAPE EXECUTIVE LEADERSHIP" : (c.sponsorTier ? "SPONSOR SPOTLIGHT" : "PARTNER SPOTLIGHT");
    g.fillStyle = T.kicker;
    g.font = `700 ${Math.round(30 * u)}px "Public Sans", sans-serif`;
    g.textBaseline = "alphabetic";
    if ("letterSpacing" in g) {
      g.letterSpacing = `${Math.round(6 * u)}px`;
      g.fillText(kicker, pad, y);
      g.letterSpacing = "0px";
    } else {
      let kx = pad;
      kicker.split("").forEach(ch => { g.fillText(ch, kx, y); kx += g.measureText(ch).width + 6 * u; });
    }
    y += 26 * u;
    g.fillStyle = T.rule;
    g.fillRect(pad, y, 120 * u, 6 * u);
    y += 90 * u;

    // Headline, auto-shrunk to fit
    const headline = ($("sm-headline").value.trim() || c.name).slice(0, 120);
    g.fillStyle = T.head;
    let fSize = 84 * u;
    g.font = `700 ${Math.round(fSize)}px Fraunces, Georgia, serif`;
    let lines = wrapLines(g, headline, W - pad * 2);
    const maxLines = tall ? 6 : (H < W ? 3 : 4);
    while (lines.length > maxLines && fSize > 40 * u) {
      fSize -= 8 * u;
      g.font = `700 ${Math.round(fSize)}px Fraunces, Georgia, serif`;
      lines = wrapLines(g, headline, W - pad * 2);
    }
    lines.slice(0, maxLines).forEach(l => { g.fillText(l, pad, y); y += fSize * 1.18; });
    y += 8 * u;

    // Category / acronym chip
    g.font = `600 ${Math.round(28 * u)}px "Public Sans", sans-serif`;
    const chipText = c.isNape ? "Lead Self · Lead Others · Lead the Organization"
      : `${c.category}${c.acronym ? ` · ${c.acronym}` : ""}${c.sponsorTier ? ` · ${c.sponsorTier} sponsor` : ""}`;
    g.fillStyle = T.chipBg;
    const chipW = g.measureText(chipText).width + 48 * u;
    const chipH = 56 * u;
    g.beginPath();
    if (g.roundRect) g.roundRect(pad, y - chipH * 0.7, Math.min(chipW, W - pad * 2), chipH, chipH / 2);
    else g.rect(pad, y - chipH * 0.7, Math.min(chipW, W - pad * 2), chipH);
    g.fill();
    g.fillStyle = T.chipText;
    g.fillText(chipText, pad + 24 * u, y + 10 * u - chipH * 0.2);
    y += chipH + 44 * u;

    // Tagline — lead with the shared goal when one is set
    g.fillStyle = T.tag;
    g.font = `400 ${Math.round(32 * u)}px "Public Sans", sans-serif`;
    const tagText = c.sharedGoal ? `A shared goal: ${c.sharedGoal}.` : c.tagline;
    const tagLines = wrapLines(g, tagText, W - pad * 2).slice(0, tall ? 5 : 3);
    tagLines.forEach(l => { g.fillText(l, pad, y); y += 46 * u; });

    // Dashed rule above the footer — echoes the site's journey-road motif
    const fy = H - pad;
    g.strokeStyle = T.dash;
    g.lineWidth = 3 * u;
    g.setLineDash([16 * u, 12 * u]);
    g.beginPath();
    g.moveTo(pad, fy - 76 * u);
    g.lineTo(W - pad, fy - 76 * u);
    g.stroke();
    g.setLineDash([]);

    // Footer brandmark
    g.fillStyle = T.markBg;
    g.beginPath();
    g.arc(pad + 26 * u, fy - 12 * u, 26 * u, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = T.markText;
    g.font = `700 ${Math.round(26 * u)}px "Public Sans", sans-serif`;
    g.textAlign = "center";
    g.fillText("N", pad + 26 * u, fy - 3 * u);
    g.textAlign = "left";
    g.fillStyle = T.footTitle;
    g.font = `600 ${Math.round(26 * u)}px "Public Sans", sans-serif`;
    g.fillText(NAPE_FULL, pad + 66 * u, fy - 18 * u);
    g.fillStyle = T.footSub;
    g.font = `400 ${Math.round(24 * u)}px "Public Sans", sans-serif`;
    g.fillText("napehome.org", pad + 66 * u, fy + 14 * u);

    $("sm-download").disabled = false;
    $("sm-copy-img").disabled = false;
  }

  function downloadImage() {
    const c = currentCtx();
    const canvas = $("sm-canvas");
    const slug = (c ? c.short : "nape").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    canvas.toBlob(blob => {
      if (!blob) { napeToast("Couldn't create the image."); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `nape-${slug}-${$("sm-size").value}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      napeToast("Image downloaded.");
    }, "image/png");
  }

  function copyImage() {
    $("sm-canvas").toBlob(async blob => {
      if (!blob) { napeToast("Couldn't create the image."); return; }
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        napeToast("Image copied — paste it into your post.");
      } catch (e) {
        napeToast("Copying images isn't supported here — use Download PNG instead.");
      }
    }, "image/png");
  }

  /* ---------- Tool 3: PDF one-pager ---------- */
  function renderPdf() {
    const c = currentCtx();
    const doc = $("pdf-doc");
    if (!c) {
      doc.innerHTML = `<p class="empty-note" style="border:none">Choose what to promote at the top of the page, and this one-pager will build itself.</p>`;
      return;
    }
    const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    const prepared = [c.you, c.agency].filter(Boolean).join(", ");
    const contact = NAPE_INFO || {};
    const contactBits = [contact.contactName, contact.contactEmail, contact.contactPhone].filter(Boolean);
    const audLabel = AUDIENCES[c.audience].label;
    const sharedLine = c.sharedGoal
      ? `<p class="pdf-shared">Working toward <strong>${esc(c.sharedGoal)}</strong> — together.</p>` : "";

    if (c.isNape) {
      const stages = (typeof NAPE_STAGES === "object" && NAPE_STAGES) ? NAPE_STAGES : null;
      doc.innerHTML = `
        <div class="report-head">
          <span class="mark">N</span>
          <div style="flex:1">
            <h1>NAPE Executive Leadership Experience</h1>
            <p>${esc(NAPE_FULL)} · ${esc(today)} · Prepared for ${esc(audLabel)}</p>
          </div>
        </div>
        ${sharedLine}
        <div class="report-sec">
          <h2>Why this exists</h2>
          <p class="pdf-p">${esc(c.description)}</p>
        </div>
        ${stages ? `<div class="report-sec"><h2>Three stages of growth</h2>${Object.keys(stages).map(k => `
          <div class="rgoal">
            <h3>${esc(stages[k].name)} — <em class="pdf-tag">${esc(stages[k].tag)}</em></h3>
            <ul>${stages[k].skillsets.map(s => `<li><span class="st st-a">✓</span> ${esc(s)}</li>`).join("")}</ul>
          </div>`).join("")}</div>` : ""}
        <div class="report-sec">
          <h2>What participants get</h2>
          <ul class="pdf-list">${NAPE_SELF_PROFILE.offers.map(o => `<li>${esc(o)}</li>`).join("")}</ul>
        </div>
        <div class="report-sec">
          <h2>Get involved</h2>
          <div class="reflect"><strong>Next step</strong>Join the interest list on the platform's Connect page to hear first when the experience launches${contactBits.length ? `, or contact ${esc(contactBits.join(" · "))}.` : "."}</div>
        </div>
        <p class="pdf-tagline">Strong leaders. Stronger organizations. Stronger communities.</p>
        ${prepared ? `<p class="report-footnote" style="text-align:left">Prepared by ${esc(prepared)}.</p>` : ""}
        <p class="report-footnote">Prototype preview — program details are subject to change and NAPE Board approval. ${esc(NAPE_SITE)}</p>`;
      return;
    }

    doc.innerHTML = `
      <div class="report-head">
        <span class="mark">N</span>
        <div style="flex:1">
          <h1>Partner Resource Spotlight</h1>
          <p>${esc(NAPE_FULL)} · ${esc(today)} · Prepared for ${esc(audLabel)}</p>
        </div>
      </div>
      <h2 class="pdf-name">${esc(c.name)}${c.acronym ? ` <span class="acr">(${esc(c.acronym)})</span>` : ""}</h2>
      <p class="pdf-chips"><span class="stage-chip chip-others">${esc(c.category)}</span>${c.sponsorTier ? ` <span class="stage-chip chip-org">${esc(c.sponsorTier)} sponsor of NAPE events</span>` : ""}${c.url ? ` <span class="pdf-url">${esc(c.url)}</span>` : ""}</p>
      ${sharedLine}
      <div class="report-sec">
        <h2>About</h2>
        <p class="pdf-p">${esc(c.description)}</p>
      </div>
      <div class="report-sec pdf-cols">
        <div>
          <h2>What they offer probation leaders</h2>
          <ul class="pdf-list">${c.offers.map(o => `<li>${esc(o)}</li>`).join("")}</ul>
        </div>
        <div>
          <h2>What they value from agencies</h2>
          <ul class="pdf-list">${c.wants.map(w => `<li>${esc(w)}</li>`).join("")}</ul>
        </div>
      </div>
      <div class="report-sec">
        <h2>A sensible first step</h2>
        <div class="reflect"><strong>Suggested opener</strong>“I'm reaching out because ${esc(c.opener)}.” Then make one small ask: “I'd value a short conversation about ${esc(c.ask)}.”${c.goal === "campaign" && c.campaigns.length ? ` <em class="pdf-camp-note">This spotlight supports your active outreach campaign with ${esc(c.short)} — see the Connect page for the full sequence.</em>` : ""}</div>
      </div>
      <div class="report-sec">
        <h2>Connect through NAPE</h2>
        <p class="pdf-p">${esc(c.name)} appears in NAPE's partner directory (${esc(RELATED_LINKS_URL)}). NAPE members can often get a warm introduction${contactBits.length ? ` — contact ${esc(contactBits.join(" · "))}.` : "."}</p>
      </div>
      <p class="pdf-tagline">Strong leaders. Stronger organizations. Stronger communities.</p>
      ${prepared ? `<p class="report-footnote" style="text-align:left">Prepared by ${esc(prepared)}.</p>` : ""}
      <p class="report-footnote">Listing sourced from NAPE's related-links directory. Inclusion is not an endorsement by NAPE. Generated on this device by the NAPE leadership platform prototype.</p>`;
  }

  /* ---------- Media kit checklist ---------- */
  const KIT_KEY = "nape_media_kits_v1";
  const KIT_ITEMS = [
    { k: "notebook", label: "NotebookLM notebook created", sub: "Sources added, prompts run" },
    { k: "social", label: "Social post published", sub: "Post and image shared from your account" },
    { k: "pdf", label: "One-pager shared", sub: "Saved as PDF, sent or handed out" }
  ];

  function kitProgress(id) {
    const all = NAPE.get(KIT_KEY, {});
    const st = (all && typeof all === "object" && all[id]) || {};
    const done = KIT_ITEMS.filter(i => st[i.k]).length;
    $("m-kit-progress").textContent = done ? `${done} of ${KIT_ITEMS.length} published` : "";
    return st;
  }

  function renderKit(c) {
    const kit = $("m-kit");
    if (!c) { kit.hidden = true; return; }
    kit.hidden = false;
    const st = kitProgress(c.id);
    const wrap = $("m-kit-items");
    wrap.innerHTML = "";
    KIT_ITEMS.forEach(item => {
      const row = document.createElement("div");
      row.className = "m-kit-item" + (st[item.k] ? " done" : "");
      row.innerHTML = `
        <label>
          <input type="checkbox"${st[item.k] ? " checked" : ""}>
          <span><strong>${esc(item.label)}</strong><span class="m-kit-note">${esc(item.sub)}</span></span>
        </label>
        <button class="link-btn" type="button">Open tool →</button>`;
      row.querySelector("input").addEventListener("change", (e) => {
        const all = NAPE.get(KIT_KEY, {});
        const safe = all && typeof all === "object" ? all : {};
        (safe[c.id] = safe[c.id] || {})[item.k] = e.target.checked;
        NAPE.set(KIT_KEY, safe);
        row.classList.toggle("done", e.target.checked);
        kitProgress(c.id);
      });
      row.querySelector("button").addEventListener("click", () => {
        showTool(item.k);
        document.getElementById("media-tabs").scrollIntoView({ behavior: "smooth", block: "start" });
      });
      wrap.append(row);
    });
  }

  /* ---------- Tabs & wiring ---------- */
  function showTool(tool) {
    document.querySelectorAll("#media-tabs .m-tab").forEach(ch => {
      const on = ch.dataset.tool === tool;
      ch.classList.toggle("active", on);
      ch.setAttribute("aria-selected", String(on));
    });
    document.querySelectorAll(".tool-panel").forEach(p => { p.hidden = p.id !== "tool-" + tool; });
    $("pdf-section").hidden = tool !== "pdf";
    refresh();
  }

  function refresh() {
    const c = currentCtx();
    $("m-purpose").hidden = !c;
    renderPreview(c);
    renderKit(c);
    const nb = $("nb-cards");
    if (!$("tool-notebook").hidden) {
      if (c) buildNotebookPrompts(c);
      else {
        nb.innerHTML = `<p class="empty-note">Choose what to promote at the top of the page, and copy-ready prompts will appear here.</p>`;
        $("nb-copy-all").hidden = true;
      }
    }
    if (!$("tool-social").hidden) {
      renderPosts();
      renderImage();
    }
    renderPdf(); // always current, so printing works from any tab
  }

  /* When the selection changes: prefill the shared goal from the category profile
     and detect a saved Connect campaign with this partner. */
  let lastResourceId = "";
  function onResourceChange() {
    const val = $("m-resource").value;
    if (val && val !== lastResourceId) {
      lastResourceId = val;
      const isNape = val === "__nape";
      const a = isNape ? NAPE_SELF : DIRECTORY.find(x => x.id === val);
      const profile = isNape ? NAPE_SELF_PROFILE
        : (a && CATEGORY_CONTENT[a.category]) || DEFAULT_PROFILE;
      $("m-shared-goal").value = profile.sharedGoal || "";

      const camps = isNape ? [] : campaignsFor(val);
      const hint = $("m-campaign-hint");
      if (camps.length) {
        const goalName = { establish: "Establish", reconnect: "Reconnect", support: "Support one another" }[camps[0].goal] || "";
        hint.hidden = false;
        hint.textContent = `You have a saved outreach campaign with this partner${goalName ? ` (${goalName})` : ""} — this content will reinforce it.`;
        $("m-goal").value = "campaign";
      } else {
        hint.hidden = true;
        if ($("m-goal").value === "campaign") $("m-goal").value = "partner";
      }
    }
    refresh();
  }

  function init() {
    fillResourceSelect();
    $("m-form").classList.remove("loading");

    const profile = NAPE.get(NAPE.KEYS.PROFILE, null);
    if (profile) {
      if (profile.name) $("m-your-name").value = profile.name;
      if (profile.agency) $("m-your-agency").value = profile.agency;
    }

    $("m-resource").addEventListener("change", onResourceChange);
    $("m-your-name").addEventListener("change", refresh);
    $("m-your-agency").addEventListener("change", refresh);
    $("m-goal").addEventListener("change", refresh);
    $("m-audience").addEventListener("change", refresh);
    let sgTimer;
    $("m-shared-goal").addEventListener("input", () => {
      clearTimeout(sgTimer);
      sgTimer = setTimeout(refresh, 400);
    });

    document.querySelectorAll("#media-tabs .m-tab").forEach(ch =>
      ch.addEventListener("click", () => showTool(ch.dataset.tool)));

    $("nb-copy-all").addEventListener("click", (e) =>
      copyWithState(e.currentTarget, NB_TEXTS.join("\n\n\n")));

    document.querySelectorAll("#sm-platforms .chip").forEach(ch =>
      ch.addEventListener("click", () => {
        document.querySelectorAll("#sm-platforms .chip").forEach(x => x.classList.remove("active"));
        ch.classList.add("active");
        renderPosts();
      }));
    $("sm-size").addEventListener("change", renderImage);
    $("sm-theme").addEventListener("change", renderImage);
    let headlineTimer;
    $("sm-headline").addEventListener("input", () => {
      clearTimeout(headlineTimer);
      headlineTimer = setTimeout(renderImage, 350);
    });
    $("sm-download").addEventListener("click", downloadImage);
    $("sm-copy-img").addEventListener("click", copyImage);

    $("pdf-print").addEventListener("click", () => {
      renderPdf();
      window.print();
    });

    refresh();
  }

  (async function () {
    await loadDirectory();
    init();
  })();
})();
