/*
 * Real-browser end-to-end check for assets/export-runtime.js
 *
 * Launches headless Chromium, inlines the runtime into a realistic carousel page
 * (following the page contract in SKILL.md), mocks the `downloads` capability
 * exactly as documented in the runtime's type definitions, and verifies:
 * exact PNG dimensions for 1:1 / 4:5 / 9:16 (also with devicePixelRatio 2),
 * real pixels (background, text, SVG chart, hidden-wrapper slides), one save
 * prompt for the batch ZIP, the source ZIP running standalone, the Save panel in
 * a same-origin sandboxed frame WITHOUT the capability, and the actionable error
 * in a strict opaque-origin sandbox.
 *
 * Run from a scratch folder (nothing here ships inside the page):
 *   npm i puppeteer-core@23 @sparticuz/chromium@131 html2canvas@1.4.1 jszip@3.10.1
 *   NODE_PATH=$PWD/node_modules node <skill>/scripts/e2e-browser-check.cjs
 * Exit code 0 = all checks passed. Rendered PNGs are written to the OS temp dir.
 *
 * Not covered: the real claude.ai host confirmation prompt (mocked), iOS/Android
 * share-sheet behaviour, and fetching the CDN copies of the libraries.
 */
const os = require("os");
const path = require("path");
const fs = require("fs");
const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const JSZip = require("jszip");

const RUNTIME = fs.readFileSync(path.join(__dirname, "..", "assets", "export-runtime.js"), "utf8");
const OUT = os.tmpdir();
const H2C = require.resolve("html2canvas/dist/html2canvas.min.js");
const JSZ = require.resolve("jszip/dist/jszip.min.js");

const PAGE = `<!doctype html>
<html data-ratio="4:5" data-theme="modern"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>E2E</title>
<style id="infog-styles">
:root{--canvas-ratio:4/5;--color-bg:#0e1623;--color-surface:#141e2e;--color-text:#f4f7fb;--color-muted:#aeb9c9;--color-accent:#29d17f}
html[data-ratio="1:1"]{--canvas-ratio:1/1}
html[data-ratio="9:16"]{--canvas-ratio:9/16}
body{margin:0;background:#000;font-family:system-ui,sans-serif}
#preview{width:360px;margin:0 auto}
.infographic-canvas{container-type:inline-size;aspect-ratio:var(--canvas-ratio);width:100%;background:var(--color-bg);color:var(--color-text);position:relative;overflow:hidden;display:flex;flex-direction:column;padding:6cqw;box-sizing:border-box;gap:3cqw}
.kicker{font-size:3.2cqw;color:var(--color-accent);letter-spacing:.2em;text-transform:uppercase}
.title{font-size:9cqw;font-weight:800;line-height:1.05;margin:0}
.card{background:var(--color-surface);border-radius:3cqw;padding:4cqw;font-size:4cqw}
.chart{width:100%}
.num{margin-top:auto;font-size:3cqw;color:var(--color-muted)}
</style></head><body>
<div id="preview" data-infog-dynamic></div>
<div data-infog-status></div>
<button id="png">PNG</button><button id="zip">ZIP</button><button id="src">SRC</button>
<script id="infog-export">${RUNTIME}</script>
<script id="infog-app">
(function(){
  var state = { i: 0 };
  var slides = [
    {kicker:"Excel tips", title:"Stop typing formulas twice", body:"One habit that saves an hour a week."},
    {kicker:"Data", title:"Sales by region", chart:true},
    {kicker:"Next", title:"Save this post", body:"Follow for day 2."}
  ];
  var root = document.getElementById("preview");
  root.innerHTML = slides.map(function(s, i){
    var chart = s.chart ? '<svg class="chart" viewBox="0 0 400 160" role="img" aria-label="Sales chart"><rect x="10" y="20" width="300" height="30" style="fill:var(--color-accent)"/><rect x="10" y="70" width="200" height="30" style="fill:var(--color-accent)"/><rect x="10" y="120" width="120" height="30" style="fill:var(--color-muted)"/></svg>' : '';
    return '<div class="slide-wrap"' + (i ? ' hidden' : '') + '><section class="infographic-canvas" data-infog-canvas>' +
      '<div class="kicker">' + s.kicker + '</div><h1 class="title">' + s.title + '</h1>' +
      (s.body ? '<div class="card">' + s.body + '</div>' : '') + chart +
      '<div class="num">0' + (i+1) + ' / 03</div></section></div>';
  }).join("");
  var ex = InfoGExport.create({ name: "E2E Demo", getActiveIndex: function(){ return state.i; },
    getProject: function(){ return { name:"E2E Demo", ratio:"4:5", theme:"modern", slides: slides }; } });
  window.__ex = ex; window.__state = state;
  document.getElementById("png").onclick = function(){ ex.exportCurrentPNG(); };
  document.getElementById("zip").onclick = function(){ ex.exportAllZip(); };
  document.getElementById("src").onclick = function(){ ex.exportProjectZip(); };
})();
</script></body></html>`;

const MOCK = `
window.__saves = [];
window.claude = { use: async function(n){ return n === "downloads" ? { save: async function(req){
  var buf = req.data instanceof Blob ? await req.data.arrayBuffer() : req.data;
  var b64 = await new Promise(function(r){ var fr = new FileReader(); fr.onload = function(){ r(fr.result.split(",")[1]); }; fr.readAsDataURL(new Blob([buf])); });
  window.__saves.push({ filename: req.filename, b64: b64 });
  return { status: "saved" };
} } : null; } };`;

const dims = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), sig: buf.subarray(1, 4).toString() });
let failures = 0;
const check = (ok, msg) => { console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) failures++; };

async function pixelStats(page, b64) {
  return page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext("2d"); ctx.drawImage(bmp, 0, 0);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    let light = 0, accent = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] > 200 && px[i+1] > 200 && px[i+2] > 200 && px[i+3] > 200) light++;
      if (Math.abs(px[i]-41) < 12 && Math.abs(px[i+1]-209) < 12 && Math.abs(px[i+2]-127) < 12) accent++;
    }
    const corner = Array.from(ctx.getImageData(4, 4, 1, 1).data);
    return { w: c.width, h: c.height, light, accent, corner };
  }, b64);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: "shell" });
  const page = await browser.newPage();
  page.on("pageerror", e => { console.log("PAGE ERROR:", e.message); failures++; });
  await page.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 }); // DPR 2 must NOT change output size
  await page.evaluateOnNewDocument(MOCK);
  await page.setRequestInterception(true);
  page.on("request", (r) => r.url() === "http://app.local/"
    ? r.respond({ status: 200, contentType: "text/html", body: PAGE }) : r.abort());
  await page.goto("http://app.local/", { waitUntil: "load" });
  await page.addScriptTag({ path: H2C });
  await page.addScriptTag({ path: JSZ });

  check(await page.evaluate(() => typeof InfoGExport === "object" && typeof window.__ex.exportAllZip === "function"),
        "runtime parsed inline in a real page (no early script termination)");
  check(await page.evaluate(() => window.__ex.hasDownloadsCapability()), "downloads capability detected");

  const click = async (id) => { const n = (await page.evaluate(() => window.__saves.length));
    await page.click("#" + id);
    await page.waitForFunction((n) => window.__saves.length > n, { timeout: 60000 }, n);
    return page.evaluate(() => window.__saves[window.__saves.length - 1]); };

  // --- single PNG, 4:5, DPR 2 ---
  let save = await click("png");
  let buf = Buffer.from(save.b64, "base64");
  let d = dims(buf);
  check(save.filename === "slide-01.png", "filename slide-01.png (got " + save.filename + ")");
  check(d.sig === "PNG" && d.w === 1080 && d.h === 1350, `4:5 => 1080x1350 despite devicePixelRatio 2 (got ${d.w}x${d.h})`);
  let st = await pixelStats(page, save.b64);
  check(st.corner[0] === 14 && st.corner[1] === 22 && st.corner[2] === 35, "background painted (corner rgb " + st.corner.slice(0,3) + ")");
  check(st.light > 3000, "headline text rendered (light px " + st.light + ")");
  check(st.accent > 500, "accent kicker rendered (accent px " + st.accent + ")");
  fs.writeFileSync(path.join(OUT, "infog-e2e-slide-01.png"), buf);

  // --- slide 2 lives in a hidden wrapper; must still render with the SVG chart ---
  await page.evaluate(() => { window.__state.i = 1; });
  save = await click("png");
  buf = Buffer.from(save.b64, "base64"); st = await pixelStats(page, save.b64);
  check(save.filename === "slide-02.png", "slide-02.png from a hidden wrapper");
  check(st.accent > 20000, "SVG bar chart rendered on hidden-wrapper slide (accent px " + st.accent + ")");
  fs.writeFileSync(path.join(OUT, "infog-e2e-slide-02.png"), buf);

  // --- other ratios ---
  for (const [ratio, w, h] of [["1:1", 1080, 1080], ["9:16", 1080, 1920]]) {
    await page.evaluate((r) => { document.documentElement.setAttribute("data-ratio", r); window.__state.i = 0; }, ratio);
    save = await click("png");
    const dd = dims(Buffer.from(save.b64, "base64"));
    check(dd.w === w && dd.h === h, `${ratio} => ${w}x${h} (got ${dd.w}x${dd.h})`);
    if (ratio === "9:16") fs.writeFileSync(path.join(OUT, "infog-e2e-slide-916.png"), Buffer.from(save.b64, "base64"));
  }
  await page.evaluate(() => document.documentElement.setAttribute("data-ratio", "4:5"));

  // --- batch ZIP: one prompt, three PNGs ---
  const before = await page.evaluate(() => window.__saves.length);
  save = await click("zip");
  check((await page.evaluate(() => window.__saves.length)) === before + 1, "batch export = exactly one save prompt");
  check(save.filename === "e2e-demo-slides.zip", "zip filename (got " + save.filename + ")");
  let zip = await JSZip.loadAsync(Buffer.from(save.b64, "base64"));
  check(JSON.stringify(Object.keys(zip.files).sort()) === JSON.stringify(["slide-01.png","slide-02.png","slide-03.png"]), "zip holds slide-01..03.png");
  for (const n of ["slide-01.png","slide-02.png","slide-03.png"]) {
    const dd = dims(await zip.file(n).async("nodebuffer"));
    check(dd.w === 1080 && dd.h === 1350, `${n} is 1080x1350`);
  }
  const status = await page.evaluate(() => document.querySelector("[data-infog-status]").textContent);
  check(/Saved e2e-demo-slides\.zip/.test(status), "visible success status: " + JSON.stringify(status.trim()));

  // --- source ZIP ---
  save = await click("src");
  zip = await JSZip.loadAsync(Buffer.from(save.b64, "base64"));
  const names = Object.keys(zip.files).filter(n => !n.endsWith("/"));
  check(["index.html","styles.css","script.js","manifest.json","README.md","project.json"].every(f => names.includes("e2e-demo/" + f)), "source zip files: " + names.join(", "));
  const html = await zip.file("e2e-demo/index.html").async("string");
  check(!/Stop typing formulas/.test(html) && /<div id="preview" data-infog-dynamic=""><\/div>/.test(html), "index.html has empty dynamic container");
  check(!/data-infog-export-stage/.test(html), "no export stage leaked");

  // --- run the extracted source project standalone in a fresh page ---
  const sp = await browser.newPage();
  await sp.setViewport({ width: 420, height: 900 });
  const files = {};
  for (const n of names) files[n.replace("e2e-demo/", "")] = await zip.file(n).async("string");
  await sp.setRequestInterception(true);
  sp.on("request", (r) => {
    const u = new URL(r.url());
    if (u.protocol === "http:" && u.hostname === "project.local") {
      const f = files[u.pathname.slice(1) || "index.html"];
      return f == null ? r.respond({ status: 404, body: "nf" }) :
        r.respond({ status: 200, contentType: u.pathname.endsWith(".css") ? "text/css" : u.pathname.endsWith(".js") ? "text/javascript" : "text/html", body: f });
    }
    r.abort();
  });
  await sp.goto("http://project.local/index.html", { waitUntil: "load" });
  const rebuilt = await sp.evaluate(() => ({ slides: document.querySelectorAll("[data-infog-canvas]").length, hasRuntime: typeof InfoGExport === "object",
    bg: getComputedStyle(document.querySelector("[data-infog-canvas]")).backgroundColor }));
  check(rebuilt.slides === 3 && rebuilt.hasRuntime && rebuilt.bg === "rgb(14, 22, 35)", "extracted source project runs standalone: " + JSON.stringify(rebuilt));
  await sp.close();

  // --- the user's actual environment: sandboxed frame, NO downloads capability ---
  const host = await browser.newPage();
  await host.setViewport({ width: 500, height: 900 });
  const srcdoc = PAGE.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  await host.setContent(`<iframe id="f" sandbox="allow-scripts allow-same-origin" style="width:480px;height:800px" srcdoc="${srcdoc}"></iframe>`);
  const frame = host.frames().find(f => f !== host.mainFrame());
  await frame.addScriptTag({ path: H2C });
  await frame.addScriptTag({ path: JSZ });
  console.log("frame sandbox probe:", JSON.stringify(await frame.evaluate(() => ({
    runtime: typeof InfoGExport, h2c: typeof html2canvas, cap: typeof (window.claude && window.claude.use), framed: window.self !== window.top }))));
  await frame.click("#png");
  try { await frame.waitForSelector("[data-infog-fallback] img", { timeout: 30000 }); }
  catch (e) { console.log("STATUS AT TIMEOUT:", JSON.stringify(await frame.evaluate(() => document.querySelector("[data-infog-status]").textContent))); throw e; }
  const panel = await frame.evaluate(async () => {
    const img = document.querySelector("[data-infog-fallback] img");
    await img.decode().catch(() => {});
    return { w: img.naturalWidth, h: img.naturalHeight,
      links: Array.from(document.querySelectorAll("[data-infog-fallback] a")).map(a => a.textContent),
      status: document.querySelector("[data-infog-status]").textContent };
  });
  check(panel.w === 1080 && panel.h === 1350, `sandboxed frame w/o capability: Save panel shows the real PNG (${panel.w}x${panel.h})`);
  check(panel.links.includes("Download") && panel.links.includes("Open in new tab"), "panel offers Download + Open links: " + panel.links.join(", "));
  check(!/downloaded/i.test(panel.status), "status never claims 'downloaded': " + JSON.stringify(panel.status.trim()));

  // --- strict opaque-origin sandbox: html2canvas cannot run; error must be visible + actionable ---
  const host2 = await browser.newPage();
  await host2.setContent(`<iframe sandbox="allow-scripts" style="width:480px;height:800px" srcdoc="${srcdoc}"></iframe>`);
  const f2 = host2.frames().find(f => f !== host2.mainFrame());
  await f2.addScriptTag({ path: H2C }); await f2.addScriptTag({ path: JSZ });
  await f2.click("#png");
  await f2.waitForFunction(() => /failed/.test(document.querySelector("[data-infog-status]").textContent), { timeout: 30000 });
  const strict = await f2.evaluate(() => document.querySelector("[data-infog-status]").textContent);
  check(/PNG export failed/.test(strict) && /own browser tab/.test(strict), "strict sandbox: visible, actionable error: " + JSON.stringify(strict.trim().slice(0, 150)));

  await browser.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL E2E CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error("E2E CRASH:", e); process.exit(2); });
