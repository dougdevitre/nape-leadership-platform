// Headless-browser smoke test. Serves the repo with Vercel-style clean URLs
// and exercises every page plus the growth-plan import and interest-form flows.
// Run locally or in CI:  npm install playwright && npx playwright install chromium && node scripts/smoke.js
const fs = require("fs");
const path = require("path");
const http = require("http");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  // Fall back to a globally installed playwright (e.g. dev containers)
  const globalRoot = require("child_process").execSync("npm root -g").toString().trim();
  ({ chromium } = require(path.join(globalRoot, "playwright")));
}

const ROOT = path.join(__dirname, "..");
const PORT = 8899;

const server = http.createServer((req, res) => {
  let p = req.url.split("?")[0];
  if (p === "/") p = "/index.html";
  let f = path.join(ROOT, p);
  // Emulate vercel.json cleanUrls: /journey → journey.html
  if (!fs.existsSync(f) && !path.extname(f) && fs.existsSync(f + ".html")) f += ".html";
  if (fs.existsSync(f) && fs.statSync(f).isFile()) {
    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".json": "application/json" };
    res.setHeader("Content-Type", types[path.extname(f)] || "application/octet-stream");
    res.end(fs.readFileSync(f));
  } else {
    res.statusCode = 404;
    res.end(fs.readFileSync(path.join(ROOT, "404.html")));
  }
}).listen(PORT);

// Mirrors PRICING in assets/proposal.js (illustrative values); keep in sync when prices change.
const PRICING_CHECK = { partner: 2750, invite: 4000 };

const PAGES = ["/", "/journey", "/growth", "/reflections", "/resources", "/connect", "/media", "/proposal"];

(async () => {
  const launchOpts = {};
  if (fs.existsSync("/opt/pw-browsers/chromium")) launchOpts.executablePath = "/opt/pw-browsers/chromium";
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext();
  // Block external requests (fonts etc.) so the test can't hang on the network
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(page.url() + ": " + e.message));

  // 1. Every page renders its nav and active link without JS errors
  for (const p of PAGES) {
    await page.goto(`http://localhost:${PORT}${p}`);
    if (!(await page.$("nav.site-nav"))) throw new Error(p + ": nav missing");
    if (!(await page.$(".nav-links a.active[aria-current=page]"))) throw new Error(p + ": no active nav link");
  }

  // 1b. Media Studio loads the directory and builds prompts, posts, and the PDF one-pager
  await page.goto(`http://localhost:${PORT}/media`);
  await page.waitForFunction(() => document.querySelectorAll("#m-resource optgroup").length > 3);
  await page.selectOption("#m-resource", "__nape");
  await page.waitForFunction(() => document.querySelectorAll("#nb-cards .gen-card").length === 5);
  await page.click('#media-tabs .m-tab[data-tool="social"]');
  await page.waitForFunction(() => document.querySelectorAll("#sm-posts .gen-card").length >= 1);
  await page.click('#media-tabs .m-tab[data-tool="pdf"]');
  const pdfText = await page.$eval("#pdf-doc", el => el.textContent);
  if (!pdfText.includes("NAPE Executive Leadership Experience")) throw new Error("/media: PDF one-pager did not render");

  // 1c. Media share panel: opt-in reveals fields, submit posts to /api/media and confirms
  await page.route("**/api/media", r => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }));
  if (!(await page.$eval("#m-share-fields", el => el.hidden))) throw new Error("/media: share fields visible before opt-in");
  await page.check("#m-share-opt");
  await page.click("#m-share-send");
  await page.waitForFunction(() => document.getElementById("m-share-status").textContent.includes("Thanks"));
  await page.unroute("**/api/media");

  // 1c. Proposal calculator: totals follow the selections, budget flags fit, hostile URL state is sanitized
  await page.goto(`http://localhost:${PORT}/proposal`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`http://localhost:${PORT}/proposal#p=partner&t=3&g=invite&a=&h=0&b=0`);
  const feeds = await page.evaluate(() => ({ annual: document.getElementById("pr-annual").textContent, monthly: document.getElementById("pr-monthly").textContent, onetime: document.getElementById("pr-onetime").textContent }));
  const expectMonthly = "$" + Math.round(PRICING_CHECK.partner * 0.9).toLocaleString("en-US");
  if (feeds.monthly !== expectMonthly) throw new Error(`/proposal: monthly ${feeds.monthly} != ${expectMonthly}`);
  if (feeds.onetime !== "$" + PRICING_CHECK.invite.toLocaleString("en-US")) throw new Error("/proposal: one-time cost wrong: " + feeds.onetime);
  await page.check('input[name="addon"][value="sync"]');
  const onetimeAfter = await page.textContent("#pr-onetime");
  if (onetimeAfter === feeds.onetime) throw new Error("/proposal: add-on did not change one-time cost");
  await page.fill("#pr-budget", "1000");
  if (!(await page.textContent("#pr-budget-status")).includes("Over budget")) throw new Error("/proposal: over-budget message missing");
  await page.fill("#pr-budget", "9000000");
  if (!(await page.textContent("#pr-budget-status")).includes("Within budget")) throw new Error("/proposal: within-budget message missing");
  if ((await page.$$("#pr-matrix td.fit")).length !== 9) throw new Error("/proposal: matrix should mark all 9 options as fitting a large budget");
  await page.click('#pr-matrix [data-pick="essentials|1"]');
  if ((await page.getAttribute('input[name="pkg"][value="essentials"]', "checked")) === null) throw new Error("/proposal: matrix pick did not select package");
  await page.goto(`http://localhost:${PORT}/proposal#p=%3Cimg%20src%3Dx%3E&t=99&g=nope&a=bogus&h=9999&b=-5`);
  const hostileOk = await page.evaluate(() => !document.querySelector("#pr-terms img, #pr-summary img") && document.getElementById("pr-hours-out").textContent === "20");
  if (!hostileOk) throw new Error("/proposal: hostile hash state not sanitized");
  await page.evaluate(() => localStorage.clear());

  // 2. Importing a hostile plan file normalizes and renders cleanly
  await page.goto(`http://localhost:${PORT}/growth`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  page.on("dialog", d => d.accept());
  const hostile = JSON.stringify({ goals: [null, { title: "no ms" }, { title: "ok", stage: "org", milestones: [{ text: "a" }, { text: "b", status: "approved" }] }] });
  await page.evaluate(async (json) => {
    const dt = new DataTransfer();
    dt.items.add(new File([json], "plan.json", { type: "application/json" }));
    const input = document.getElementById("import-file");
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
  }, hostile);
  await page.reload();
  const goalsText = await page.textContent("#goals");
  if (!goalsText.includes("no ms") || !goalsText.includes("ok")) throw new Error("imported goals not rendered");

  // 2a-bis. Target dates: "Due soon" filter shows only overdue/upcoming goals; inline editor sets a date
  await page.goto(`http://localhost:${PORT}/growth`);
  await page.evaluate(() => {
    localStorage.clear();
    const day = 86400000;
    const iso = t => new Date(t).toISOString().slice(0, 10);
    localStorage.setItem("nape_goals_v1", JSON.stringify([
      { id: "d1", stage: "self", title: "Overdue goal", createdAt: 1, targetDate: iso(Date.now() - 2 * day), milestones: [{ id: "dm1", text: "x", status: "planned" }] },
      { id: "d2", stage: "self", title: "Far-future goal", createdAt: 1, targetDate: iso(Date.now() + 60 * day), milestones: [{ id: "dm2", text: "y", status: "planned" }] },
      { id: "d3", stage: "self", title: "No-date goal", createdAt: 1, milestones: [{ id: "dm3", text: "z", status: "planned" }] }
    ]));
  });
  await page.reload();
  if (!(await page.textContent("#goals")).includes("Overdue · was")) throw new Error("overdue target chip missing");
  await page.click('.chip[data-f="due"]');
  const dueText = await page.textContent("#goals");
  if (!dueText.includes("Overdue goal") || dueText.includes("Far-future goal") || dueText.includes("No-date goal"))
    throw new Error("Due soon filter wrong: " + dueText.slice(0, 200));
  await page.click('.chip[data-f="all"]');
  await page.click('[data-act="target-start"][data-g="d3"]');
  await page.fill("[data-tgin]", new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
  await page.click('[data-act="target-save"][data-g="d3"]');
  if (!(await page.textContent("#goals")).includes("Due in 3d")) throw new Error("target-save did not set date");
  await page.evaluate(() => localStorage.clear());

  // 2b. Journey stage tabs support arrow-key navigation
  await page.goto(`http://localhost:${PORT}/journey`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.focus('.stage-btn[data-stage="self"]');
  await page.keyboard.press("ArrowRight");
  if ((await page.getAttribute('.stage-btn[data-stage="others"]', "aria-selected")) !== "true")
    throw new Error("stage tablist arrow-key navigation broken");

  // 2c. Feedback widget: prefills the page, sends, and confirms
  await page.route("**/api/feedback", r => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }));
  await page.goto(`http://localhost:${PORT}/journey`);
  await page.click("#fb-open");
  if ((await page.inputValue("#fb-page")) !== "Journey") throw new Error("feedback widget page not prefilled");
  await page.fill("#fb-text", "Test feedback from smoke run");
  await page.click("#fb-send");
  await page.waitForFunction(() => document.getElementById("fb-note").textContent.includes("Thanks"));
  await page.unroute("**/api/feedback");

  // 3. Interest form: 503 shows the pending message, 200 shows success
  await page.route("**/api/interest", r => r.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false,"error":"not_configured"}' }));
  await page.goto(`http://localhost:${PORT}/connect`);
  await page.evaluate(() => localStorage.removeItem("nape_profile_v1"));
  await page.reload();
  await page.fill("#f-name", "Test Person");
  await page.fill("#f-email", "test@example.gov");
  await page.click("#f-submit");
  await page.waitForSelector(".confirm.show");
  if (!(await page.textContent("#f-confirm")).includes("couldn't reach NAPE")) throw new Error("503 shown as success");
  await page.unroute("**/api/interest");
  await page.route("**/api/interest", r => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }));
  await page.reload();
  await page.click("#f-submit");
  await page.waitForSelector(".confirm.show");
  if (!(await page.textContent("#f-confirm")).includes("you're on the list")) throw new Error("200 path broken");

  // 3b. Connect page carries both the interest form and the partner-connection tool. The tool's
  //     directory falls back to the snapshot when the API is unconfigured, a campaign builds from
  //     the form, progress persists, and it can join the growth plan
  await page.route("**/api/agencies", r => r.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false,"error":"not_configured"}' }));
  await page.goto(`http://localhost:${PORT}/connect`);
  if (!(await page.$("#interest-form")) || !(await page.$("#cx-form"))) throw new Error("connect page missing the interest form or the connection tool");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll("#cx-partner option").length > 10);
  if (!(await page.textContent("#cx-dir-note")).includes("saved copy")) throw new Error("directory snapshot fallback not used");
  await page.fill("#cx-name", "Pat Example");
  await page.selectOption("#cx-my-agency", "__other");
  await page.fill("#cx-my-agency-other", "Example County Probation");
  await page.selectOption("#cx-my-role", "Chief / Director");
  await page.selectOption("#cx-partner", { label: "National Institute of Corrections (NIC)" });
  await page.selectOption("#cx-partner-role", "Program or Training Director");
  await page.fill("#cx-contact", "Dr. Rivera");
  await page.click('.goal-card[data-goal="support"]');
  await page.click("#cx-build");
  await page.waitForSelector("#cx-campaign:not([hidden])");
  if ((await page.$$("#cx-steps .step")).length !== 6) throw new Error("campaign did not render 6 steps");
  if (!(await page.$("#cx-warm[hidden]"))) throw new Error("warm-intro step should be hidden for the support goal");
  const draft0 = await page.inputValue("#cx-draft-0");
  if (!draft0.includes("Example County Probation") || !draft0.includes("National Institute of Corrections"))
    throw new Error("draft not templated with both agencies: " + draft0.slice(0, 120));
  const draft1 = await page.inputValue("#cx-draft-1");
  if (!draft1.includes("Hello Dr. Rivera,") || draft1.includes("[Name]")) throw new Error("contact name not used in greeting");
  // By-Laws guardrails: general card shown; vendor notice and procurement line only for sponsors
  const guard = await page.textContent("#cx-guardrails");
  if (!guard.includes("not as NAPE") || guard.includes("event sponsor")) throw new Error("guardrails wrong for a non-vendor partner: " + guard.slice(0, 120));
  if (draft1.includes("procurement")) throw new Error("procurement line leaked into a non-vendor draft");
  await page.click('[data-done="0"]');
  await page.reload();
  await page.waitForSelector("#cx-campaign:not([hidden])");
  if (!(await page.textContent("#cx-head")).includes("1 of 6 steps done")) throw new Error("campaign progress did not persist");
  if (!(await page.$("#cx-saved:not([hidden]) .cx-item"))) throw new Error("saved campaign list missing");
  // The campaign builder saved a profile; the interest form must prefill from it, not flag a failed send
  if ((await page.inputValue("#f-name")) !== "Pat Example") throw new Error("interest form not prefilled from the campaign profile");
  if ((await page.textContent("#f-note")).includes("didn't reach")) throw new Error("interest form wrongly reports a failed submission");
  // Opt-in sharing: off by default; when on, sends a summary that excludes the contact name, drafts,
  // and step notes; marking a step done re-sends automatically; 503 shows the not-set-up message
  const sent = [];
  await page.route("**/api/connections", r => { sent.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); });
  if (!(await page.$("#cx-share-optin")) || (await page.isChecked("#cx-share-optin"))) throw new Error("sharing toggle missing or not off by default");
  await page.check("#cx-share-optin");
  await page.waitForFunction(() => document.getElementById("cx-share-status").textContent.includes("Sent to NAPE"));
  await page.selectOption("#cx-share-state", "Connected");
  await page.fill("#cx-share-note", "Agreed on a training pilot.");
  await page.fill("[data-note='1']", "Spoke with Dr. Rivera on Tuesday"); // step note must NOT be shared
  await page.click("#cx-share-send");
  await page.waitForFunction(n => window.__x = n, sent.length); // no-op wait to flush
  const last = sent[sent.length - 1];
  const raw = JSON.stringify(last);
  if (last.status !== "Connected" || last.note !== "Agreed on a training pilot." || last.partner !== "National Institute of Corrections" || last.stepsDone !== 1 || last.totalSteps !== 6 || last.consent !== true)
    throw new Error("share payload wrong: " + raw.slice(0, 300));
  if (raw.includes("Rivera") || raw.includes("Hello") || "contactName" in last || "steps" in last) throw new Error("share payload leaks contact, drafts, or notes: " + raw.slice(0, 300));
  const before = sent.length;
  await page.click('[data-done="1"]');
  await page.waitForFunction(() => document.querySelectorAll("#cx-steps .step.done").length === 2);
  await page.waitForFunction(() => true);
  await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
  if (sent.length <= before || sent[sent.length - 1].stepsDone !== 2) throw new Error("marking a step done did not auto-send an update");
  await page.unroute("**/api/connections");
  await page.route("**/api/connections", r => r.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false,"error":"not_configured"}' }));
  await page.click("#cx-share-send");
  await page.waitForFunction(() => document.getElementById("cx-share-status").textContent.includes("isn't set up"));
  await page.unroute("**/api/connections");
  await page.click("#cx-add-goal");
  const cxGoals = await page.evaluate(() => JSON.parse(localStorage.getItem("nape_goals_v1") || "[]"));
  if (cxGoals.length !== 1 || cxGoals[0].milestones.length !== 6) throw new Error("add-to-growth-plan did not create a 6-milestone goal");
  // Establish goal shows the warm-intro step with NAPE's contact from the snapshot and a mailto link
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll("#cx-partner option").length > 10);
  await page.selectOption("#cx-my-agency", "__other");
  await page.fill("#cx-my-agency-other", "Example County Probation");
  await page.selectOption("#cx-my-role", "Chief / Director");
  await page.selectOption("#cx-partner", { label: "National Institute of Corrections (NIC)" });
  await page.selectOption("#cx-partner-role", "Program or Training Director");
  await page.click('.goal-card[data-goal="establish"]');
  await page.click("#cx-build");
  await page.waitForSelector("#cx-warm:not([hidden]) textarea");
  const warm = await page.inputValue("#cx-warm-draft");
  if (!warm.includes("Hello Vanessa Farmer,") || !warm.includes("National Institute of Corrections")) throw new Error("warm intro draft not templated: " + warm.slice(0, 120));
  const mailHref = await page.getAttribute("#cx-warm-mail", "href");
  if (!mailHref || !mailHref.startsWith("mailto:vfarmer%40shsu.edu?subject=")) throw new Error("warm intro mailto link missing: " + mailHref);
  if (!warm.includes("courtesy, not an endorsement")) throw new Error("warm intro missing the courtesy/no-endorsement line");
  await page.click("#cx-warm-done");
  await page.reload();
  await page.waitForSelector("#cx-warm .step.done");
  // Sponsor partner: vendor guardrail and procurement language appear
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll("#cx-partner option").length > 10);
  await page.selectOption("#cx-my-agency", "__other");
  await page.fill("#cx-my-agency-other", "Example County Probation");
  await page.selectOption("#cx-my-role", "Chief / Director");
  await page.selectOption("#cx-partner", { label: "Tyler Technologies" });
  await page.selectOption("#cx-partner-role", "Account or Partnerships Manager");
  await page.click('.goal-card[data-goal="establish"]');
  await page.click("#cx-build");
  await page.waitForSelector("#cx-campaign:not([hidden])");
  const vguard = await page.textContent("#cx-guardrails");
  if (!vguard.includes("event sponsor") || !vguard.includes("Art. I §1.C")) throw new Error("vendor guardrail missing for a sponsor partner");
  if (!(await page.inputValue("#cx-draft-1")).includes("not a procurement or purchasing commitment")) throw new Error("vendor draft missing procurement line");
  await page.goto(`http://localhost:${PORT}/terms`);
  if (!(await page.$("#governance")) || !(await page.textContent("#governance ~ ul")).includes("Corporate members")) throw new Error("terms governance section missing");
  await page.goto(`http://localhost:${PORT}/connect`);
  await page.unroute("**/api/agencies");

  // Airtable-edited guidance wins over the built-in defaults: a live API payload with custom
  // category and role content must show up in the support map, the role pickers, and the drafts
  await page.route("**/api/agencies", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    ok: true, source: "airtable",
    nape: { name: "NAPE", contactName: "Test Secretariat", contactEmail: "sec@example.org", contactPhone: "" },
    content: {
      categories: { "Federal Agency": { offers: ["Custom offer from Airtable", "Second custom offer"], wants: ["Custom want from Airtable"], opener: "custom opener from airtable", ask: "custom ask from airtable" } },
      roles: {
        mine: [{ role: "Custom Chief Role", offers: ["Custom role offer one", "Custom role offer two"] }],
        partner: [{ role: "Custom Partner Role", opens: "custom doors from airtable" }]
      }
    },
    agencies: [{ id: "recX", name: "Test Federal Partner", acronym: "TFP", category: "Federal Agency", description: "d", url: "https://example.org" }]
  }) }));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll("#cx-partner option").length >= 2);
  if (!(await page.textContent("#cx-dir-note")).includes("NAPE-edited guidance")) throw new Error("content source note missing");
  if ((await page.$$("#cx-my-role option")).length !== 2 || (await page.$$("#cx-partner-role option")).length !== 2) throw new Error("role pickers not driven by Airtable content");
  await page.selectOption("#cx-my-agency", "__other");
  await page.fill("#cx-my-agency-other", "Example County Probation");
  await page.selectOption("#cx-my-role", "Custom Chief Role");
  await page.selectOption("#cx-partner", { label: "Test Federal Partner (TFP)" });
  await page.selectOption("#cx-partner-role", "Custom Partner Role");
  await page.click('.goal-card[data-goal="establish"]');
  await page.click("#cx-build");
  await page.waitForSelector("#cx-campaign:not([hidden])");
  const support = await page.textContent("#cx-support");
  if (!support.includes("Custom offer from Airtable") || !support.includes("Custom want from Airtable") || !support.includes("Custom role offer one"))
    throw new Error("support map not using Airtable content: " + support.slice(0, 200));
  if (!(await page.textContent("#cx-brief")).includes("custom doors from airtable")) throw new Error("partner role opens-text not from Airtable");
  const introDraft = await page.inputValue("#cx-draft-1");
  if (!introDraft.includes("custom opener from airtable") || !introDraft.includes("custom ask from airtable") || !introDraft.includes("custom role offer one"))
    throw new Error("draft not using Airtable content: " + introDraft.slice(0, 200));
  await page.unroute("**/api/agencies");
  await page.evaluate(() => localStorage.clear());

  // 4. Disclosure pages render with the prototype banner; clear-data works
  for (const p of ["/privacy", "/terms"]) {
    await page.goto(`http://localhost:${PORT}${p}`);
    if (!(await page.$("nav.site-nav"))) throw new Error(p + ": nav missing");
    if (!(await page.$(".proto-banner"))) throw new Error(p + ": prototype banner missing");
  }
  await page.goto(`http://localhost:${PORT}/privacy`);
  await page.evaluate(() => localStorage.setItem("nape_stage_v1", JSON.stringify("self")));
  await page.click("#clear-data"); // dialog auto-accepted above
  const cleared = await page.evaluate(() => localStorage.getItem("nape_stage_v1"));
  if (cleared !== null) throw new Error("clear-data did not wipe localStorage");

  // 5. Every page carries the prototype banner and footer disclosure links
  for (const p of PAGES) {
    await page.goto(`http://localhost:${PORT}${p}`);
    if (!(await page.$(".proto-banner"))) throw new Error(p + ": prototype banner missing");
    if (!(await page.$('footer a[href="/privacy"]'))) throw new Error(p + ": footer privacy link missing");
  }

  // 6. Report and certificate render from localStorage data
  await page.goto(`http://localhost:${PORT}/growth`);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("nape_profile_v1", JSON.stringify({ name: "Pat Example", submitted: true }));
    localStorage.setItem("nape_stage_v1", JSON.stringify("others"));
    localStorage.setItem("nape_goals_v1", JSON.stringify([{
      id: "g1", stage: "others", title: "Build a one-on-one rhythm", createdAt: 1,
      milestones: [
        { id: "m1", text: "Schedule recurring one-on-ones", status: "approved", approvedBy: "Chief Lee", approvedAt: 2 },
        { id: "m2", text: "Run 2 full cycles", status: "planned" }
      ]
    }]));
  });
  await page.goto(`http://localhost:${PORT}/report`);
  const reportText = await page.textContent("#report");
  if (!reportText.includes("Build a one-on-one rhythm") || !reportText.includes("Chief Lee"))
    throw new Error("report page missing plan data");
  if ((await page.inputValue("#r-name")) !== "Pat Example") throw new Error("report name not prefilled");
  await page.goto(`http://localhost:${PORT}/certificate`);
  if ((await page.inputValue("#c-name-input")) !== "Pat Example") throw new Error("certificate name not prefilled");
  const certText = await page.textContent("#cert");
  if (!certText.includes("Lead Others") || !certText.includes("1 of 2 milestones approved"))
    throw new Error("certificate not reflecting stage progress: " + certText.slice(0, 200));
  await page.evaluate(() => localStorage.clear());

  // 7. Unknown paths get the 404 page — styled even at nested paths
  await page.goto(`http://localhost:${PORT}/definitely-not-a-page`);
  if (!(await page.textContent("body")).includes("404")) throw new Error("404 page not served");
  await page.goto(`http://localhost:${PORT}/programs/2026`);
  const navPos = await page.evaluate(() => getComputedStyle(document.querySelector(".site-nav")).position);
  if (navPos !== "sticky") throw new Error("404 page assets don't resolve at nested paths");

  if (errors.length) throw new Error("page errors:\n" + errors.join("\n"));
  console.log("smoke: all checks passed");
  await browser.close();
  server.close();
  process.exit(0);
})().catch(e => { console.error("smoke FAILED:", e.message); process.exit(1); });
