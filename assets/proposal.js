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
  const STORE_KEY = "nape_proposal_v1";
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
    return c;
  }

  function render() {
    updatePackagePrices();
    const c = renderSummary();
    renderMatrix();
    renderFeatures();
    $("pr-hours-out").textContent = String(state.hours);
    NAPE.set(STORE_KEY, state);
    try { history.replaceState(null, "", "#" + toHash(state)); } catch (e) { /* ignore */ }
    return c;
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
    $("pr-print").addEventListener("click", () => window.print());
    $("pr-reset").addEventListener("click", () => {
      state = sanitize(null);
      renderControls(); $("pr-hours").value = 0; $("pr-budget").value = "";
      render();
    });
  }

  init();
})();
