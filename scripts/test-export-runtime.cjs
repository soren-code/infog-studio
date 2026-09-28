/*
 * Regression tests for assets/export-runtime.js
 *
 * Run (from any scratch folder, nothing here is shipped to the page):
 *   npm i jsdom@24 jszip@3.10.1
 *   NODE_PATH=$PWD/node_modules node <skill>/scripts/test-export-runtime.cjs
 *
 * These tests use jsdom and stubs, so they verify the save cascade, error
 * handling, ZIP contents and project packaging. They do NOT prove pixel
 * output: html2canvas needs a real browser, so eyeball one PNG after any
 * change to buildStage()/renderSlideToBlob().
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const JSZip = require("jszip");

const RUNTIME = fs.readFileSync(path.join(__dirname, "..", "assets", "export-runtime.js"), "utf8");

const openWindows = [];
test.after(() => openWindows.forEach((w) => { try { w.close(); } catch (e) {} }));

const PAGE = `<!doctype html>
<html data-ratio="4:5"><head><title>t</title>
<style id="infog-styles">.infographic-canvas{color:red}</style></head>
<body>
<main id="infog-root" data-infog-dynamic>
  <div class="wrap"><div class="infographic-canvas" data-infog-canvas>Slide A</div></div>
  <div class="wrap" hidden><div class="infographic-canvas" data-infog-canvas>Slide B</div></div>
  <div class="wrap" hidden><div class="infographic-canvas" data-infog-canvas>Slide C</div></div>
</main>
<div data-infog-status></div>
<script id="infog-export"></script>
<script id="infog-app">/* app code */ window.__appRan = true;</script>
</body></html>`;

function makeWindow(framed) {
  const opts = { runScripts: "outside-only", pretendToBeVisual: true };
  if (!framed) {
    const w = new JSDOM(PAGE, opts).window;
    openWindows.push(w);
    return w;
  }
  // A real nested browsing context: window.top !== window.self inside it.
  const parent = new JSDOM("<!doctype html><body><iframe></iframe></body>", opts);
  openWindows.push(parent.window);
  const w = parent.window.document.querySelector("iframe").contentWindow;
  w.document.open(); w.document.write(PAGE); w.document.close();
  return w;
}

function makeEnv({ claude, framed = false, touch = false, share, canShare } = {}) {
  const w = makeWindow(framed);
  assert.equal(w.self !== w.top, framed, "harness: framed flag must match window.top");
  w.document.getElementById("infog-export").textContent = RUNTIME;

  w.URL.createObjectURL = () => "blob:mock-" + Math.random().toString(36).slice(2);
  w.URL.revokeObjectURL = () => {};
  w.JSZip = JSZip;
  w.matchMedia = () => ({ matches: touch });
  const clicks = [];
  w.HTMLAnchorElement.prototype.click = function () { clicks.push({ href: this.href, download: this.download }); };
  if (share) {
    Object.defineProperty(w.navigator, "share", { value: share, configurable: true });
    Object.defineProperty(w.navigator, "canShare", { value: canShare || (() => true), configurable: true });
  }
  if (claude) w.claude = claude;
  w.eval(RUNTIME);
  return { w, clicks, statuses: [] };
}

function downloadsCap(behaviour) {
  const calls = [];
  const cap = {
    save: async (req) => {
      calls.push(req);
      if (behaviour) return behaviour(req);
      return { status: "saved" };
    }
  };
  return { calls, claude: { use: async (name) => (name === "downloads" ? cap : null) } };
}

// Bytes, not Blob: JSZip reads Blob inputs with FileReader, which Node lacks.
// (Real html2canvas output is a Blob; JSZip supports that in browsers.)
const pngBlob = (tag) => new TextEncoder().encode("PNG-" + tag);

function exporter(env, extra = {}) {
  return env.w.InfoGExport.create(Object.assign({
    name: "My Project",
    preload: false,
    getActiveIndex: () => 0,
    renderSlide: async (el) => pngBlob(el.textContent),
    onStatus: (s) => env.statuses.push(s)
  }, extra));
}

/* ------------------------------------------------------------------ */

test("published artifact: PNG goes through downloads.save with a PNG filename", async () => {
  const { calls, claude } = downloadsCap();
  const env = makeEnv({ claude });
  const blob = new Blob([Buffer.from("PNG-real")], { type: "image/png" });
  const r = await exporter(env, { renderSlide: async () => blob }).exportCurrentPNG();
  assert.equal(r.ok, true);
  assert.equal(r.saved, true);
  assert.equal(r.method, "downloads");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].filename, "slide-01.png");
  assert.equal(calls[0].data, blob, "the rendered Blob is handed to the capability untouched");
  assert.equal(env.clicks.length, 0, "must not fall back to <a download> when the capability works");
});

test("viewer declines the save prompt: cancelled, no fallback, no panel", async () => {
  const { claude } = downloadsCap(() => { throw { code: "declined", message: "no" }; });
  const env = makeEnv({ claude });
  const r = await exporter(env).exportCurrentPNG();
  assert.equal(r.ok, false);
  assert.equal(r.cancelled, true);
  assert.equal(env.clicks.length, 0);
  assert.equal(env.w.document.querySelector("[data-infog-fallback]"), null);
  assert.equal(env.statuses.at(-1).level, "info");
});

test("rate_limited and too_large give actionable errors and do not fall back", async () => {
  for (const [code, needle] of [["rate_limited", "prompt is already open"], ["too_large", "too large"]]) {
    const { claude } = downloadsCap(() => { throw { code, message: code }; });
    const env = makeEnv({ claude });
    const r = await exporter(env).exportCurrentPNG();
    assert.equal(r.ok, false);
    assert.equal(r.code, code);
    assert.match(r.message, new RegExp(needle));
    assert.equal(env.clicks.length, 0);
  }
});

test("extension_not_enabled on ZIP stops and points to single PNG export", async () => {
  const { claude } = downloadsCap(() => { throw { code: "extension_not_enabled", message: "x" }; });
  const env = makeEnv({ claude });
  const r = await exporter(env).exportAllZip();
  assert.equal(r.ok, false);
  assert.match(r.message, /ZIP downloads aren't enabled/);
  assert.match(r.message, /PNG/);
  assert.equal(env.w.document.querySelector("[data-infog-fallback]"), null);
});

test("capability 'unavailable' falls through to the Save panel when framed", async () => {
  const { claude } = downloadsCap(() => { throw { code: "unavailable", message: "x" }; });
  const env = makeEnv({ claude, framed: true });
  const r = await exporter(env).exportCurrentPNG();
  assert.equal(r.ok, true);
  assert.equal(r.saved, false, "panel must not claim the file was saved");
  assert.equal(r.method, "panel");
  const panel = env.w.document.querySelector("[data-infog-fallback]");
  assert.ok(panel, "Save panel should be shown");
  assert.ok(panel.querySelector("img"), "PNG preview for long-press / right-click save");
  assert.ok(panel.querySelector("a[download='slide-01.png']"));
  assert.ok(panel.querySelector("a[target=_blank]"));
});

test("no capability + framed page: Save panel, never a silent <a download>", async () => {
  const env = makeEnv({ framed: true });
  const r = await exporter(env).exportCurrentPNG();
  assert.equal(r.method, "panel");
  assert.equal(env.clicks.length, 0);
  assert.ok(env.w.document.querySelector("[data-infog-fallback]"));
});

test("Escape closes the Save panel and removes it from the DOM", async () => {
  const env = makeEnv({ framed: true });
  await exporter(env).exportCurrentPNG();
  env.w.document.dispatchEvent(new env.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(env.w.document.querySelector("[data-infog-fallback]"), null);
});

test("no capability + top-level page: <a download> with the right filename, honest wording", async () => {
  const env = makeEnv();
  const r = await exporter(env).exportCurrentPNG();
  assert.equal(r.method, "anchor");
  assert.equal(r.saved, false);
  assert.equal(env.clicks.length, 1);
  assert.equal(env.clicks[0].download, "slide-01.png");
  assert.doesNotMatch(r.message, /\bdownloaded\b|\bSaved\b/);
  const last = env.statuses.at(-1);
  assert.equal(last.action.label, "Open / Save");
  last.action.run();
  assert.ok(env.w.document.querySelector("[data-infog-fallback]"), "Open / Save action opens the panel");
});

test("touch device with file sharing uses Web Share and reports it", async () => {
  const shared = [];
  const env = makeEnv({ touch: true, framed: true, share: async (d) => { shared.push(d); } });
  const opts = { renderSlide: async () => new env.w.Blob(["x"], { type: "image/png" }) };
  const r = await exporter(env, opts).exportCurrentPNG();
  assert.equal(r.method, "share");
  assert.equal(shared.length, 1);
  assert.equal(shared[0].files[0].name, "slide-01.png");
});

test("share dismissed = cancelled; share blocked (NotAllowedError) falls to panel", async () => {
  let env = makeEnv({ touch: true, framed: true, share: async () => { throw { name: "AbortError" }; } });
  let opts = { renderSlide: async () => new env.w.Blob(["x"], { type: "image/png" }) };
  let r = await exporter(env, opts).exportCurrentPNG();
  assert.equal(r.cancelled, true);
  assert.equal(env.w.document.querySelector("[data-infog-fallback]"), null);

  env = makeEnv({ touch: true, framed: true, share: async () => { throw { name: "NotAllowedError" }; } });
  opts = { renderSlide: async () => new env.w.Blob(["x"], { type: "image/png" }) };
  r = await exporter(env, opts).exportCurrentPNG();
  assert.equal(r.method, "panel");
  assert.ok(env.w.document.querySelector("[data-infog-fallback]"));
});

test("desktop never opens a share sheet even if the API exists", async () => {
  let called = 0;
  const env = makeEnv({ touch: false, framed: true, share: async () => { called++; } });
  const opts = { renderSlide: async () => new env.w.Blob(["x"], { type: "image/png" }) };
  await exporter(env, opts).exportCurrentPNG();
  assert.equal(called, 0);
});

test("batch export makes ONE ZIP and ONE save prompt with slide-01..03.png inside", async () => {
  const { calls, claude } = downloadsCap();
  const env = makeEnv({ claude });
  const r = await exporter(env).exportAllZip();
  assert.equal(r.ok, true);
  assert.equal(calls.length, 1, "one prompt, not one per slide");
  assert.equal(calls[0].filename, "my-project-slides.zip");
  const zip = await JSZip.loadAsync(await calls[0].data.arrayBuffer());
  assert.deepEqual(Object.keys(zip.files).sort(), ["slide-01.png", "slide-02.png", "slide-03.png"]);
  assert.equal(await zip.file("slide-02.png").async("string"), "PNG-Slide B");
  const msgs = env.statuses.map((s) => s.message);
  assert.ok(msgs.includes("Exporting 1 / 3..."));
  assert.ok(msgs.includes("Exporting 3 / 3..."));
});

test("slide filenames get wider padding past 99 slides", async () => {
  const { calls, claude } = downloadsCap();
  const env = makeEnv({ claude });
  const doc = env.w.document;
  const root = doc.getElementById("infog-root");
  for (let i = 0; i < 100; i++) { const d = doc.createElement("div"); d.setAttribute("data-infog-canvas", ""); d.textContent = "s" + i; root.appendChild(d); }
  await exporter(env, { getActiveIndex: () => 5 }).exportCurrentPNG();
  assert.equal(calls[0].filename, "slide-006.png");
});

test("render failure surfaces a visible, actionable error and unlocks the exporter", async () => {
  const { claude } = downloadsCap();
  const env = makeEnv({ claude });
  let fail = true;
  const ex = exporter(env, { renderSlide: async (el) => { if (fail) throw new Error("boom"); return pngBlob("ok"); } });
  const r1 = await ex.exportCurrentPNG();
  assert.equal(r1.ok, false);
  assert.match(r1.message, /PNG export failed\. Try again after the slide finishes rendering\. \(boom\)/);
  assert.equal(env.statuses.at(-1).level, "error");
  fail = false;
  const r2 = await ex.exportCurrentPNG();
  assert.equal(r2.ok, true, "busy flag must reset after a failure");
});

test("a second click during an export is ignored (only one save prompt at a time)", async () => {
  const { claude } = downloadsCap();
  const env = makeEnv({ claude });
  let release;
  const gate = new Promise((res) => { release = res; });
  const ex = exporter(env, { renderSlide: async () => { await gate; return pngBlob("g"); } });
  const first = ex.exportCurrentPNG();
  const second = await ex.exportCurrentPNG();
  assert.equal(second.code, "busy");
  release();
  assert.equal((await first).ok, true);
});

test("source project ZIP is reconstructable: index/styles/script/manifest/README/project.json", async () => {
  const { calls, claude } = downloadsCap();
  const env = makeEnv({ claude });
  const doc = env.w.document;
  // simulate an export stage and a fallback panel lying around in the live DOM
  const stage = doc.createElement("div"); stage.setAttribute("data-infog-export-stage", ""); doc.body.appendChild(stage);
  const ex = exporter(env, { getProject: () => ({ name: "My Project", ratio: "4:5", slides: [{ title: "A" }] }) });
  await ex.exportCurrentPNG(); // leaves text in the status element
  const r = await ex.exportProjectZip();
  assert.equal(r.ok, true);
  const call = calls.at(-1);
  assert.equal(call.filename, "my-project-project.zip");
  const zip = await JSZip.loadAsync(await call.data.arrayBuffer());
  const names = Object.keys(zip.files);
  for (const f of ["index.html", "styles.css", "script.js", "manifest.json", "README.md", ".gitignore", "project.json"]) {
    assert.ok(names.includes("my-project/" + f), "missing " + f);
  }
  const html = await zip.file("my-project/index.html").async("string");
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<link rel="stylesheet" href="styles\.css">/);
  assert.match(html, /<script src="script\.js"><\/script>/);
  assert.doesNotMatch(html, /id="infog-styles"|id="infog-app"|id="infog-export"/, "inline blocks replaced");
  assert.doesNotMatch(html, /data-infog-export-stage|data-infog-fallback/);
  assert.doesNotMatch(html, /Slide A|Slide B/, "JS-rendered containers start empty");
  assert.doesNotMatch(html, /Exporting|Rendering slide|Packing/, "status text must not leak into the source");
  assert.equal(await zip.file("my-project/styles.css").async("string"), ".infographic-canvas{color:red}");
  const js = await zip.file("my-project/script.js").async("string");
  assert.ok(js.indexOf("InfoG Studio export runtime") !== -1 && js.indexOf("__appRan") > js.indexOf("InfoG Studio export runtime"),
    "runtime must precede the app script");
  const manifest = JSON.parse(await zip.file("my-project/manifest.json").async("string"));
  assert.deepEqual([manifest.slug, manifest.slides, manifest.ratio, manifest.entry], ["my-project", 3, "4:5", "index.html"]);
  assert.match(await zip.file("my-project/README.md").async("string"), /html2canvas 1\.4\.1 and JSZip 3\.10\.1/);
  assert.equal(JSON.parse(await zip.file("my-project/project.json").async("string")).slides[0].title, "A");
});

test("loadLib tries cdnjs first, falls back to jsDelivr, then reports failure", async () => {
  const env = makeEnv();
  const doc = env.w.document;
  const tried = [];
  const realAppend = doc.head.appendChild.bind(doc.head);
  doc.head.appendChild = (node) => {
    if (node.tagName === "SCRIPT" && node.src) {
      tried.push(node.src);
      setTimeout(() => {
        if (node.src.includes("jsdelivr") && node.src.includes("html2canvas")) { env.w.html2canvas = () => {}; node.onload(); }
        else node.onerror();
      }, 0);
      return node;
    }
    return realAppend(node);
  };
  await env.w.InfoGExport.loadLib("html2canvas");
  assert.match(tried[0], /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/html2canvas\/1\.4\.1\//);
  assert.match(tried[1], /^https:\/\/cdn\.jsdelivr\.net\/npm\/html2canvas@1\.4\.1\//);
  await assert.rejects(() => env.w.InfoGExport.loadLib("JSZipMissing"), /could not be loaded/);
});

test("hasDownloadsCapability reflects the runtime", async () => {
  const yes = makeEnv({ claude: downloadsCap().claude });
  assert.equal(await exporter(yes).hasDownloadsCapability(), true);
  const no = makeEnv();
  assert.equal(await exporter(no).hasDownloadsCapability(), false);
});

test("runtime source is safe to inline in an HTML script element", () => {
  assert.doesNotMatch(RUNTIME, /<\/script/i, "a literal closing script tag would end the page's script early");
  assert.doesNotMatch(RUNTIME, /<!--/, "HTML comment openers change script parsing");
  assert.doesNotMatch(RUNTIME, /<script/i, "no opening script tags either (double-escaped state)");
});
