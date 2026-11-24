// Publication list (_layouts/bib.liquid):
//  1. Author lists are kept to a single line. As many authors as fit are shown, the rest are
//     folded into a clickable "N more authors", which expands the full list (it may then wrap).
//  2. Preview figures open in a lightbox of one standard size, above everything (navbar included).
(function () {
  "use strict";

  // ── One-line author lists ──────────────────────────────────────────────────

  function setupAuthors(author) {
    const items = Array.from(author.querySelectorAll(":scope > .author-item"));
    const wrap = author.querySelector(":scope > .more-authors-wrap");
    const more = wrap && wrap.querySelector(".more-authors");
    if (!items.length || !more) return;

    const seps = items.map((it) => it.querySelector(".author-sep"));
    const fullSeps = seps.map((s) => (s ? s.textContent : ""));
    const n = items.length;
    let expanded = false;

    // Show the first k authors, folding the rest into "N more authors".
    function show(k) {
      items.forEach((it, i) => (it.hidden = i >= k));
      if (k >= n) {
        seps.forEach((s, i) => s && (s.textContent = fullSeps[i]));
        wrap.hidden = true;
        return;
      }
      seps.forEach((s, i) => s && (s.textContent = i === 0 ? "" : ", "));
      const rest = n - k;
      wrap.firstChild.textContent = k === 1 ? " and " : ", and ";
      more.textContent = rest + " more author" + (rest > 1 ? "s" : "");
      wrap.hidden = false;
    }

    function fit() {
      if (expanded || author.clientWidth === 0) return; // expanded, or hidden (e.g. by the search filter)
      for (let k = n; k >= 1; k--) {
        show(k);
        if (author.scrollWidth <= author.clientWidth + 1) return;
      }
    }

    function expand() {
      expanded = true;
      author.classList.add("is-expanded");
      show(n);
    }

    more.addEventListener("click", expand);
    more.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        expand();
      }
    });

    fit();
    // Refit when the column width changes (window resize, or the entry being shown again after filtering)
    if ("ResizeObserver" in window) {
      let lastWidth = author.clientWidth;
      new ResizeObserver(() => {
        if (author.clientWidth !== lastWidth) {
          lastWidth = author.clientWidth;
          fit();
        }
      }).observe(author);
    } else {
      window.addEventListener("resize", fit);
    }
    // Widths change once the web fonts have loaded
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }

  // ── Preview lightbox ───────────────────────────────────────────────────────

  let current = null;

  function closeLightbox() {
    if (!current) return;
    const overlay = current;
    current = null;
    overlay.classList.remove("is-open");
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("scroll", closeLightbox);
    setTimeout(() => overlay.remove(), 250);
  }

  function onKey(e) {
    if (e.key === "Escape") closeLightbox();
  }

  function openLightbox(img) {
    closeLightbox();
    const overlay = document.createElement("div");
    overlay.className = "pub-lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    if (img.alt) overlay.setAttribute("aria-label", img.alt);

    const frame = document.createElement("div");
    frame.className = "pub-lightbox-frame";
    const col = img.closest(".abbr");
    if (col && col.dataset.dark) frame.dataset.dark = col.dataset.dark;
    const big = document.createElement("img");
    big.src = img.getAttribute("src"); // the full-size original, not the small thumbnail version
    big.alt = img.alt || "";
    frame.appendChild(big);
    overlay.appendChild(frame);

    overlay.addEventListener("click", closeLightbox);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", closeLightbox, { passive: true });

    document.body.appendChild(overlay);
    current = overlay;
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("is-open")));
  }

  function init() {
    document.querySelectorAll("ol.bibliography .author").forEach(setupAuthors);
    document.addEventListener("click", (e) => {
      const img = e.target.closest && e.target.closest("ol.bibliography img.preview");
      if (!img) return;
      e.preventDefault();
      openLightbox(img);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
