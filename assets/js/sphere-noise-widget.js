/*
 * Interactive sphere figure for "Staying on the Manifold": the four noise types side by side on S².
 *
 * Usage in a post:
 *   <div class="sphere-noise-widget"></div>
 *   <script src="/assets/js/sphere-noise-widget.js" defer></script>
 *
 * Optional attributes:
 *   data-max-size = 440   (max width in px)
 *
 * Every sample keeps its own standard-normal draws, so moving x or the σ slider re-derives all samples live:
 *   ambient     x̃ = x + σε                                          (off the sphere)
 *   tangential  x̃ = x + σPε,  P = I − xxᵀ                           (on the tangent plane at x)
 *   geodesic    x̃ = exp_x(v) = cos|v|·x + sin|v|·v/|v|,  v = σPε     (great-circle step, on the sphere)
 *   Brownian    x_{k+1} = normalize(x_k + √Δt · P(x_k) ξ_k),  Δt = T/n,  T = σ²,  n = 400
 *                (projected steps + renormalisation: converges to Brownian motion with generator ½Δ,
 *                 so after time T = σ² its spread matches the Gaussian of the other methods)
 * The sphere uses closed-form extrinsic geometry here, not the chart-based ODE/SDE solvers from the post.
 *
 * New geodesic samples travel along their great circle (≈1 s) and new Brownian samples walk step by step
 * (≈1.6 s). Moving x or σ recomputes every sample and shows it finished.
 *
 * Side panel: the parameter space (u1, u2) ∈ [0, π] × [0, 2π) of the post's chart
 *   X(u1, u2) = (sin u1 cos u2, sin u1 sin u2, cos u1),  X⁻¹(p) = (arccos p_z, atan2(p_y, p_x) mod 2π).
 * Only on-sphere samples (geodesic, Brownian) are shown, with their paths: ambient / tangential samples are not
 * on the manifold, so they have no chart coordinates. Paths wrap at the u2 = 0/2π seam and break next to the poles. The panel does not
 * depend on the view rotation.
 *
 * Rendering: orthographic projection. The sphere is drawn opaque, then everything hidden behind it is drawn
 * on top at reduced opacity (it all projects inside the disk), then everything visible at full opacity.
 */
(function () {
  "use strict";

  const P = {
    maxSize: 440,
    radius: 0.34, // sphere radius as a fraction of the canvas width
    sigma: 0.3, // default noise scale
    sigmaMin: 0.05,
    sigmaMax: 0.6,
    bmSteps: 400, // steps of the Brownian random walk; step size √(T/n) with T = σ²
    animMs: { geodesic: 1000, brownian: 1600 }, // animation length per new sample; others appear at once
    markerSize: 5.5, // sample marker radius (px)
    dataSize: 7, // data point marker radius (px)
    backAlpha: 0.32, // opacity of everything hidden behind the sphere
    sideBySide: 640, // min widget width (px) for sphere and parameter-space panel side by side
    panelMax: 520, // max width of the parameter-space panel (px)
    panelMargin: { l: 62, r: 14, t: 34, b: 52 }, // room for the title, tick labels and axis labels
    poleJump: 1.5, // a step changing u2 by more than this (rad, not via the seam) is next to a pole: break the line
    maxPerMethod: 40, // oldest samples are dropped beyond this
    clickTol: 4, // px of pointer movement that still counts as a click (not a drag)
    rotSpeed: 0.008, // radians per px of drag
    start: [1.1, 2.4], // initial data point in the post's chart (u1, u2), away from the u2 = 0 / 2π seam
  };

  const COLORS = {
    data: "#2F4F4F",
    ambient: "#C0272D",
    tangential: "#E39B3A",
    geodesic: "#3C7A3C",
    brownian: "#3B6FA0",
  };
  const METHODS = [
    ["ambient", "Ambient"],
    ["tangential", "Tangential"],
    ["geodesic", "Geodesic"],
    ["brownian", "Brownian"],
  ];

  // ─── Small vector helpers ──────────────────────────────────────────────────
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const norm = (a) => Math.sqrt(dot(a, a));
  const normalize = (a) => scale(a, 1 / norm(a));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // P(x) e = e − (x·e) x : projection onto the tangent plane at the unit vector x
  const project = (x, e) => add(e, scale(x, -dot(x, e)));
  const matVec = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
  const matT = (M) => [0, 1, 2].map((i) => [M[0][i], M[1][i], M[2][i]]);
  const matMul = (A, B) => {
    const Bt = matT(B);
    return A.map((row) => Bt.map((col) => dot(row, col)));
  };
  const rotX = (a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [[1, 0, 0], [0, c, -s], [0, s, c]];
  };
  const rotY = (a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
  };
  const rotZ = (a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
  };
  // Gram–Schmidt on the rows, so repeated drag rotations do not drift away from a rotation matrix
  function orthonormalize(M) {
    const r0 = normalize(M[0]);
    const r1 = normalize(add(M[1], scale(r0, -dot(r0, M[1]))));
    return [r0, r1, cross(r0, r1)];
  }
  function gauss() {
    let u = 0;
    while (u === 0) u = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
  }
  const gauss3 = () => [gauss(), gauss(), gauss()];
  const chart = (u1, u2) => [Math.sin(u1) * Math.cos(u2), Math.sin(u1) * Math.sin(u2), Math.cos(u1)];

  // exp_x(v) for a tangent vector v at x
  function expMap(x, v, t = 1) {
    const th = norm(v) * t;
    if (th < 1e-12) return x.slice();
    return add(scale(x, Math.cos(th)), scale(v, Math.sin(th) / norm(v)));
  }

  // ─── Styles (injected so PurgeCSS cannot strip them) ───────────────────────
  const KATEX_FONTS = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/fonts/";
  const FONT_MAIN = '"SNW Main", "Latin Modern Roman", "Computer Modern", "Times New Roman", serif';
  const FONT_MATH = '"SNW Math", "SNW Main", "Latin Modern Math", "Times New Roman", serif';
  const FONT_CAL = '"SNW Cal", "SNW Main", "Times New Roman", serif';
  const FONT_BOLD_MATH = '"SNW BoldMath", "SNW Main", "Latin Modern Math", "Times New Roman", serif';

  function injectStyles() {
    if (document.getElementById("sphere-noise-widget-styles")) return;
    const css = `
      @font-face { font-family: "SNW Main"; font-style: normal; font-weight: 400;
        src: url(${KATEX_FONTS}KaTeX_Main-Regular.woff2) format("woff2"); }
      @font-face { font-family: "SNW Math"; font-style: italic; font-weight: 400;
        src: url(${KATEX_FONTS}KaTeX_Math-Italic.woff2) format("woff2"); }
      @font-face { font-family: "SNW BoldMath"; font-style: italic; font-weight: 700;
        src: url(${KATEX_FONTS}KaTeX_Math-BoldItalic.woff2) format("woff2"); }
      @font-face { font-family: "SNW Cal"; font-style: normal; font-weight: 400;
        src: url(${KATEX_FONTS}KaTeX_Caligraphic-Regular.woff2) format("woff2"); }
      .sphere-noise-widget { margin: 1.5rem 0 .2rem 0; }
      .sphere-noise-widget canvas { display: block; margin: 0 auto; max-width: 100%;
        cursor: grab; touch-action: none; }
      .sphere-noise-widget canvas.snw-dragging { cursor: grabbing; }
      .sphere-noise-widget .snw-row { display: flex; justify-content: center; align-items: center; gap: 16px; }
      .sphere-noise-widget .snw-row canvas { margin: 0; }
      .sphere-noise-widget canvas.snw-panel { cursor: default; touch-action: auto; }
      .sphere-noise-widget .snw-controls { display: flex; flex-wrap: wrap; gap: .45rem .6rem; justify-content: center;
        align-items: center; margin-top: .6rem; font-size: .8rem; }
      .sphere-noise-widget button { font: inherit; line-height: 1.4; padding: .2rem .7rem; border-radius: 4px;
        cursor: pointer; border: 1px solid var(--global-divider-color, rgba(0,0,0,.2)); background: transparent;
        color: var(--global-text-color, #222); display: inline-flex; align-items: center; gap: .4rem; }
      .sphere-noise-widget button:hover { border-color: var(--global-theme-color, #2e4057); }
      .sphere-noise-widget .snw-dot { display: inline-block; width: .75em; height: .75em; border-radius: 50%;
        box-shadow: 0 0 0 1px rgba(255,255,255,.9); }
      .sphere-noise-widget .snw-group { display: inline-flex; align-items: center; gap: .4rem; }
      .sphere-noise-widget .snw-sym { font-family: "SNW Math", "Times New Roman", serif; font-style: italic;
        font-size: 1.1em; color: var(--global-text-color, #222); }
      .sphere-noise-widget input[type="range"] { width: 8rem; accent-color: var(--global-theme-color, #2e4057); }
      .sphere-noise-widget .snw-value { min-width: 2.2rem; font-variant-numeric: tabular-nums;
        color: var(--global-text-color, #222); }
      .sphere-noise-widget .snw-hint { text-align: center; font-size: .75rem; margin-top: .35rem;
        color: var(--global-text-color-light, #777); }
    `;
    const el = document.createElement("style");
    el.id = "sphere-noise-widget-styles";
    el.textContent = css;
    document.head.appendChild(el);
  }

  // Resolve a CSS custom property to [r, g, b].
  function readColor(root, varName, fallback) {
    const probe = document.createElement("span");
    probe.style.color = `var(${varName}, ${fallback})`;
    probe.style.display = "none";
    root.appendChild(probe);
    const m = getComputedStyle(probe).color.match(/[\d.]+/g);
    probe.remove();
    return m ? m.slice(0, 3).map(Number) : [34, 34, 34];
  }
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  // ─── Widget ────────────────────────────────────────────────────────────────
  class SphereNoiseWidget {
    constructor(root) {
      this.root = root;
      root.sphereNoiseWidget = this; // handle for debugging / scripted screenshots
      this.maxSize = Number(root.dataset.maxSize) || P.maxSize;
      this.sigma = P.sigma;
      this.samples = [];
      this.resetView();
      this.x = chart(P.start[0], P.start[1]);
      this.build();
      this.readTheme();
      this.observe();
      this.bindPointer();
    }

    // Initial camera: north pole up, viewed from slightly above, with the data point facing the reader.
    resetView() {
      // world (x, y, z) → view (right, up, toward reader): world z is up, world −y faces the reader
      const base = [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
      this.R = matMul(matMul(rotX(0.35), base), rotZ(-Math.PI / 2 - P.start[1] + 0.45));
    }

    build() {
      const root = this.root;
      root.innerHTML = "";
      this.canvas = document.createElement("canvas");
      this.canvas.setAttribute("role", "img");
      this.canvas.setAttribute(
        "aria-label",
        "Rotatable unit sphere with a data point and noise samples drawn by four methods: ambient, tangential, geodesic and Brownian motion."
      );
      this.ctx = this.canvas.getContext("2d");
      // Side panel: the parameter space (u1, u2) of the post's chart X. Next to the sphere on wide screens,
      // below it on narrow ones (see resize()).
      this.panel = document.createElement("canvas");
      this.panel.className = "snw-panel";
      this.panel.setAttribute("role", "img");
      this.panel.setAttribute(
        "aria-label",
        "Parameter space of the sphere chart, u1 from 0 to pi and u2 from 0 to 2 pi, showing the data point and the samples in local coordinates."
      );
      this.pctx = this.panel.getContext("2d");
      this.row = document.createElement("div");
      this.row.className = "snw-row";
      this.row.appendChild(this.canvas);
      this.row.appendChild(this.panel);
      root.appendChild(this.row);

      const controls = document.createElement("div");
      controls.className = "snw-controls";
      const methods = document.createElement("div");
      methods.className = "snw-group";
      for (const [key, label] of METHODS) {
        const b = document.createElement("button");
        b.type = "button";
        b.innerHTML = `<span class="snw-dot" style="background:${COLORS[key]}"></span>${label}`;
        b.title = `Draw one ${label.toLowerCase()} noise sample from x`;
        b.addEventListener("click", () => this.addSample(key));
        methods.appendChild(b);
      }
      methods.style.flexWrap = "wrap";
      methods.style.justifyContent = "center";
      controls.appendChild(methods);

      const row2 = document.createElement("div");
      row2.className = "snw-controls";
      row2.style.marginTop = ".45rem";
      const all = document.createElement("button");
      all.type = "button";
      all.textContent = "All four (same ε)";
      all.title = "Draw one sample per method, all built from the same Gaussian draw";
      all.addEventListener("click", () => this.addAll());
      row2.appendChild(all);

      const sg = document.createElement("label");
      sg.className = "snw-group";
      sg.innerHTML = `<span class="snw-sym">σ</span>`;
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = P.sigmaMin;
      slider.max = P.sigmaMax;
      slider.step = 0.01;
      slider.value = this.sigma;
      slider.setAttribute("aria-label", "Noise scale sigma");
      const val = document.createElement("span");
      val.className = "snw-value";
      val.textContent = this.sigma.toFixed(2);
      slider.addEventListener("input", () => {
        this.sigma = Number(slider.value);
        this.finishAll(); // show recomputed paths finished instead of re-animating on every slider tick
        val.textContent = this.sigma.toFixed(2);
        this.requestDraw();
      });
      this.slider = slider;
      this.sigmaLabel = val;
      sg.appendChild(slider);
      sg.appendChild(val);
      row2.appendChild(sg);

      const clear = document.createElement("button");
      clear.type = "button";
      clear.textContent = "Clear";
      clear.addEventListener("click", () => {
        this.samples = [];
        this.requestDraw();
      });
      row2.appendChild(clear);
      const reset = document.createElement("button");
      reset.type = "button";
      reset.textContent = "Reset";
      reset.title = "Clear samples, and reset the view, the data point and σ";
      reset.addEventListener("click", () => {
        this.samples = [];
        this.resetView();
        this.x = chart(P.start[0], P.start[1]);
        this.sigma = P.sigma;
        this.slider.value = P.sigma;
        this.sigmaLabel.textContent = P.sigma.toFixed(2);
        this.requestDraw();
      });
      row2.appendChild(reset);

      root.appendChild(controls);
      root.appendChild(row2);
      const hint = document.createElement("div");
      hint.className = "snw-hint";
      hint.textContent =
        "Drag to rotate. Click the sphere to move x. Samples follow x and σ; Brownian motion runs for time T = σ².";
      root.appendChild(hint);
    }

    observe() {
      new ResizeObserver(() => this.resize()).observe(this.root);
      new MutationObserver(() => {
        this.readTheme();
        this.requestDraw();
      }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }

    readTheme() {
      this.fg = readColor(this.root, "--global-text-color", "#222");
      this.bg = readColor(this.root, "--global-bg-color", "#fff");
      this.divider = readColor(this.root, "--global-divider-color", "#ddd");
      // Dark theme ⇔ background darker than text
      const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
      this.dark = lum(this.bg) < lum(this.fg);
    }

    resize() {
      const avail = this.root.clientWidth || this.maxSize;
      const dpr = window.devicePixelRatio || 1;
      const side = avail >= P.sideBySide;
      let w, pw, ph;
      if (side) {
        w = Math.min(this.maxSize, Math.floor((avail - 16) * 0.46));
        pw = Math.min(P.panelMax, avail - w - 16);
        ph = w;
      } else {
        w = Math.max(220, Math.min(avail, this.maxSize));
        pw = Math.max(220, Math.min(avail, P.panelMax));
        ph = Math.round((pw - P.panelMargin.l - P.panelMargin.r) / 2 + P.panelMargin.t + P.panelMargin.b);
      }
      const key = [w, pw, ph, dpr].join("|");
      if (key === this.sizeKey) return;
      this.sizeKey = key;
      this.w = w;
      this.pw = pw;
      this.ph = ph;
      this.row.style.flexDirection = side ? "row" : "column";
      this.canvas.style.width = this.canvas.style.height = w + "px";
      this.canvas.width = this.canvas.height = Math.round(w * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.panel.style.width = pw + "px";
      this.panel.style.height = ph + "px";
      this.panel.width = Math.round(pw * dpr);
      this.panel.height = Math.round(ph * dpr);
      this.pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Plot rectangle: 2:1 (u2 spans 2π, u1 spans π), as large as fits, centred vertically
      const m = P.panelMargin;
      let rw = pw - m.l - m.r,
        rh = rw / 2;
      if (rh > ph - m.t - m.b) {
        rh = ph - m.t - m.b;
        rw = 2 * rh;
      }
      this.prect = { x: m.l + (pw - m.l - m.r - rw) / 2, y: m.t + (ph - m.t - m.b - rh) / 2, w: rw, h: rh };
      this.draw();
    }

    requestDraw() {
      if (this.pending) return;
      this.pending = true;
      requestAnimationFrame(() => {
        this.pending = false;
        this.draw();
      });
    }

    // ─── Sampling ─────────────────────────────────────────────────────────────
    // Each sample stores only its standard-normal draws; positions are derived from x and σ at draw time.
    // Geodesic and Brownian samples are animated once, when drawn: `born` is the start time, and `done`
    // flips when the animation has finished (or when x or σ changes, which shows every path finished).
    newSample(method, eps) {
      const s = { method, eps: eps || gauss3(), born: performance.now(), done: !P.animMs[method] };
      if (method === "brownian") s.xi = Array.from({ length: P.bmSteps }, gauss3);
      return s;
    }
    pushSample(s) {
      this.samples.push(s);
      const same = this.samples.filter((t) => t.method === s.method);
      if (same.length > P.maxPerMethod) this.samples.splice(this.samples.indexOf(same[0]), 1);
    }
    addSample(method) {
      this.pushSample(this.newSample(method));
      this.requestDraw();
    }
    addAll() {
      const eps = gauss3();
      for (const [key] of METHODS) this.pushSample(this.newSample(key, eps));
      this.requestDraw();
    }
    finishAll() {
      for (const s of this.samples) s.done = true;
    }

    // Fraction of the animation shown, in [0, 1]
    progress(s, now) {
      if (s.done) return 1;
      const f = (now - s.born) / P.animMs[s.method];
      if (f >= 1) {
        s.done = true;
        return 1;
      }
      return Math.max(0, f);
    }

    // Returns { point, path, onSphere } in world coordinates. path is a polyline from x to the (current) point.
    realize(s, now) {
      const x = this.x,
        sig = this.sigma;
      if (s.method === "ambient") {
        const p = add(x, scale(s.eps, sig));
        return { point: p, path: [x, p], dashed: true };
      }
      if (s.method === "tangential") {
        const p = add(x, scale(project(x, s.eps), sig));
        return { point: p, path: [x, p], dashed: true };
      }
      const f = this.progress(s, now);
      if (s.method === "geodesic") {
        // exp_x(t v) for t ∈ [0, f]: the great circle through x with initial velocity v = σPε
        const v = scale(project(x, s.eps), sig);
        const n = Math.max(1, Math.ceil(48 * f));
        const path = [];
        for (let k = 0; k <= n; k++) path.push(expMap(x, v, (f * k) / n));
        return { point: path[n], path, onSphere: true };
      }
      // Brownian: projected Gaussian steps of size √(T/n), renormalised back onto the sphere after each step.
      // The full path is cached per (x, σ) and revealed step by step while animating.
      const key = x.join(",") + "|" + sig;
      if (s.key !== key) {
        const dtSqrt = Math.sqrt((sig * sig) / P.bmSteps);
        let y = x.slice();
        const path = [y];
        for (const xi of s.xi) {
          y = normalize(add(y, scale(project(y, xi), dtSqrt)));
          path.push(y);
        }
        s.key = key;
        s.path = path;
      }
      const k = Math.round(P.bmSteps * f);
      const path = s.path.slice(0, k + 1);
      return { point: path[k], path, onSphere: true };
    }

    // ─── Projection ───────────────────────────────────────────────────────────
    view(p) {
      return matVec(this.R, p);
    }
    toPx(v) {
      const c = this.w / 2,
        r = this.w * P.radius;
      return [c + r * v[0], c - r * v[1]];
    }
    // A point (in view coordinates) is hidden if the sphere lies between it and the reader.
    hidden(v) {
      const r2 = v[0] * v[0] + v[1] * v[1];
      return r2 < 1 && v[2] < Math.sqrt(1 - r2) - 1e-6;
    }

    // ─── Drawing ──────────────────────────────────────────────────────────────
    draw() {
      if (!this.w) return;
      const ctx = this.ctx,
        w = this.w,
        now = performance.now();
      ctx.clearRect(0, 0, w, w);

      const back = [],
        front = []; // draw ops: functions taking ctx
      const layer = (v) => (this.hidden(v) ? back : front);

      // Polyline split into visible / hidden runs (segment midpoint decides). For curves on the sphere the
      // midpoint of a chord lies just inside the ball, so it is pushed back out to the surface before the test.
      const addPolyline = (pts, style, onSphere) => {
        const V = pts.map((p) => this.view(p));
        let run = [V[0]],
          runHidden = null;
        const flush = () => {
          if (run.length > 1) {
            const seg = run;
            (runHidden ? back : front).push((c) => this.strokePath(c, seg, style));
          }
        };
        const sub = style.sub || (style.dashed ? 16 : 1); // straight lines can cross the silhouette mid-segment
        for (let i = 1; i < V.length; i++) {
          const a = V[i - 1],
            d = add(V[i], scale(a, -1));
          for (let k = 1; k <= sub; k++) {
            const p = add(a, scale(d, k / sub));
            let q = add(a, scale(d, (k - 0.5) / sub));
            if (onSphere) q = normalize(q);
            const h = this.hidden(q);
            if (runHidden === null) runHidden = h;
            if (h !== runHidden) {
              flush();
              run = [run[run.length - 1]];
              runHidden = h;
            }
            run.push(p);
          }
        }
        flush();
      };

      // Latitude / longitude grid
      const gridStyle = { color: rgba(this.fg, this.dark ? 0.2 : 0.16), width: 0.8 };
      for (let lat = -60; lat <= 60; lat += 30) {
        const z = Math.sin((lat * Math.PI) / 180),
          rr = Math.cos((lat * Math.PI) / 180);
        const pts = [];
        for (let k = 0; k <= 72; k++) {
          const a = (2 * Math.PI * k) / 72;
          pts.push([rr * Math.cos(a), rr * Math.sin(a), z]);
        }
        addPolyline(pts, gridStyle, true);
      }
      for (let lon = 0; lon < 180; lon += 30) {
        const a = (lon * Math.PI) / 180;
        const pts = [];
        for (let k = 0; k <= 72; k++) {
          const t = (2 * Math.PI * k) / 72;
          pts.push([Math.cos(t) * Math.cos(a), Math.cos(t) * Math.sin(a), Math.sin(t)]);
        }
        addPolyline(pts, gridStyle, true);
      }

      const real = this.samples.map((s) => ({ s, ...this.realize(s, now) }));

      // Tangent plane patch at x, shown once there are tangential samples
      if (real.some((r) => r.s.method === "tangential")) {
        let e1 = cross(this.x, [0, 0, 1]);
        if (norm(e1) < 1e-6) e1 = cross(this.x, [1, 0, 0]);
        e1 = normalize(e1);
        const e2 = cross(this.x, e1);
        const half = Math.min(0.9, Math.max(0.3, 2 * this.sigma)),
          n = 8;
        const at = (i, j) =>
          add(this.x, add(scale(e1, half * (2 * i / n - 1)), scale(e2, half * (2 * j / n - 1))));
        const fill = rgba(this.hexRgb(COLORS.tangential), this.dark ? 0.12 : 0.1);
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            const quad = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)].map((p) => this.view(p));
            const mid = this.view(at(i + 0.5, j + 0.5));
            layer(mid).push((c) => {
              c.beginPath();
              quad.forEach((v, k) => {
                const [px, py] = this.toPx(v);
                k ? c.lineTo(px, py) : c.moveTo(px, py);
              });
              c.closePath();
              c.fillStyle = fill;
              c.fill();
            });
          }
        const outline = [at(0, 0), at(n, 0), at(n, n), at(0, n), at(0, 0)];
        addPolyline(outline, { color: rgba(this.hexRgb(COLORS.tangential), 0.55), width: 0.9, sub: 8 });
      }

      // Paths, then markers on top
      for (const r of real) {
        const col = this.hexRgb(COLORS[r.s.method]);
        const brown = r.s.method === "brownian";
        addPolyline(
          r.path,
          { color: rgba(col, r.dashed ? 0.75 : brown ? 0.75 : 0.9), width: brown ? 1.1 : r.dashed ? 1.4 : 2, dashed: !!r.dashed },
          r.onSphere
        );
      }
      for (const r of real) {
        const v = this.view(r.point);
        layer(v).push((c) => this.marker(c, v, COLORS[r.s.method], P.markerSize));
      }
      const xv = this.view(this.x);
      layer(xv).push((c) => {
        this.marker(c, xv, COLORS.data, P.dataSize, 2);
        this.label(c, xv);
      });

      // Opaque sphere, then the hidden layer faded on top of it (it is all inside the disk), then the visible layer
      this.drawSphere(ctx);
      ctx.save();
      ctx.globalAlpha = P.backAlpha;
      for (const op of back) op(ctx);
      ctx.restore();
      this.drawRim(ctx);
      for (const op of front) op(ctx);

      this.drawPanel(real);

      if (this.samples.some((s) => !s.done)) this.requestDraw(); // keep animating
    }

    drawSphere(ctx) {
      const c = this.w / 2,
        r = this.w * P.radius;
      // Light from the upper left. Light theme: near-white ball with a soft grey shade toward the lower right.
      // Dark theme: a little lighter than the page.
      const hi = mix(this.bg, this.fg, this.dark ? 0.15 : 0.0);
      const mid = mix(this.bg, this.fg, this.dark ? 0.1 : 0.05);
      const lo = mix(this.bg, this.fg, this.dark ? 0.05 : 0.14);
      const g = ctx.createRadialGradient(c - 0.35 * r, c - 0.4 * r, 0.05 * r, c, c, r);
      g.addColorStop(0, rgba(hi));
      g.addColorStop(0.6, rgba(mid));
      g.addColorStop(1, rgba(lo));
      ctx.beginPath();
      ctx.arc(c, c, r, 0, 2 * Math.PI);
      ctx.fillStyle = g;
      ctx.fill();
    }

    drawRim(ctx) {
      const c = this.w / 2,
        r = this.w * P.radius;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, 2 * Math.PI);
      ctx.strokeStyle = rgba(this.fg, 0.4);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    strokePath(ctx, V, style) {
      ctx.beginPath();
      V.forEach((v, k) => {
        const [px, py] = this.toPx(v);
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.strokeStyle = style.color;
      ctx.lineWidth = style.width;
      ctx.lineJoin = ctx.lineCap = "round";
      ctx.setLineDash(style.dashed ? [4, 3] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Method-colored fill with a white edge (same marker style as the DiMS figures), plus a thin dark outer
    // ring so the white edge still separates the marker from a light sphere or page.
    marker(ctx, v, color, size, edge = 1.6) {
      const [px, py] = this.toPx(v);
      this.dot(ctx, px, py, color, size, edge);
    }

    // ─── Parameter-space panel ───────────────────────────────────────────────
    // X⁻¹ for the post's chart X(u1, u2) = (sin u1 cos u2, sin u1 sin u2, cos u1). Points off the sphere are
    // first projected radially (p/|p|). u2 is undefined at the poles; atan2 then returns some value, and the
    // path drawing below breaks the line there instead of connecting across.
    toUV(p) {
      const n = norm(p);
      const u1 = Math.acos(Math.max(-1, Math.min(1, p[2] / n)));
      let u2 = Math.atan2(p[1], p[0]);
      if (u2 < 0) u2 += 2 * Math.PI;
      return [u1, u2];
    }
    uvPx(u1, u2) {
      const r = this.prect;
      return [r.x + (u2 / (2 * Math.PI)) * r.w, r.y + (1 - u1 / Math.PI) * r.h]; // u1 = π at the top, as in Fig. 2
    }

    // A path on the sphere in (u1, u2). Crossing the seam u2 = 0 / 2π: draw out of the rectangle on one side
    // (clipped) and come back in from the other. A large jump in u2 that is not a seam crossing only happens
    // next to a pole, where the chart is singular: the line is broken there.
    strokeUV(ctx, pts, color, width) {
      const TAU = 2 * Math.PI;
      ctx.beginPath();
      let prev = null;
      for (const p of pts) {
        const [u1, u2] = this.toUV(p);
        if (!prev) ctx.moveTo(...this.uvPx(u1, u2));
        else {
          const d = u2 - prev[1];
          const dw = ((((d + Math.PI) % TAU) + TAU) % TAU) - Math.PI; // shortest signed change in u2
          if (Math.abs(dw) > P.poleJump) ctx.moveTo(...this.uvPx(u1, u2));
          else if (Math.abs(d) > Math.PI) {
            const sh = d > 0 ? -TAU : TAU;
            ctx.lineTo(...this.uvPx(u1, u2 + sh));
            ctx.moveTo(...this.uvPx(prev[0], prev[1] - sh));
            ctx.lineTo(...this.uvPx(u1, u2));
          } else ctx.lineTo(...this.uvPx(u1, u2));
        }
        prev = [u1, u2];
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = ctx.lineCap = "round";
      ctx.stroke();
    }

    // Text runs: [text, "main" | "math" | "cal", level] with level −1 = subscript
    runs(ctx, parts, x, y, size, align = "center") {
      const fontOf = ([, f, lv]) =>
        (f === "math" ? "italic " : "") +
        Math.round(lv ? size * 0.7 : size) +
        "px " +
        (f === "math" ? FONT_MATH : f === "cal" ? FONT_CAL : FONT_MAIN);
      let width = 0;
      const ws = parts.map((r) => {
        ctx.font = fontOf(r);
        const m = ctx.measureText(r[0]).width;
        width += m;
        return m;
      });
      let cx = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      parts.forEach((r, i) => {
        ctx.font = fontOf(r);
        ctx.fillText(r[0], cx, y + (r[2] ? 0.3 * size : 0));
        cx += ws[i];
      });
    }

    drawPanel(real) {
      if (!this.prect) return;
      const ctx = this.pctx,
        r = this.prect;
      ctx.clearRect(0, 0, this.pw, this.ph);
      const fg = (a) => rgba(this.fg, a);

      // light-blue rectangle, as in the post's Figures 2, 5 and 6
      ctx.fillStyle = this.dark ? "rgba(110,165,200,0.22)" : "rgba(173,216,230,0.55)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      // lines at u1 ∈ {0, π/2, π} and u2 ∈ {0, π, 2π}, extended a little past the rectangle like axis ticks
      const ext = 7;
      ctx.lineWidth = 1.2;
      for (const [k, u1] of [[0, 0], [1, Math.PI / 2], [2, Math.PI]]) {
        const y = this.uvPx(u1, 0)[1];
        ctx.strokeStyle = fg(k === 1 ? 0.35 : 0.75);
        ctx.beginPath();
        ctx.moveTo(r.x - ext, y);
        ctx.lineTo(r.x + r.w + ext, y);
        ctx.stroke();
      }
      for (const [k, u2] of [[0, 0], [1, Math.PI], [2, 2 * Math.PI]]) {
        const x = this.uvPx(0, u2)[0];
        ctx.strokeStyle = fg(k === 1 ? 0.35 : 0.75);
        ctx.beginPath();
        ctx.moveTo(x, r.y - ext);
        ctx.lineTo(x, r.y + r.h + ext);
        ctx.stroke();
      }
      // tick labels and axis labels (KaTeX fonts)
      ctx.fillStyle = fg(0.75);
      const fs = 13;
      const PI = ["\u03c0", "math"];
      this.runs(ctx, [["0", "main"]], r.x - ext - 4, this.uvPx(0, 0)[1], fs, "right");
      this.runs(ctx, [PI, ["/2", "main"]], r.x - ext - 4, this.uvPx(Math.PI / 2, 0)[1], fs, "right");
      this.runs(ctx, [PI], r.x - ext - 4, this.uvPx(Math.PI, 0)[1], fs, "right");
      const ty = r.y + r.h + ext + 9;
      this.runs(ctx, [["0", "main"]], this.uvPx(0, 0)[0], ty, fs);
      this.runs(ctx, [PI], this.uvPx(0, Math.PI)[0], ty, fs);
      this.runs(ctx, [["2", "main"], PI], this.uvPx(0, 2 * Math.PI)[0], ty, fs);
      ctx.fillStyle = fg(0.85);
      this.runs(ctx, [["u", "math"], ["2", "main", -1]], r.x + r.w / 2, ty + 18, 16);
      ctx.save();
      ctx.translate(r.x - ext - 46, r.y + r.h / 2);
      ctx.rotate(-Math.PI / 2);
      this.runs(ctx, [["u", "math"], ["1", "main", -1]], 0, 0, 16);
      ctx.restore();
      this.runs(ctx, [["Parameter space, ", "main"], ["U", "cal"]], r.x + r.w / 2, r.y - 16, 14);

      // paths of on-sphere samples, clipped to the rectangle
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      for (const s of real) {
        if (!s.onSphere) continue;
        const brown = s.s.method === "brownian";
        this.strokeUV(ctx, s.path, rgba(this.hexRgb(COLORS[s.s.method]), brown ? 0.75 : 0.9), brown ? 1.1 : 2);
      }
      ctx.restore();

      // markers: only samples that lie ON the sphere have chart coordinates (ambient / tangential ones don't)
      const at = (p) => this.uvPx(...this.toUV(p));
      for (const s of real) {
        if (!s.onSphere) continue;
        const [px, py] = at(s.point);
        this.dot(ctx, px, py, COLORS[s.s.method], P.markerSize);
      }
      const [xx, xy] = at(this.x);
      this.dot(ctx, xx, xy, COLORS.data, P.dataSize, 2);
    }

    dot(ctx, px, py, color, size, edge = 1.6) {
      ctx.beginPath();
      ctx.arc(px, py, size + edge / 2 + 0.6, 0, 2 * Math.PI);
      ctx.fillStyle = this.dark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.35)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = edge;
      ctx.stroke();
    }
    ring(ctx, px, py, color, size) {
      ctx.beginPath();
      ctx.arc(px, py, size - 0.4, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 4.6;
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }

    label(ctx, v) {
      const [px, py] = this.toPx(v);
      ctx.font = `italic 700 17px ${FONT_BOLD_MATH}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      // halo in the page color keeps the label readable over samples and grid lines
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(this.bg, 0.85);
      ctx.strokeText("x", px - 16, py - 7);
      ctx.fillStyle = rgba(this.fg, 0.95);
      ctx.fillText("x", px - 16, py - 7);
    }

    hexRgb(hex) {
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    // ─── Pointer: drag to rotate, click on the sphere to move x ──────────────
    bindPointer() {
      const cv = this.canvas;
      let start = null,
        last = null,
        moved = false;
      cv.addEventListener("pointerdown", (e) => {
        cv.setPointerCapture(e.pointerId);
        start = last = [e.clientX, e.clientY];
        moved = false;
      });
      cv.addEventListener("pointermove", (e) => {
        if (!start) return;
        const dx = e.clientX - last[0],
          dy = e.clientY - last[1];
        if (!moved && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > P.clickTol) {
          moved = true;
          cv.classList.add("snw-dragging");
        }
        if (moved) {
          // horizontal drag spins about the screen's vertical axis, vertical drag about its horizontal axis
          this.R = orthonormalize(matMul(matMul(rotY(dx * P.rotSpeed), rotX(dy * P.rotSpeed)), this.R));
          this.requestDraw();
        }
        last = [e.clientX, e.clientY];
      });
      const end = (e) => {
        if (!start) return;
        if (!moved && e.type === "pointerup") {
          const rect = cv.getBoundingClientRect();
          const c = this.w / 2,
            r = this.w * P.radius;
          const sx = (e.clientX - rect.left - c) / r,
            sy = -(e.clientY - rect.top - c) / r;
          const r2 = sx * sx + sy * sy;
          if (r2 < 1) {
            // front-facing point under the cursor, mapped back to world coordinates
            this.x = normalize(matVec(matT(this.R), [sx, sy, Math.sqrt(1 - r2)]));
            this.finishAll();
            this.requestDraw();
          }
        }
        start = null;
        cv.classList.remove("snw-dragging");
      };
      cv.addEventListener("pointerup", end);
      cv.addEventListener("pointercancel", end);
    }
  }

  function init() {
    const els = document.querySelectorAll(".sphere-noise-widget");
    if (!els.length) return;
    injectStyles();
    const widgets = [];
    els.forEach((el) => {
      if (!el.dataset.snwReady) {
        el.dataset.snwReady = "1";
        widgets.push(new SphereNoiseWidget(el));
      }
    });
    // Canvas text doesn't trigger web-font loading by itself: load explicitly, then redraw.
    if (document.fonts && widgets.length) {
      Promise.all([
        document.fonts.load(`italic 700 17px "SNW BoldMath"`),
        document.fonts.load(`italic 13px "SNW Math"`),
        document.fonts.load(`13px "SNW Main"`),
        document.fonts.load(`14px "SNW Cal"`),
      ])
        .then(() => widgets.forEach((w) => w.requestDraw()))
        .catch(() => {});
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
