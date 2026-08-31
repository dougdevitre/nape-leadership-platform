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

const PAGES = ["/", "/journey", "/growth", "/reflections", "/resources", "/connect"];

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

  // 4. Unknown paths get the 404 page
  await page.goto(`http://localhost:${PORT}/definitely-not-a-page`);
  if (!(await page.textContent("body")).includes("404")) throw new Error("404 page not served");

  if (errors.length) throw new Error("page errors:\n" + errors.join("\n"));
  console.log("smoke: all checks passed");
  await browser.close();
  server.close();
  process.exit(0);
})().catch(e => { console.error("smoke FAILED:", e.message); process.exit(1); });
