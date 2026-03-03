/* DocWalk Developer Preset — Custom JS */

/* Mermaid rendering + click-to-zoom.
   Zensical empties .mermaid containers without rendering SVGs.
   We save the source text immediately (before Zensical clears it),
   load Mermaid from CDN if needed, and render ourselves. */
(function() {
  /* 1. Save sources immediately and prevent Zensical from touching them */
  var diagrams = [];
  document.querySelectorAll("pre.mermaid").forEach(function(pre) {
    var code = pre.querySelector("code");
    var src = (code || pre).textContent || "";
    if (src.trim()) {
      diagrams.push({ el: pre, src: src.trim() });
      pre.className = "dw-mermaid-loading";
    }
  });
  if (!diagrams.length) return;

  /* 2. Pan + zoom overlay */
  function openZoom(svg) {
    var isDark = document.body.getAttribute("data-md-color-scheme") === "slate";
    var bg = isDark ? "#171921" : "#f9fafb";
    var fg = isDark ? "#d6d6da" : "#1f2937";
    var accent = isDark ? "#5de4c7" : "#0f766e";

    var overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:" + bg + ";display:flex;flex-direction:column;";

    /* Toolbar */
    var toolbar = document.createElement("div");
    toolbar.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1.25rem;border-bottom:1px solid " + (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)") + ";flex-shrink:0;user-select:none;";
    var hint = document.createElement("span");
    hint.textContent = "Scroll to zoom \u00b7 Drag to pan \u00b7 Double-click to reset";
    hint.style.cssText = "font:12px Inter,sans-serif;color:" + fg + ";opacity:0.5;";
    var controls = document.createElement("span");
    controls.style.cssText = "display:flex;gap:0.5rem;align-items:center;";
    function makeBtn(label, title) {
      var b = document.createElement("button");
      b.textContent = label;
      b.title = title;
      b.style.cssText = "background:none;border:1px solid " + (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)") + ";color:" + fg + ";border-radius:6px;width:32px;height:32px;font:16px Inter,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;";
      return b;
    }
    var btnZoomIn = makeBtn("+", "Zoom in");
    var btnZoomOut = makeBtn("\u2212", "Zoom out");
    var btnReset = makeBtn("\u21ba", "Reset view");
    var btnClose = makeBtn("\u2715", "Close");
    btnClose.style.borderColor = accent;
    btnClose.style.color = accent;
    controls.appendChild(btnZoomIn);
    controls.appendChild(btnZoomOut);
    controls.appendChild(btnReset);
    controls.appendChild(btnClose);
    toolbar.appendChild(hint);
    toolbar.appendChild(controls);
    overlay.appendChild(toolbar);

    /* Viewport */
    var viewport = document.createElement("div");
    viewport.style.cssText = "flex:1;overflow:hidden;position:relative;cursor:grab;";
    var wrapper = document.createElement("div");
    wrapper.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform-origin:0 0;";
    var clone = svg.cloneNode(true);
    clone.style.cssText = "max-width:90vw;max-height:85vh;width:auto;height:auto;";
    clone.removeAttribute("max-width");
    wrapper.appendChild(clone);
    viewport.appendChild(wrapper);
    overlay.appendChild(viewport);
    document.body.appendChild(overlay);

    /* Pan + zoom state */
    var scale = 1, tx = 0, ty = 0;
    var dragging = false, startX = 0, startY = 0, startTx = 0, startTy = 0;

    function applyTransform() {
      wrapper.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
    }

    function zoom(delta, cx, cy) {
      var prev = scale;
      scale = Math.min(10, Math.max(0.1, scale * delta));
      var rect = viewport.getBoundingClientRect();
      var ox = (cx || rect.width / 2) - rect.left;
      var oy = (cy || rect.height / 2) - rect.top;
      tx = ox - (ox - tx) * (scale / prev);
      ty = oy - (oy - ty) * (scale / prev);
      applyTransform();
    }

    function resetView() { scale = 1; tx = 0; ty = 0; applyTransform(); }

    viewport.addEventListener("wheel", function(e) {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1.15 : 0.87, e.clientX, e.clientY);
    }, { passive: false });

    viewport.addEventListener("mousedown", function(e) {
      if (e.button !== 0) return;
      dragging = true; startX = e.clientX; startY = e.clientY;
      startTx = tx; startTy = ty;
      viewport.style.cursor = "grabbing";
    });
    document.addEventListener("mousemove", function move(e) {
      if (!dragging) return;
      tx = startTx + (e.clientX - startX);
      ty = startTy + (e.clientY - startY);
      applyTransform();
    });
    document.addEventListener("mouseup", function up() {
      dragging = false;
      viewport.style.cursor = "grab";
    });

    viewport.addEventListener("dblclick", resetView);
    btnZoomIn.addEventListener("click", function() { zoom(1.3); });
    btnZoomOut.addEventListener("click", function() { zoom(0.77); });
    btnReset.addEventListener("click", resetView);

    function close() {
      overlay.remove();
    }
    btnClose.addEventListener("click", close);
    document.addEventListener("keydown", function esc(ev) {
      if (ev.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
    });
  }

  /* 3. Render one diagram at a time (mermaid.render is async in v10+) */
  function renderQueue(m, queue) {
    if (!queue.length) return;
    var d = queue.shift();
    var id = "dw-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4);
    try {
      var result = m.render(id, d.src);
      if (result && typeof result.then === "function") {
        result.then(function(r) {
          d.el.innerHTML = r.svg;
          d.el.className = "mermaid";
          renderQueue(m, queue);
        }).catch(function() {
          d.el.textContent = d.src;
          d.el.className = "mermaid";
          renderQueue(m, queue);
        });
      } else {
        d.el.innerHTML = typeof result === "string" ? result : "";
        d.el.className = "mermaid";
        renderQueue(m, queue);
      }
    } catch(e) {
      d.el.textContent = d.src;
      d.el.className = "mermaid";
      renderQueue(m, queue);
    }
  }

  function doRender(m) {
    var isDark = document.body.getAttribute("data-md-color-scheme") === "slate";
    m.initialize({ startOnLoad: false, theme: isDark ? "dark" : "default", fontFamily: "Inter, sans-serif" });
    renderQueue(m, diagrams.slice());
  }

  /* 4. Use global mermaid if available, otherwise load from CDN */
  function boot() {
    if (typeof mermaid !== "undefined" && mermaid.initialize) {
      doRender(mermaid);
      return;
    }
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    s.onload = function() {
      if (typeof mermaid !== "undefined") doRender(mermaid);
    };
    s.onerror = function() {
      diagrams.forEach(function(d) { d.el.textContent = d.src; d.el.className = "mermaid"; });
    };
    document.head.appendChild(s);
  }

  /* Small delay so Zensical's synchronous setup finishes first */
  setTimeout(boot, 0);

  /* 5. Capture-phase click-to-zoom */
  document.addEventListener("click", function(e) {
    if (!e.target.closest) return;
    var container = e.target.closest(".mermaid, .dw-mermaid-loading");
    if (!container) return;
    var svg = container.querySelector("svg");
    if (!svg) return;
    e.preventDefault();
    e.stopPropagation();
    openZoom(svg);
  }, true);
})();
