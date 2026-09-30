/* NAPE Leadership Platform — Proposal calculator (Proposal page)
 *
 * All prices live in PRICING below. The values are ILLUSTRATIVE placeholders:
 * replace them with the real quote, then set `illustrative: false` to hide the
 * "illustrative pricing" notice on the page.
 */
const PRICING = {
  illustrative: true,
  contactEmail: "dougdevitre@gmail.com",
  terms: [
    { years: 1, label: "1 year", discount: 0, note: "Lowest commitment. Pricing reviewed at renewal." },
    { years: 2, label: "2 years", discount: 0.05, note: "Rate held for the term." },
    { years: 3, label: "3 years", discount: 0.10, note: "Rate held for the term. Best for continuity." }
  ],
  packages: {
    essentials: {
      name: "Essentials", monthly: 750, hours: 0,
      tagline: "A capable administrator and a stable, secure site.",
      highlights: ["Hosting, monitoring, patching, backups", "Member-login access maintained", "Bug fixes included"]
    },
    standard: {
      name: "Standard", monthly: 1500, hours: 4, recommended: true,
      tagline: "Steady improvement and a supported administrator.",
      highlights: ["Everything in Essentials", "Monthly enhancement hours", "Monthly office hours and quarterly reports"]
    },
    partner: {
      name: "Partner", monthly: 2750, hours: 8,
      tagline: "A fully managed program with a defined service level.",
      highlights: ["Everything in Standard", "Priority response (2 business hours, urgent)", "Quarterly roadmap and analytics reviews"]
    }
  },
  gating: {
    invite: { name: "Administrator-invited access", fee: 4000, desc: "Your administrator invites or approves each member. Simplest and fastest to launch." },
    roster: { name: "Roster-checked sign-up", fee: 7500, desc: "Members sign up themselves; access is granted when they match a NAPE roster or email list." },
    dues: { name: "Dues-linked access", fee: 14000, desc: "Access follows paid dues or NAPE's membership system, synced automatically. Most automation, most integration work." }
  },
  addons: {
    legal: { name: "Privacy Notice and Terms update for accounts", fee: 2500, recommended: true, desc: "Drafting and updates for the site. Counsel's review is separate." },
    sync: { name: "Progress that follows the member across devices", fee: 6000, desc: "Moves goals and reflections from the browser to member accounts. Needs privacy and legal review." },
    training: { name: "Extra administrator workshop (half day)", fee: 1500, desc: "Hands-on session beyond the included training." },
    launch: { name: "Member launch kit", fee: 1200, desc: "Announcement text and a one-page how-to for signing in." }
  },
  extraHourRate: 150,
  maxExtraHours: 20,
  features: [
    ["Hosting, monitoring, patching, backups", "Included", "Included", "Included"],
    ["Member-login access maintenance", "Included", "Included", "Included"],
    ["Bug fixes", "Included", "Included", "Included, priority"],
    ["Change / enhancement allowance", "hours", "hours", "hours"],
    ["Administrator support", "Email", "Email", "Email + phone for urgent"],
    ["Office hours", "On request", "Monthly", "Twice monthly"],
    ["Training and runbook", "Initial session", "Initial + annual refresher", "Initial + semiannual"],
    ["Security and uptime report", "Annual", "Quarterly", "Quarterly + incident reviews"],
    ["Aggregate usage analytics", "—", "Annual", "Quarterly"],
    ["Roadmap and planning session", "—", "Annual", "Quarterly"],
    ["Compliance support", "Annual check", "Annual + on change", "Annual + on change + counsel coordination"],
    ["Response: urgent (site down, login broken)", "1 business day", "4 business hours", "2 business hours"],
    ["Response: normal", "3 business days", "2 business days", "1 business day"]
  ]
};

(function () {
  const PKG_KEYS = Object.keys(PRICING.packages);
  const STORE_KEY = NAPE.KEYS.PROPOSAL;
  const DOC_KEY = NAPE.KEYS.PROPOSAL_DOC;
  const DEFAULTS = { pkg: "standard", term: 2, gate: "roster", addons: ["legal"], hours: 0, budget: 0 };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const termOf = (years) => PRICING.terms.find((t) => t.years === years) || PRICING.terms[0];

  /* ---------- State (validated: it can come from the URL or storage) ---------- */
  function sanitize(raw) {
    const s = Object.assign({}, DEFAULTS);
    if (!raw || typeof raw !== "object") return s;
    if (PKG_KEYS.includes(raw.pkg)) s.pkg = raw.pkg;
    if (PRICING.terms.some((t) => t.years === Number(raw.term))) s.term = Number(raw.term);
    if (Object.hasOwn(PRICING.gating, raw.gate)) s.gate = raw.gate;
    if (Array.isArray(raw.addons)) s.addons = raw.addons.filter((a) => Object.hasOwn(PRICING.addons, a));
    const h = Math.round(Number(raw.hours));
    if (Number.isFinite(h)) s.hours = Math.min(PRICING.maxExtraHours, Math.max(0, h));
    const b = Math.round(Number(raw.budget));
    if (Number.isFinite(b)) s.budget = Math.min(10000000, Math.max(0, b));
    return s;
  }

  function fromHash() {
    try {
      const p = new URLSearchParams(location.hash.replace(/^#/, ""));
      if (!p.has("p")) return null;
      return { pkg: p.get("p"), term: p.get("t"), gate: p.get("g"), addons: (p.get("a") || "").split(",").filter(Boolean), hours: p.get("h"), budget: p.get("b") };
    } catch (e) { return null; }
  }

  function toHash(s) {
    const p = new URLSearchParams();
    p.set("p", s.pkg); p.set("t", String(s.term)); p.set("g", s.gate);
    if (s.addons.length) p.set("a", s.addons.join(","));
    if (s.hours) p.set("h", String(s.hours));
    if (s.budget) p.set("b", String(s.budget));
    return p.toString();
  }

  let state = sanitize(fromHash() || NAPE.get(STORE_KEY, null));

  /* ---------- Pricing math ---------- */
  function compute(s, pkgKey, years) {
    const pkg = PRICING.packages[pkgKey];
    const term = termOf(years);
    const listMonthly = pkg.monthly;
    const packageMonthly = listMonthly * (1 - term.discount);
    const extraMonthly = s.hours * PRICING.extraHourRate;
    const monthly = packageMonthly + extraMonthly;
    const oneTime = PRICING.gating[s.gate].fee + s.addons.reduce((sum, a) => sum + PRICING.addons[a].fee, 0);
    const termTotal = monthly * 12 * years + oneTime;
    return {
      pkg, term, listMonthly, packageMonthly, extraMonthly, monthly, oneTime, termTotal,
      annualAvg: termTotal / years,
      firstYear: monthly * 12 + oneTime,
      savings: (listMonthly - packageMonthly) * 12 * years,
      hoursPerYear: (pkg.hours + s.hours) * 12
    };
  }

  /* ---------- Controls ---------- */
  function optCard(name, value, checked, type, title, price, desc, badge) {
    return `<label class="opt"><input type="${type}" name="${name}" value="${esc(value)}"${checked ? " checked" : ""}>
      <span class="opt-body"><span class="opt-top"><span class="opt-title">${esc(title)}</span><span class="opt-price">${price}</span></span>
      <span class="opt-desc">${esc(desc)}</span>${badge ? `<span class="opt-badge">${esc(badge)}</span>` : ""}</span></label>`;
  }

  function renderControls() {
    $("pr-terms").innerHTML = PRICING.terms.map((t) =>
      optCard("term", t.years, state.term === t.years, "radio", t.label, t.discount ? `${Math.round(t.discount * 100)}% off service` : "Standard rate", t.note)).join("");
    $("pr-gating").innerHTML = Object.entries(PRICING.gating).map(([k, g]) =>
      optCard("gate", k, state.gate === k, "radio", g.name, money(g.fee) + " once", g.desc)).join("");
    $("pr-addons").innerHTML = Object.entries(PRICING.addons).map(([k, a]) =>
      optCard("addon", k, state.addons.includes(k), "checkbox", a.name, money(a.fee) + " once", a.desc, a.recommended ? "Recommended" : "")).join("");
    renderPackages();
    $("pr-hours").max = String(PRICING.maxExtraHours);
    $("pr-hours-rate").textContent = money(PRICING.extraHourRate);
  }

  function renderPackages() {
    $("pr-packages").innerHTML = PKG_KEYS.map((k) => {
      const p = PRICING.packages[k];
      return `<label class="opt pkg"><input type="radio" name="pkg" value="${k}"${state.pkg === k ? " checked" : ""}>
        <span class="opt-body"><span class="opt-top"><span class="opt-title">${esc(p.name)}</span></span>
        <span class="pkg-price" data-price="${k}"></span>
        <span class="opt-desc"><i>${esc(p.tagline)}</i></span>
        <span class="pkg-list">${p.highlights.map((h) => `<span>${esc(h)}</span>`).join("")}</span>
        ${p.recommended ? '<span class="opt-badge">Recommended</span>' : ""}</span></label>`;
    }).join("");
  }

  function updatePackagePrices() {
    document.querySelectorAll("[data-price]").forEach((el) => {
      const c = compute(state, el.dataset.price, state.term);
      el.innerHTML = `${money(c.packageMonthly)}<small>/mo</small>`;
    });
  }

  /* ---------- Results ---------- */
  function featureValue(row, idx, pkgKey) {
    const v = row[idx + 1];
    if (v !== "hours") return v;
    const h = PRICING.packages[pkgKey].hours;
    return h ? `${h} hrs / month` : "Quoted separately";
  }

  function bestFit(budget) {
    let best = null;
    PKG_KEYS.forEach((k, tier) => {
      PRICING.terms.forEach((t) => {
        const c = compute(state, k, t.years);
        if (c.annualAvg > budget) return;
        if (!best || tier > best.tier || (tier === best.tier && c.annualAvg < best.c.annualAvg)) best = { key: k, years: t.years, c, tier };
      });
    });
    return best;
  }

  function renderMatrix() {
    const head = `<tr><th></th>${PRICING.terms.map((t) => `<th>${esc(t.label)}</th>`).join("")}</tr>`;
    const rows = PKG_KEYS.map((k) => {
      const cells = PRICING.terms.map((t) => {
        const c = compute(state, k, t.years);
        const fit = state.budget > 0 && c.annualAvg <= state.budget;
        const sel = k === state.pkg && t.years === state.term;
        return `<td class="${fit ? "fit" : ""}${sel ? " sel" : ""}"><button type="button" class="cell-btn" data-pick="${k}|${t.years}" aria-label="Choose ${esc(PRICING.packages[k].name)}, ${esc(t.label)}, about ${money(c.annualAvg)} per year">${money(c.annualAvg)}<small>/yr</small></button></td>`;
      }).join("");
      return `<tr><th scope="row">${esc(PRICING.packages[k].name)}</th>${cells}</tr>`;
    }).join("");
    $("pr-matrix").innerHTML = head + rows;
    $("pr-matrix-note").textContent = state.budget > 0
      ? `Shaded cells fit within your ${money(state.budget)} per year budget. Averages include one-time costs spread across the term.`
      : "Average cost per year, including one-time costs spread across the term. Enter a budget above to highlight what fits.";
  }

  function renderFeatures() {
    const cols = PKG_KEYS.map((k) => `<th${k === state.pkg ? ' class="sel"' : ""}>${esc(PRICING.packages[k].name)}</th>`).join("");
    const rows = PRICING.features.map((r) => `<tr><td>${esc(r[0])}</td>${PKG_KEYS.map((k, i) =>
      `<td${k === state.pkg ? ' class="sel"' : ""}>${esc(featureValue(r, i, k))}</td>`).join("")}</tr>`).join("");
    $("pr-features").innerHTML = `<tr><th></th>${cols}</tr>${rows}`;
  }

  function summaryText(c) {
    const lines = [
      "NAPE Leadership Platform: my support plan",
      `Package: ${c.pkg.name}, ${c.term.label}`,
      `Member access: ${PRICING.gating[state.gate].name}`,
      state.addons.length ? "Add-ons: " + state.addons.map((a) => PRICING.addons[a].name).join("; ") : "Add-ons: none",
      state.hours ? `Extra enhancement hours: ${state.hours} per month` : null,
      `Monthly service: ${money(c.monthly)}`,
      `One-time: ${money(c.oneTime)}`,
      `First-year cost: ${money(c.firstYear)}`,
      `Total over ${c.term.label}: ${money(c.termTotal)} (about ${money(c.annualAvg)} per year)`,
      state.budget ? `Annual budget: ${money(state.budget)}` : null,
      PRICING.illustrative ? "Note: illustrative pricing; final figures are confirmed in the statement of work." : null,
      "Vendor subscriptions (Clerk, Vercel, Airtable) are billed by those vendors and not included."
    ];
    return lines.filter(Boolean).join("\n");
  }

  function renderSummary() {
    const c = compute(state, state.pkg, state.term);
    $("pr-annual").textContent = money(c.annualAvg);
    $("pr-monthly").textContent = money(c.monthly);
    $("pr-onetime").textContent = money(c.oneTime);
    $("pr-first").textContent = money(c.firstYear);
    $("pr-total").textContent = money(c.termTotal);
    $("pr-total-label").textContent = `Total over ${c.term.label}`;
    $("pr-savings").textContent = c.savings > 0 ? `Term discount saves ${money(c.savings)} over ${c.term.label}.` : "";

    // Budget status
    const box = $("pr-budget-status");
    if (state.budget > 0) {
      const diff = state.budget - c.annualAvg;
      const best = bestFit(state.budget);
      let msg;
      if (diff >= 0) {
        box.className = "bud ok";
        msg = `<b>Within budget.</b> About ${money(diff)} per year to spare.`;
      } else {
        box.className = "bud over";
        msg = `<b>Over budget</b> by about ${money(-diff)} per year.`;
      }
      if (best && !(best.key === state.pkg && best.years === state.term)) {
        msg += ` <button type="button" class="link-btn" data-pick="${best.key}|${best.years}">Best fit: ${esc(PRICING.packages[best.key].name)}, ${esc(termOf(best.years).label)} (${money(best.c.annualAvg)}/yr)</button>`;
      } else if (!best) {
        msg += " No package fits with the choices above. Try a simpler access model or fewer add-ons.";
      }
      box.innerHTML = msg;
      box.hidden = false;
    } else {
      box.hidden = true;
    }

    // What you get
    const gets = [];
    c.pkg.highlights.forEach((h) => gets.push(h));
    const hrs = c.hoursPerYear;
    if (hrs) gets.push(`${hrs} enhancement hours per year (${c.pkg.hours + state.hours} per month)`);
    gets.push(`Member access: ${PRICING.gating[state.gate].name}`);
    state.addons.forEach((a) => gets.push(PRICING.addons[a].name));
    gets.push("Handoff package at the end of the term: repository, documentation, credentials, knowledge transfer");
    $("pr-gets").innerHTML = gets.map((g) => `<li>${esc(g)}</li>`).join("");

    $("pr-mailto").href = "mailto:" + PRICING.contactEmail +
      "?subject=" + encodeURIComponent("NAPE Leadership Platform: my support plan") +
      "&body=" + encodeURIComponent(summaryText(c) + "\n");
    if ($("pr-mailto2")) $("pr-mailto2").href = $("pr-mailto").href;
    return c;
  }

  function render() {
    updatePackagePrices();
    const c = renderSummary();
    renderMatrix();
    renderFeatures();
    $("pr-hours-out").textContent = String(state.hours);
    NAPE.set(STORE_KEY, state);
    renderDoc(c);
    try { history.replaceState(null, "", "#" + toHash(state)); } catch (e) { /* ignore */ }
    return c;
  }

/* ---------- Final PDF document (built from the selections; saved via the browser's print dialog) ---------- */
  function sanitizeDoc(raw) {
    const d = { who: "", notes: "", features: true, compare: true };
    if (!raw || typeof raw !== "object") return d;
    if (typeof raw.who === "string") d.who = raw.who.slice(0, 120);
    if (typeof raw.notes === "string") d.notes = raw.notes.slice(0, 1500);
    if (typeof raw.features === "boolean") d.features = raw.features;
    if (typeof raw.compare === "boolean") d.compare = raw.compare;
    return d;
  }
  let docState = sanitizeDoc(NAPE.get(DOC_KEY, null));

  const docDate = () => new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const para = (t) => esc(t).replace(/\n/g, "<br>");

  function considerations(c) {
    const out = [];
    if (!state.addons.includes("legal")) {
      out.push("Your plan does not include the Privacy Notice and Terms update. A members-only sign-in changes what the site collects, so NAPE's counsel should review the current wording before launch.");
    }
    if (state.addons.includes("sync")) {
      out.push("Keeping progress in member accounts means goals and reflections are stored on a server. This needs privacy and legal review and clear consent language.");
    }
    if (state.gate === "dues") {
      out.push("Dues-linked access depends on NAPE's membership system. Kickoff should confirm what data it can share and how often.");
    }
    if (state.budget > 0 && c.annualAvg > state.budget) {
      out.push(`This plan averages ${money(c.annualAvg)} per year, which is ${money(c.annualAvg - state.budget)} over your ${money(state.budget)} budget.`);
    }
    return out;
  }

  function decisionRows() {
    const g = PRICING.gating[state.gate];
    const memberSource = state.gate === "dues"
      ? ["NAPE's membership system, synced automatically", "Chosen"]
      : state.gate === "roster"
        ? ["A NAPE roster or email list; NAPE supplies and updates it", "Confirm at kickoff"]
        : ["Set by your administrator in the login system", "Chosen"];
    return [
      ["How people become members", g.name, "Chosen"],
      ["Where membership status lives", memberSource[0], memberSource[1]],
      ["Where progress is kept", state.addons.includes("sync") ? "In member accounts (privacy and legal review needed)" : "On each member's device, as today", "Chosen"],
      ["Who administers access", "To be named, with a backup", "Decide at kickoff"],
      ["Existing users", "Keep current contacts or require re-registration", "Decide at kickoff"]
    ];
  }

  function renderDoc(c) {
    const el = $("pr-doc");
    if (!el) return;
    const g = PRICING.gating[state.gate];
    const addons = state.addons.map((a) => PRICING.addons[a]);
    const who = docState.who.trim();
    const row = (a, b, cls) => `<tr${cls ? ` class="${cls}"` : ""}><td>${a}</td><td class="amt">${b}</td></tr>`;

    const cost = [];
    cost.push(row(`${esc(c.pkg.name)} package, ${money(c.listMonthly)} per month`, `${money(c.listMonthly)}/mo`));
    if (c.term.discount) cost.push(row(`Term discount (${Math.round(c.term.discount * 100)}% for ${esc(c.term.label)})`, `−${money(c.listMonthly - c.packageMonthly)}/mo`));
    if (state.hours) cost.push(row(`Extra enhancement hours (${state.hours} × ${money(PRICING.extraHourRate)})`, `${money(c.extraMonthly)}/mo`));
    cost.push(row("<b>Monthly service</b>", `<b>${money(c.monthly)}/mo</b>`, "sub"));
    cost.push(row("Service per year (12 months)", money(c.monthly * 12)));
    cost.push(row(`Member access build: ${esc(g.name)}`, money(g.fee)));
    addons.forEach((a) => cost.push(row(esc(a.name), money(a.fee))));
    cost.push(row("<b>One-time total</b>", `<b>${money(c.oneTime)}</b>`, "sub"));
    cost.push(row("First-year cost", money(c.firstYear)));
    cost.push(row(`<b>Total over ${esc(c.term.label)}</b>`, `<b>${money(c.termTotal)}</b>`, "total"));
    cost.push(row("Average per year, one-time costs spread across the term", money(c.annualAvg)));

    const feat = PRICING.features.map((r) => {
      const idx = PKG_KEYS.indexOf(state.pkg);
      return `<tr><td>${esc(r[0])}</td><td>${esc(featureValue(r, idx, state.pkg))}${r[0] === "Change / enhancement allowance" && state.hours ? ` + ${state.hours} extra` : ""}</td></tr>`;
    }).join("");

    const matrix = () => {
      const head = `<tr><th></th>${PRICING.terms.map((t) => `<th>${esc(t.label)}</th>`).join("")}</tr>`;
      const rows = PKG_KEYS.map((k) => `<tr><th scope="row">${esc(PRICING.packages[k].name)}</th>${PRICING.terms.map((t) => {
        const x = compute(state, k, t.years);
        const sel = k === state.pkg && t.years === state.term;
        return `<td class="${sel ? "sel" : ""}">${money(x.annualAvg)}/yr${sel ? " <b>(your plan)</b>" : ""}</td>`;
      }).join("")}</tr>`).join("");
      return `<table class="pd-table pd-matrix">${head}${rows}</table>
        <p class="pd-small">Average cost per year for each package and term, using your access model and add-ons, with one-time costs spread across the term.</p>`;
    };

    const notes = considerations(c);
    el.innerHTML = `
      <header class="pd-head">
        <div class="pd-kick">NAPE Executive Leadership Experience</div>
        <h2>Support plan</h2>
        <div class="pd-meta">
          <div><b>Prepared for</b>${who ? esc(who) : "NAPE leadership team"}</div>
          <div><b>Date</b>${esc(docDate())}</div>
          <div><b>Prepared with</b>Doug Devitre<br>${esc(PRICING.contactEmail)}<br>314.496.5973<br>linkedin.com/in/dougdevitre</div>
        </div>
      </header>

      <section class="pd-sec"><h3>Your selections</h3>
        <table class="pd-table pd-kv">
          <tr><th scope="row">Package</th><td><b>${esc(c.pkg.name)}</b>. ${esc(c.pkg.tagline)}</td></tr>
          <tr><th scope="row">Term</th><td>${esc(c.term.label)}${c.term.discount ? `, ${Math.round(c.term.discount * 100)}% off the service fee` : ""}. ${esc(c.term.note)}</td></tr>
          <tr><th scope="row">Member access</th><td><b>${esc(g.name)}</b>. ${esc(g.desc)}</td></tr>
          <tr><th scope="row">Add-ons</th><td>${addons.length ? addons.map((a) => `<b>${esc(a.name)}</b>. ${esc(a.desc)}`).join("<br>") : "None selected."}</td></tr>
          <tr><th scope="row">Extra hours</th><td>${state.hours ? `${state.hours} per month, beyond the ${c.pkg.hours ? c.pkg.hours + " included" : "none included"}` : "None"}</td></tr>
          <tr><th scope="row">Budget</th><td>${state.budget ? `${money(state.budget)} per year` : "Not set"}</td></tr>
        </table>
      </section>

      <section class="pd-sec keep"><h3>Cost</h3>
        <table class="pd-table pd-cost">${cost.join("")}</table>
        <p class="pd-small">Clerk, Vercel, and Airtable subscriptions are billed by those vendors and are not included.${PRICING.illustrative ? " Figures are estimates for planning and are confirmed in the statement of work." : " Figures are confirmed in the statement of work."}</p>
      </section>

      ${docState.features ? `<section class="pd-sec"><h3>What your ${esc(c.pkg.name)} package covers</h3>
        <table class="pd-table pd-kv">${feat}</table>
        <p class="pd-small">At the end of the term you receive a handoff package: repository and documentation, credential rotation, a runbook, and a knowledge-transfer session.</p></section>` : ""}

      ${docState.compare ? `<section class="pd-sec keep"><h3>How your plan compares</h3>${matrix()}</section>` : ""}

      <section class="pd-sec keep"><h3>Your choices and open decisions</h3>
        <table class="pd-table pd-dec"><tr><th>Decision</th><th>Your choice</th><th>Status</th></tr>
          ${decisionRows().map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td class="${r[2] === "Chosen" ? "ok" : "todo"}">${esc(r[2])}</td></tr>`).join("")}
        </table>
      </section>

      ${notes.length ? `<section class="pd-sec keep"><h3>Things to consider</h3><ul class="pd-list">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></section>` : ""}

      ${docState.notes.trim() ? `<section class="pd-sec"><h3>Notes and questions</h3><p class="pd-notes">${para(docState.notes.trim())}</p></section>` : ""}

      <section class="pd-sec keep"><h3>Next steps</h3>
        <ol class="pd-list">
          <li>Send this PDF to Doug Devitre at ${esc(PRICING.contactEmail)}.</li>
          <li>Schedule a 45-minute kickoff call to settle the open decisions above.</li>
          <li>Receive a final quote and statement of work reflecting these choices.</li>
          <li>Sign and begin the members-only login build.</li>
        </ol>
      </section>

      <div class="pd-foot">
        <p>This plan is a planning document, not legal advice. Privacy, membership terms, and the handling of member reflections should be reviewed by NAPE's counsel.</p>
        <p>Reopen this exact plan: <span class="pd-url">${esc(location.origin + location.pathname + "#" + toHash(state))}</span></p>
      </div>`;
  }

  /* ---------- Events ---------- */
  function readForm() {
    const val = (name) => { const el = document.querySelector(`input[name="${name}"]:checked`); return el ? el.value : null; };
    const before = toHash(state);
    state = sanitize({
      pkg: val("pkg"), term: val("term"), gate: val("gate"),
      addons: Array.from(document.querySelectorAll('input[name="addon"]:checked')).map((el) => el.value),
      hours: $("pr-hours").value, budget: $("pr-budget").value
    });
    // A blur "change" after typing repeats the "input" update; skip it so a click
    // that caused the blur isn't lost to a re-render.
    if (toHash(state) === before) return;
    render();
  }

  function pick(pkg, years) {
    state = sanitize(Object.assign({}, state, { pkg, term: years }));
    renderControls();
    $("pr-hours").value = state.hours;
    render();
    const live = $("pr-live"); if (live) live.textContent = `Selected ${PRICING.packages[state.pkg].name}, ${termOf(state.term).label}.`;
  }

  async function copyText(text, okMsg) {
    try { await navigator.clipboard.writeText(text); if (window.napeToast) napeToast(okMsg); }
    catch (e) { if (window.napeToast) napeToast("Copy isn't available in this browser."); }
  }

  function init() {
    if (!$("pr-terms")) return;
    if (!PRICING.illustrative) $("pr-illustrative").hidden = true;
    renderControls();
    $("pr-hours").value = state.hours;
    $("pr-budget").value = state.budget || "";
    render();

    $("pr-form").addEventListener("change", readForm);
    $("pr-form").addEventListener("input", (e) => { if (e.target.id === "pr-hours" || e.target.id === "pr-budget") readForm(); });
    $("pr-form").addEventListener("submit", (e) => e.preventDefault());
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-pick]");
      if (b) { const [k, y] = b.dataset.pick.split("|"); pick(k, Number(y)); }
    });
    window.addEventListener("hashchange", () => {
      const h = fromHash();
      if (!h) return;
      state = sanitize(h);
      renderControls(); $("pr-hours").value = state.hours; $("pr-budget").value = state.budget || "";
      render();
    });
    $("pr-copy").addEventListener("click", () => copyText(summaryText(compute(state, state.pkg, state.term)), "Plan summary copied."));
    $("pr-link").addEventListener("click", () => copyText(location.href, "Link to this plan copied."));
    // Final PDF: fields persist on this device only; print title becomes the suggested file name
    $("pr-who").value = docState.who;
    $("pr-notes").value = docState.notes;
    $("pr-inc-features").checked = docState.features;
    $("pr-inc-compare").checked = docState.compare;
    $("pr-doc-form").addEventListener("input", () => {
      docState = sanitizeDoc({ who: $("pr-who").value, notes: $("pr-notes").value, features: $("pr-inc-features").checked, compare: $("pr-inc-compare").checked });
      NAPE.set(DOC_KEY, docState);
      renderDoc(compute(state, state.pkg, state.term));
    });
    $("pr-doc-form").addEventListener("submit", (e) => e.preventDefault());
    $("pr-save").addEventListener("click", () => {
      const live = $("pr-doc-live"); if (live) live.textContent = "Opening the print dialog. Choose Save as PDF.";
      window.print();
    });
    $("pr-to-final").addEventListener("click", (e) => {
      e.preventDefault();
      const f = $("pr-final");
      f.scrollIntoView({ behavior: "smooth", block: "start" });
      $("pr-who").focus({ preventScroll: true });
    });
    let savedTitle = null;
    window.addEventListener("beforeprint", () => {
      savedTitle = document.title;
      const who = docState.who.trim().replace(/[^\w .,'&-]/g, "");
      document.title = "NAPE Support Plan" + (who ? " - " + who : "");
    });
    window.addEventListener("afterprint", () => { if (savedTitle !== null) { document.title = savedTitle; savedTitle = null; } });
    $("pr-reset").addEventListener("click", () => {
      state = sanitize(null);
      renderControls(); $("pr-hours").value = 0; $("pr-budget").value = "";
      render();
    });
  }

  init();
})();
