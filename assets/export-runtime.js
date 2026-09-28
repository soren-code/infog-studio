/*!
 * InfoG Studio export runtime v2.0.0
 *
 * Paste this file VERBATIM into the page's inline script block with id
 * "infog-export", placed before the app script block with id "infog-app".
 * (Keep the source free of the two-character sequences that close a script
 * element or open an HTML comment; a test enforces this.)
 *
 * Why this exists: a published Claude Artifact runs inside a sandboxed frame.
 * <a download>, blob-URL clicks and FileSaver-style saves are inert there, which
 * is what produces "File downloads aren't available for this artifact." The
 * supported path is the `downloads` runtime capability
 * (claude.use("downloads").save({filename, data})), which the page must also
 * declare when it is published: capabilities: {downloads: true}.
 *
 * Save order (first that applies wins):
 *   1. downloads capability (published artifact; viewer confirms the save)
 *   2. Web Share API with a File (touch devices only)
 *   3. <a download> (only when the page is top-level, i.e. not framed)
 *   4. On-page Save panel: preview + Download / Open / Share / Copy image
 *
 * No dependencies of its own. html2canvas and JSZip are loaded lazily from
 * hosts the published-page CSP allows (cdnjs first, jsDelivr second).
 */
(function (global) {
  "use strict";

  var VERSION = "2.0.0";

  var LIBS = {
    html2canvas: [
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
      "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"
    ],
    JSZip: [
      "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
      "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"
    ]
  };

  var TARGETS = {
    "1:1": { width: 1080, height: 1080 },
    "4:5": { width: 1080, height: 1350 },
    "9:16": { width: 1080, height: 1920 }
  };

  var MIME = { png: "image/png", zip: "application/zip" };

  /* ---------- small helpers ---------- */

  function pad(n, total) {
    var width = Math.max(2, String(total).length);
    var s = String(n);
    while (s.length < width) s = "0" + s;
    return s;
  }

  function slugify(text) {
    var s = String(text || "infog-studio").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s || "infog-studio";
  }

  function mimeFor(filename) {
    var m = /\.([a-z0-9]+)$/i.exec(filename);
    return (m && MIME[m[1].toLowerCase()]) || "application/octet-stream";
  }

  function nextFrame() {
    // rAF is paused in background tabs, so never wait on it alone.
    return new Promise(function (resolve) {
      var done = false;
      function finish() { if (!done) { done = true; resolve(); } }
      if (global.requestAnimationFrame) global.requestAnimationFrame(finish);
      setTimeout(finish, 100);
    });
  }

  function isFramed() {
    try { return global.self !== global.top; } catch (e) { return true; }
  }

  function isTouchPrimary() {
    try { return !!global.matchMedia && global.matchMedia("(pointer: coarse)").matches; }
    catch (e) { return false; }
  }

  function canShareFile(file) {
    try {
      var nav = global.navigator;
      return !!(file && nav && nav.share && nav.canShare && nav.canShare({ files: [file] }));
    } catch (e) { return false; }
  }

  /* ---------- lazy library loading ---------- */

  function loadLib(name) {
    if (global[name]) return Promise.resolve(global[name]);
    var urls = (LIBS[name] || []).slice();
    return new Promise(function (resolve, reject) {
      (function next() {
        if (!urls.length) {
          reject(new Error(name + " could not be loaded from any CDN."));
          return;
        }
        var s = global.document.createElement("script");
        s.src = urls.shift();
        s.async = true;
        s.onload = function () { global[name] ? resolve(global[name]) : next(); };
        s.onerror = function () { if (s.remove) s.remove(); next(); };
        global.document.head.appendChild(s);
      })();
    });
  }

  /* ---------- rendering (html2canvas) ---------- */

  async function waitForAssets(scope) {
    var doc = global.document;
    if (doc.fonts && doc.fonts.ready) { try { await doc.fonts.ready; } catch (e) {} }
    var imgs = Array.prototype.slice.call(scope.querySelectorAll("img"));
    await Promise.all(imgs.map(function (img) {
      if (img.complete) return null;
      return new Promise(function (resolve) {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    }));
  }

  function buildStage(el, size) {
    // Render from an off-screen clone at the exact target pixel size so the
    // PNG never depends on the on-screen preview scale or scroll position.
    var stage = global.document.createElement("div");
    stage.setAttribute("data-infog-export-stage", "");
    stage.setAttribute("aria-hidden", "true");
    stage.style.cssText = "position:absolute;left:-99999px;top:0;overflow:hidden;pointer-events:none;" +
      "width:" + size.width + "px;height:" + size.height + "px;";
    var clone = el.cloneNode(true);
    clone.style.width = size.width + "px";
    clone.style.height = size.height + "px";
    clone.style.maxWidth = "none";
    clone.style.margin = "0";
    clone.style.aspectRatio = "auto";
    clone.style.transform = "none";
    stage.appendChild(clone);
    return stage;
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        blob ? resolve(blob) : reject(new Error("The canvas produced no image (out of memory or tainted by a remote image)."));
      }, "image/png");
    });
  }

  async function renderSlideToBlob(el, size) {
    var html2canvas = await loadLib("html2canvas");
    var stage = buildStage(el, size);
    global.document.body.appendChild(stage);
    try {
      await waitForAssets(stage);
      await nextFrame();
      await nextFrame();
      var canvas = await html2canvas(stage.firstElementChild, {
        width: size.width,
        height: size.height,
        windowWidth: size.width,
        windowHeight: size.height,
        scale: 1,               // exact target pixels, independent of devicePixelRatio
        useCORS: true,
        backgroundColor: null,  // the slide paints its own background
        logging: false
      });
      return await canvasToBlob(canvas);
    } finally {
      if (stage.remove) stage.remove();
    }
  }

  /* ---------- project source collection (for the source ZIP) ---------- */

  // Built by concatenation so this file never contains a literal script tag
  // (which would end the host page's inline script early).
  function scriptTag(src) {
    return "<" + "script src=\"" + src + "\"></" + "script>";
  }

  function textOf(doc, selector) {
    var node = doc.querySelector(selector);
    return node ? node.textContent : "";
  }

  function collectProjectFiles(doc, meta) {
    var css = textOf(doc, "#infog-styles");
    var app = textOf(doc, "#infog-app");
    var runtime = textOf(doc, "#infog-export");

    var clone = doc.documentElement.cloneNode(true);
    Array.prototype.forEach.call(
      clone.querySelectorAll("[data-infog-export-stage],[data-infog-fallback]"),
      function (n) { n.remove(); });
    // Containers the app script renders into start empty in the source project.
    Array.prototype.forEach.call(clone.querySelectorAll("[data-infog-dynamic]"),
      function (n) { n.innerHTML = ""; });

    var style = clone.querySelector("#infog-styles");
    if (style) {
      var link = doc.createElement("link");
      link.setAttribute("rel", "stylesheet");
      link.setAttribute("href", "styles.css");
      style.replaceWith(link);
    }
    var appEl = clone.querySelector("#infog-app");
    if (appEl) {
      var script = doc.createElement("script");
      script.setAttribute("src", "script.js");
      appEl.replaceWith(script);
    }
    var runtimeEl = clone.querySelector("#infog-export");
    if (runtimeEl) runtimeEl.remove();

    var files = {
      "index.html": "<!doctype html>\n" + clone.outerHTML + "\n",
      "styles.css": css.replace(/^\n+/, ""),
      "script.js": [runtime, app].filter(Boolean).join("\n\n").replace(/^\n+/, ""),
      "manifest.json": JSON.stringify({
        name: meta.name,
        slug: meta.slug,
        version: "1.0.0",
        entry: "index.html",
        ratio: meta.ratio || null,
        slides: meta.slides,
        generatedBy: "InfoG Studio export runtime " + VERSION
      }, null, 2) + "\n",
      "README.md": [
        "# " + meta.name,
        "",
        "Social-media carousel generated with InfoG Studio (" + meta.slides + " slides).",
        "",
        "## Run",
        "Open `index.html` in a browser, or serve this folder (for example `python3 -m http.server`).",
        "",
        "## Dependencies",
        "PNG and ZIP export use html2canvas 1.4.1 and JSZip 3.10.1. They are loaded on demand from",
        "cdnjs (with jsDelivr as a fallback), so exporting needs network access.",
        "For fully offline use, download both files into `assets/vendor/` and add",
        "`" + scriptTag("assets/vendor/html2canvas.min.js") + "` and",
        "`" + scriptTag("assets/vendor/jszip.min.js") + "` before `script.js`.",
        "",
        "## Files",
        "- `index.html` page shell",
        "- `styles.css` design tokens and layout",
        "- `script.js` app logic and export runtime",
        "- `project.json` slide data, when present (importable back into the app)",
        ""
      ].join("\n"),
      ".gitignore": ".DS_Store\nnode_modules/\n*.zip\n",
      "assets/.gitkeep": ""
    };
    if (meta.project) files["project.json"] = JSON.stringify(meta.project, null, 2) + "\n";
    return files;
  }

  /* ---------- exporter ---------- */

  function create(options) {
    options = options || {};
    var doc = global.document;
    var busy = false;
    var downloadsPromise = null;
    var panel = null; // { node, url, onKey }

    /* -- capability lookup, started early so the first click is not delayed -- */
    function getDownloads() {
      if (!downloadsPromise) {
        downloadsPromise = (async function () {
          try {
            if (!global.claude || typeof global.claude.use !== "function") return null;
            return (await global.claude.use("downloads")) || null;
          } catch (e) { return null; }
        })();
      }
      return downloadsPromise;
    }
    getDownloads();

    if (options.preload !== false) {
      var warm = function () { loadLib("html2canvas").catch(function () {}); loadLib("JSZip").catch(function () {}); };
      if (global.requestIdleCallback) global.requestIdleCallback(warm, { timeout: 4000 });
      else setTimeout(warm, 1500);
    }

    /* -- options with sensible defaults -- */
    function slides() {
      var list = options.getSlides
        ? options.getSlides()
        : doc.querySelectorAll("[data-infog-canvas]");
      return Array.prototype.slice.call(list);
    }
    function activeIndex() {
      return options.getActiveIndex ? options.getActiveIndex() : 0;
    }
    function target() {
      if (options.getTarget) return options.getTarget();
      var ratio = (doc.documentElement.getAttribute("data-ratio") || "1:1");
      return TARGETS[ratio] || TARGETS["1:1"];
    }
    function projectName() { return options.name || "InfoG Studio Project"; }
    function slug() { return slugify(projectName()); }
    function renderSlide(el, size) {
      return (options.renderSlide || renderSlideToBlob)(el, size);
    }

    /* -- status reporting -- */
    function defaultStatus(s) {
      var host = doc.querySelector("[data-infog-status]");
      if (!host) { (s.level === "error" ? console.error : console.log)("[InfoG]", s.message); return; }
      host.setAttribute("role", "status");
      host.setAttribute("aria-live", "polite");
      host.setAttribute("data-level", s.level);
      host.textContent = s.message + " ";
      if (s.action) {
        var b = doc.createElement("button");
        b.type = "button";
        b.textContent = s.action.label;
        b.addEventListener("click", s.action.run);
        host.appendChild(b);
      }
    }
    function status(level, message, action) {
      var s = { level: level, message: message, action: action || null };
      if (typeof options.onStatus === "function") options.onStatus(s); else defaultStatus(s);
      return s;
    }

    /* -- Save panel (last-resort fallback that never dead-ends) -- */
    function closePanel() {
      if (!panel) return;
      doc.removeEventListener("keydown", panel.onKey, true);
      if (panel.node.remove) panel.node.remove();
      try { global.URL.revokeObjectURL(panel.url); } catch (e) {}
      panel = null;
    }

    function styleButton(el) {
      el.style.cssText = "display:inline-flex;align-items:center;justify-content:center;min-height:44px;" +
        "padding:0 16px;border-radius:12px;border:0;cursor:pointer;font:600 15px/1 system-ui,sans-serif;" +
        "text-decoration:none;background:var(--color-accent,#29d17f);color:#0e1623;";
    }

    function showPanel(info) {
      closePanel();
      var wrap = doc.createElement("div");
      wrap.setAttribute("data-infog-fallback", "");
      wrap.setAttribute("role", "dialog");
      wrap.setAttribute("aria-modal", "true");
      wrap.setAttribute("aria-label", "Save " + info.filename);
      wrap.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;" +
        "justify-content:center;padding:16px;background:rgba(0,0,0,.72);";

      var card = doc.createElement("div");
      card.style.cssText = "box-sizing:border-box;width:min(92vw,520px);max-height:92vh;overflow:auto;padding:16px;" +
        "border-radius:16px;display:flex;flex-direction:column;gap:12px;font:15px/1.4 system-ui,sans-serif;" +
        "background:var(--color-surface,#141e2e);color:var(--color-text,#f4f7fb);";

      var title = doc.createElement("strong");
      title.textContent = "Save " + info.filename;
      card.appendChild(title);

      var isImage = info.mime.indexOf("image/") === 0;
      var hint = doc.createElement("div");
      hint.style.cssText = "color:var(--color-muted,#aeb9c9);font-size:14px;";
      hint.textContent = isImage
        ? "Your browser blocked the automatic download. Press and hold the image (mobile) or right-click it (desktop) to save it, or use a button below."
        : "Your browser blocked the automatic download. Use a button below to save the file.";
      card.appendChild(hint);

      if (isImage) {
        var img = doc.createElement("img");
        img.src = info.url;
        img.alt = info.filename;
        img.style.cssText = "max-width:100%;height:auto;border-radius:12px;background:#000;";
        card.appendChild(img);
      }

      var row = doc.createElement("div");
      row.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;";

      var dl = doc.createElement("a");
      dl.href = info.url; dl.download = info.filename; dl.textContent = "Download";
      styleButton(dl); row.appendChild(dl);

      var open = doc.createElement("a");
      open.href = info.url; open.target = "_blank"; open.rel = "noopener"; open.textContent = "Open in new tab";
      styleButton(open); row.appendChild(open);

      if (info.file && canShareFile(info.file)) {
        var share = doc.createElement("button");
        share.type = "button"; share.textContent = "Share…";
        styleButton(share);
        share.addEventListener("click", function () {
          global.navigator.share({ files: [info.file], title: info.filename }).catch(function () {});
        });
        row.appendChild(share);
      }

      if (info.mime === "image/png" && global.ClipboardItem && global.navigator.clipboard && global.navigator.clipboard.write) {
        var copy = doc.createElement("button");
        copy.type = "button"; copy.textContent = "Copy image";
        styleButton(copy);
        copy.addEventListener("click", function () {
          var item = {}; item[info.mime] = info.blob;
          global.navigator.clipboard.write([new global.ClipboardItem(item)])
            .then(function () { copy.textContent = "Copied"; })
            .catch(function () { copy.textContent = "Copy not allowed"; });
        });
        row.appendChild(copy);
      }

      var close = doc.createElement("button");
      close.type = "button"; close.textContent = "Close";
      styleButton(close);
      close.style.background = "transparent";
      close.style.color = "inherit";
      close.style.border = "1px solid currentColor";
      close.addEventListener("click", closePanel);
      row.appendChild(close);

      card.appendChild(row);
      wrap.appendChild(card);
      doc.body.appendChild(wrap);

      var onKey = function (e) { if (e.key === "Escape") { e.stopPropagation(); closePanel(); } };
      doc.addEventListener("keydown", onKey, true);
      panel = { node: wrap, url: info.url, onKey: onKey };
      if (dl.focus) dl.focus();
    }

    /* -- the save cascade -- */
    function result(props) {
      return Object.assign({ ok: false, saved: false, cancelled: false, method: null, code: null, message: "" }, props);
    }

    async function saveFile(blob, filename) {
      var mime = mimeFor(filename);

      // 1. downloads capability (published artifact)
      var downloads = await getDownloads();
      if (downloads) {
        try {
          await downloads.save({ filename: filename, data: blob });
          return result({ ok: true, saved: true, method: "downloads", message: "Saved " + filename + "." });
        } catch (err) {
          var code = err && err.code;
          if (code === "declined") {
            return result({ cancelled: true, method: "downloads", code: code, message: "Save cancelled." });
          }
          if (code === "rate_limited") {
            return result({ method: "downloads", code: code, message: "A save prompt is already open. Answer it, then try again." });
          }
          if (code === "too_large") {
            return result({ method: "downloads", code: code, message: "That file is too large to save here. Export fewer slides at a time." });
          }
          if (code === "extension_not_enabled") {
            var ext = filename.split(".").pop().toUpperCase();
            return result({ method: "downloads", code: code, message: ext + " downloads aren't enabled in this view. " +
              (ext === "ZIP" ? "Export slides one at a time as PNG instead." : "") });
          }
          if (global.console) console.warn("[InfoG] downloads.save failed, trying fallbacks:", code, err && err.message);
          // unavailable / not_granted / bad_request / ... -> fall through
        }
      }

      // 2. Web Share with a file (touch devices; desktop share sheets are surprising)
      var file = null;
      try { file = new global.File([blob], filename, { type: mime }); } catch (e) {}
      if (file && isTouchPrimary() && canShareFile(file)) {
        try {
          await global.navigator.share({ files: [file], title: filename });
          return result({ ok: true, saved: true, method: "share", message: "Shared " + filename + "." });
        } catch (err) {
          if (err && err.name === "AbortError") {
            return result({ cancelled: true, method: "share", message: "Share cancelled." });
          }
          // NotAllowedError (user activation expired, frame lacks web-share) -> fall through
        }
      }

      var url = global.URL.createObjectURL(blob);

      // 3. <a download>, only where it can work: a top-level page
      if (!isFramed()) {
        var a = doc.createElement("a");
        a.href = url; a.download = filename; a.rel = "noopener"; a.style.display = "none";
        doc.body.appendChild(a);
        a.click();
        setTimeout(function () { if (a.remove) a.remove(); }, 0);
        setTimeout(function () { try { global.URL.revokeObjectURL(url); } catch (e) {} }, 60000);
        return result({ ok: true, method: "anchor",
          message: "Download requested for " + filename + ". If nothing shows up in your downloads, use Open / Save.",
          panel: function () { showPanel({ blob: blob, url: global.URL.createObjectURL(blob), filename: filename, mime: mime, file: file }); } });
      }

      // 4. Save panel
      showPanel({ blob: blob, url: url, filename: filename, mime: mime, file: file });
      return result({ ok: true, method: "panel",
        message: "Ready. Use the Save panel to download, open, or share " + filename + "." });
    }

    function report(r) {
      var action = r.panel ? { label: "Open / Save", run: r.panel } : null;
      status(r.ok ? (r.saved ? "success" : "info") : (r.cancelled ? "info" : "error"), r.message, action);
      return r;
    }

    async function guarded(work, failureMessage) {
      if (busy) return result({ code: "busy", message: "Another export is still running." });
      busy = true;
      try {
        return await work();
      } catch (err) {
        var detail = err && err.message ? " (" + err.message + ")" : "";
        // A strictly sandboxed frame cannot run html2canvas (it needs to open its own
        // cloning iframe). The standalone artifact tab has no such limit.
        if (/same-origin|securityerror|sandbox/i.test(detail)) {
          detail += " This frame blocks image rendering. Open the artifact in its own browser tab and export from there.";
        }
        return report(result({ code: "failed", message: failureMessage + detail }));
      } finally {
        busy = false;
      }
    }

    /* -- public exports -- */
    function slideName(i, total) { return "slide-" + pad(i + 1, total) + ".png"; }

    function exportCurrentPNG() {
      return guarded(async function () {
        var list = slides();
        var i = activeIndex();
        if (!list[i]) return report(result({ code: "no_slide", message: "There is no slide to export." }));
        status("info", "Rendering slide " + (i + 1) + " / " + list.length + "...");
        var blob = await renderSlide(list[i], target());
        return report(await saveFile(blob, slideName(i, list.length)));
      }, "PNG export failed. Try again after the slide finishes rendering.");
    }

    function exportAllZip() {
      return guarded(async function () {
        var list = slides();
        if (!list.length) return report(result({ code: "no_slide", message: "There are no slides to export." }));
        var JSZip = await loadLib("JSZip");
        var zip = new JSZip();
        var size = target();
        for (var i = 0; i < list.length; i++) {
          status("info", "Exporting " + (i + 1) + " / " + list.length + "...");
          zip.file(slideName(i, list.length), await renderSlide(list[i], size));
        }
        status("info", "Packing ZIP...");
        // PNGs are already compressed; STORE keeps packing fast on phones.
        var out = await zip.generateAsync({ type: "blob", compression: "STORE", mimeType: "application/zip" });
        return report(await saveFile(out, slug() + "-slides.zip"));
      }, "ZIP export failed. Check dependency/network access and try again.");
    }

    function exportProjectZip() {
      return guarded(async function () {
        var JSZip = await loadLib("JSZip");
        var list = slides();
        var files = collectProjectFiles(doc, {
          name: projectName(),
          slug: slug(),
          slides: list.length,
          ratio: doc.documentElement.getAttribute("data-ratio"),
          project: options.getProject ? options.getProject() : null
        });
        var zip = new JSZip();
        var root = zip.folder(slug());
        Object.keys(files).forEach(function (path) { root.file(path, files[path]); });
        status("info", "Packing project ZIP...");
        var out = await zip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: "application/zip" });
        return report(await saveFile(out, slug() + "-project.zip"));
      }, "Project ZIP export failed. Check dependency/network access and try again.");
    }

    return {
      exportCurrentPNG: exportCurrentPNG,
      exportAllZip: exportAllZip,
      exportProjectZip: exportProjectZip,
      showPanel: showPanel,
      closePanel: closePanel,
      /** Resolves true when the downloads capability is usable in this view. */
      hasDownloadsCapability: function () { return getDownloads().then(function (d) { return !!d; }); }
    };
  }

  global.InfoGExport = { version: VERSION, TARGETS: TARGETS, create: create, loadLib: loadLib };
})(typeof window !== "undefined" ? window : globalThis);
