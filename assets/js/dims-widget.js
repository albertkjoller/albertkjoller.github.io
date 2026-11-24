/*
 * Interactive DiMS figure.
 *
 * Toy problem: a two-weight linear "network" f(x) = θ2·θ1·x fit to the single
 * point (1, 1), i.e. L(θ) = ½(θ1·θ2 − 1)². Its minimum level set S* is the
 * hyperbola θ1·θ2 = 1 (two branches), created by the rescaling symmetry.
 *
 * Usage in a post:
 *   <div class="dims-widget" data-preset="landscape"></div>
 *   <script src="/assets/js/dims-widget.js" defer></script>
 *
 * Optional attributes (override the preset):
 *   data-geometry = gradflow | flat | curved
 *   data-friction = none | constant | dims
 *   data-toggles  = "geometry,friction"   (which switches to show)
 *   data-buttons  = "random,many,sample,reset"
 *   data-max-size = 520                    (max width in px)
 *
 * Dynamics (state α, velocity v, g = ∇L, H = ∇²L):
 *   gradflow: α̇ = −g
 *   flat:     α̈ = −κ g − η v
 *   curved:   α̈ = −(vᵀHv + κ) · g / (1 + |g|²) − η v     (DiMS, metric G = I + g gᵀ)
 *   η: none → 0, constant → γ, dims → η0 · sqrt(T) + ηmin,  T = ½ vᵀ G v
 *
 * Visual encoding (same in every figure):
 *   color  = method / dynamics (see COLORS)
 *   size   = single sample (large marker, thick path) vs. many samples (small marker, thin faint path)
 *   edge   = always white; fill never changes (on/off-valley counts are reported in the text below)
 *   constant friction vs. DiMS: same hue families, very different lightness (pale blue vs. deep teal)
 */
(function () {
  "use strict";

  // ─── Tunable parameters ────────────────────────────────────────────────────
  const P = {
    domain: 6, // plot shows [-domain, domain]²
    kappa: 1.0, // gravity / coupling constant κ
    // Constant friction is matched per particle to DiMS's friction at launch: γ = η0·√T₀ + ηmin.
    // Launched from θ* (zero potential), energy only decreases, so T(t) ≤ T₀ and DiMS never brakes harder.
    eta0: 1.0, // DiMS friction strength η0, in η = η0·√T + ηmin
    etaMin: 0.1, // friction floor ηmin (0 = pure DiMS, as in the post). Without it, particles take very long to settle.
    // ONE base Gaussian for everything: the Laplace approximation N(0, (H(θ*) + λI)⁻¹). It is used as the
    // position offset for Laplace samples and as the initial velocity for every other method.
    // λ = 0.2 puts ~3.3× more spread along the valley than across it (H is singular along the valley, so the
    // prior alone sets that spread) — closer to high dimensions, where flat directions dominate.
    lambda: 0.2,
    dragScale: 1.2, // velocity per unit of drag distance (in θ units)
    simSpeed: 3, // simulated time per second of wall-clock time
    maxTime: 200, // stop simulating a particle after this much simulated time
    nMany: 50, // samples for every "many" button
    goodLoss: 0.02, // a sample counts as "on the set of minima" below this loss
    trailMax: 4000, // max stored trail points per particle
    // "Many" samples only show the last part of their path (as in the videos): this many seconds of
    // animation, fading from tailFadeMin × full opacity at the oldest end to full opacity at the marker.
    // Single samples keep their full path.
    tailSeconds: 1.0,
    tailFadeMin: 0.2,
    tailAlpha: 0.6, // opacity of the newest part of a "many" tail
    // Density strip under the comparison figure (Gaussian KDE, Silverman bandwidth with a floor).
    densityAlong: [-2.5, 2.5], // x-range for u = ½ log|θ₁/θ₂|; the valley inside the ±6 plot spans |u| ≤ 1.8
    densityAcross: [-1.5, 3.5], // x-range for w = θ₁θ₂ (valley at w = 1)
    // Bandwidth floor as a fraction of the panel range. Stops on-valley methods (all at w ≈ 1) from
    // collapsing into an infinitely tall spike that flattens every other curve.
    densityBwFloor: 0.02,
    // Energy / loss time series (Brake Smart figure)
    funcBelow: 0.42, // function panel under the 3D view: height as a fraction of the 3D view's size
    statsSideBySide: 680, // min widget width (px) for plot + time series side by side; narrower stacks them
    // Fixed y-axes (values outside are clipped at the edge of the panel):
    statsEnergyRange: [-4, 2], // log10 range of the energy axis, 10⁻⁴ … 10²
    statsLossMax: 1, // default top of the loss axis; a preset can override it with `lossMax`
    histMax: 20000, // max stored time-series points per particle
    // 3D surface view (preset "surface"): the loss surface (θ₁, θ₂, L(θ)) drawn at true scale, 1:1:1.
    surfDomain: 2.2, // shows θ ∈ [−surfDomain, surfDomain]²
    surfCap: 2.5, // the surface is cut off (smoothly) above this loss; the walls keep rising, ~600 at the corners of ±6
    surfGrid: 56, // grid cells per side
    surfAutoRotate: 0.12, // radians per second until the reader drags the view
    surfMaxSize: 540, // the 3D view may be larger than the 2D plots (it has nothing underneath)
    fitPhone: 0.52, // on phones the pinned figure (plot + buttons) takes at most this fraction of the screen height
    metricGrid: 1, // spacing of the grid of indicatrices (centres at multiples of it, so it contains (0,0) and (±1,±1))
    metricRadius: 0.2, // their size: every ellipse is the set of floor steps v with vᵀG(θ)v = r²
    liftIndicatrices: true, // also draw the indicatrices on the surface, where they become circles
    showTangentPlane: false, // draw a tangent plane (with its circle of equal-length steps) on the surface
    tangentAt: [-0.55, 1.05], // where the tangent plane touches the surface (on a steep wall)
    tangentSize: 0.5,
    metricColor: "#e67e22", // the highlighted indicatrix and the tangent plane (orange = surface/geometry, as in the DiMS equation)
    metricRGB: [230, 126, 34],
    metricPlaneAlpha: 0.32, // opacity of the tangent plane
    tangentBias: 0.25, // how far in front of the surface (depth units) the plane is sorted, so it stays visible // half-width of the drawn tangent-plane patch (in θ units)
    surfFloor: -1.3, // height of the parameter-space plane drawn underneath the surface
    // ODE solver: adaptive Dormand–Prince 5(4)
    tol: 1e-7, // per-step error tolerance (relative to 1 + |state|)
    hMin: 1e-6, // smallest step; accepted regardless of the error estimate
    hMax: 0.1, // largest step
    maxSubsteps: 2000, // per particle per frame
  };
  const STAR = [1, 1];

  const COLORS = {
    laplace: "#8c8c8c", // gray
    rlaplace: "#e67e22", // orange
    none: "#c0392b", // red: gravity, no friction
    constant: "#85c4ee", // light blue — kept pale so it reads clearly lighter than DiMS
    dims: "#00695c", // teal — kept deep so it reads clearly darker than constant friction
    gradflow: "#8e44ad", // purple: gradient descent
  };
  function colorFor(cfg) {
    if (cfg.method === "laplace") return COLORS.laplace;
    if (cfg.geometry === "gradflow") return COLORS.gradflow;
    if (cfg.gravity === false) return COLORS.rlaplace;
    return COLORS[cfg.friction] || COLORS.dims;
  }

  // Methods for the comparison figure. All sample from θ* with the same base Gaussian.
  const METHODS = {
    laplace: { label: "Laplace", cfg: { method: "laplace" } },
    rlaplace: {
      label: "Riemannian Laplace",
      cfg: { geometry: "curved", friction: "none", gravity: false, stop: "1" },
    },
    // Gravity without friction never comes to rest, so its sample is its position at a fixed time
    gravity: {
      label: "Gravity",
      cfg: { geometry: "curved", friction: "none", gravity: true, stop: "20" },
    },
    constant: {
      label: "Constant friction",
      cfg: { geometry: "curved", friction: "constant", gravity: true, stop: undefined },
    },
    dims: { label: "DiMS", cfg: { geometry: "curved", friction: "dims", gravity: true, stop: undefined } },
  };


  const PRESETS = {
    landscape: {
      geometry: "gradflow",
      friction: "none",
      interaction: true,
      funcPanel: true, // the model f_θ(x) = θ₁θ₂·x next to the parameter plot
      buttons: ["reset"],
      hint: "Click anywhere to drop a ball, or hover to see that $\\boldsymbol{\\theta}$'s function. Every $\\boldsymbol{\\theta}$ on the set of minima gives the same line.",
    },
    laplace: {
      geometry: "gradflow",
      friction: "none",
      interaction: false,
      laplace: true,
      buttons: ["sample", "reset"],
      hint: "Press Sample to draw from the Laplace approximation.",
    },
    inertia: {
      geometry: "flat",
      friction: "none",
      interaction: true,
      toggles: ["friction"],
      buttons: ["random", "reset"],
      hint: "Drag to launch a particle, or click to release it at rest.",
    },
    manifold: {
      geometry: "curved",
      friction: "none",
      interaction: true,
      stats: true,
      runTime: 20,
      toggles: ["geometry"],
      lossMax: 5.0, // for the energy / loss time series panel
      buttons: ["random", "reset"],
      hint: "Drag to launch a ball, or press Launch. × marks a run where the solver failed.",
    },
    dims: {
      geometry: "curved",
      friction: "dims",
      interaction: true,
      slider: true, // η0 slider: friction is introduced here, so let readers trade exploration for stopping
      stats: true, // energy and loss vs. time next to the plot (as in the paper's videos)
      runTime: 20, // every launch runs for exactly this much simulated time (fixes the time axis)
      lossMax: 3.0, // for the energy / loss time series panel
      toggles: ["friction"],
      buttons: ["random", "reset"],
      hint: "Drag to launch a ball, or press Launch. A lower η₀ explores further. × marks a run where the solver failed.",
    },
    // Riemannian Laplace: geodesics on the loss surface (no gravity, no friction) from θ*, with the
    // Laplace velocity distribution, stopped at a fixed time t (heuristically t = 1).
    rlaplace: {
      geometry: "curved",
      friction: "none",
      gravity: false,
      stop: "1",
      simSpeed: 1,
      interaction: true,
      toggles: ["stop"],
      buttons: ["geodesics", "reset"],
      hint: "Press Sample to shoot geodesics, and change the stopping time with Stop at.",
    },
    // Side-by-side comparison: one/many samples per method, all from θ* with the same base Gaussian.
    sample: {
      geometry: "curved",
      friction: "dims",
      interaction: true,
      methods: ["laplace", "rlaplace", "gravity", "constant", "dims"],
      buttons: ["one", "reset"],
      hint: "One sample gives the same initial velocity to every method.",
    },
    // 3D view of the loss surface: drag to rotate, launch particles that move ON the surface.
    surface: {
      geometry: "gradflow",
      friction: "none",
      motion: "gradflow",
      view3d: true,
      funcPanel: true, // the fitted line f_θ(x) = θ₁θ₂·x, stacked under the 3D view
      simSpeed: 1,
      buttons: ["drop1", "reset"],
      hint: "Drop a ball to run gradient descent. Drag to rotate.",
    },
    // Finale: the loss surface from the opening figure, now with a whole DiMS ensemble launched from θ*.
    // A wider θ range than the opening view, so the ensemble's spread along the set of minima stays in view.
    finale: {
      geometry: "curved",
      friction: "dims",
      view3d: true,
      surfDomain: 3.0,
      simSpeed: 1.5, // half the usual speed, so the ensemble can be seen rolling before it settles
      interaction: false,
      slider: true,
      toggles: ["friction"],
      buttons: ["many", "random", "reset"],
      hint: "Switch the friction or change η₀, and launch again. Drag to rotate.",
    },
    // The same surface, view only (slowly rotating, no controls): for introducing the loss surface as a manifold.
    surfaceView: {
      geometry: "curved",
      friction: "none",
      view3d: true,
      static3d: true,
      metricViz: true, // metric indicatrices on the floor (+ a tangent plane if P.showTangentPlane)
      buttons: [],
      hint: "Ellipses: steps of equal length on the surface. Drag to rotate.",
    },
    playground: {
      geometry: "curved",
      friction: "dims",
      interaction: true,
      toggles: ["geometry", "friction"],
      buttons: ["random", "many", "reset"],
      hint: "Drag to launch, click to release at rest.",
    },
  };

  const LABELS = {
    geometry: { title: "Parameter space", options: { flat: "Flat", curved: "Curved" } },
    friction: { title: "Friction", options: { none: "None", constant: "Constant", dims: "DiMS" } },
    // Arrays keep their order (object keys like "1" would be sorted before "0.5").
    motion: { title: "Motion", options: { gradflow: "Gradient descent", geodesic: "Geodesic", dims: "DiMS" } },
    stop: { title: "Stop at", options: [["0.5", "t = 0.5"], ["1", "t = 1"], ["2", "t = 2"], ["4", "t = 4"]] },
    buttons: {
      random: "Launch",
      one: "One sample",
      many: `Launch ${P.nMany} from $\\boldsymbol{\\theta}^{\\ast}$`,
      few: "Launch 12 from θ*",
      drop: "Drop 8 balls",
      drop1: "Drop a ball",
      sample: "Sample",
      geodesics: "Sample",
      reset: "Reset",
    },
  };

  // ─── Loss and dynamics ─────────────────────────────────────────────────────
  const loss = (x, y) => 0.5 * (x * y - 1) ** 2;
  const gradL = (x, y) => [y * (x * y - 1), x * (x * y - 1)]; // ∇L
  const onValley = (x, y) => loss(x, y) < P.goodLoss;
  // Total energy H = T + V, with T = ½ vᵀGv (G = I + g gᵀ on the curved surface, I in flat space) and V = κL.
  function energy(s, cfg) {
    const [x, y, vx, vy] = s;
    const r = x * y - 1;
    const gv = r * y * vx + r * x * vy;
    const T = 0.5 * (vx * vx + vy * vy + (cfg.geometry === "curved" ? gv * gv : 0));
    return T + (cfg.gravity === false ? 0 : P.kappa) * loss(x, y);
  }

  function deriv(s, cfg) {
    const x = s[0],
      y = s[1],
      vx = s[2],
      vy = s[3];
    const r = x * y - 1;
    const gx = r * y,
      gy = r * x;
    if (cfg.geometry === "gradflow") return [-gx, -gy, 0, 0];

    const speed2 = vx * vx + vy * vy;
    const gv = gx * vx + gy * vy;
    let eta = 0;
    if (cfg.friction === "constant") eta = cfg.gamma;
    else if (cfg.friction === "dims") {
      // T = ½ vᵀGv with G = I + g gᵀ (curved) or G = I (flat)
      const T = 0.5 * (cfg.geometry === "curved" ? speed2 + gv * gv : speed2);
      eta = (cfg.eta0 ?? P.eta0) * Math.sqrt(T) + P.etaMin;
    }

    const kappa = cfg.gravity === false ? 0 : P.kappa;
    let ax, ay;
    if (cfg.geometry === "flat") {
      ax = -kappa * gx;
      ay = -kappa * gy;
    } else {
      const hxx = y * y,
        hxy = 2 * x * y - 1,
        hyy = x * x;
      const vHv = hxx * vx * vx + 2 * hxy * vx * vy + hyy * vy * vy;
      const c = (vHv + kappa) / (1 + gx * gx + gy * gy);
      ax = -c * gx;
      ay = -c * gy;
    }
    return [vx, vy, ax - eta * vx, ay - eta * vy];
  }

  // Adaptive Dormand–Prince 5(4) step. Returns the 5th-order solution and a scaled error estimate
  // (≤ 1 means the step is accepted). Fixed-step RK4 drifted up to ~10% in energy for frictionless
  // particles started high on the curved surface; this keeps the drift below ~1e-4 with fewer steps.
  const DP_A = [
    [],
    [1 / 5],
    [3 / 40, 9 / 40],
    [44 / 45, -56 / 15, 32 / 9],
    [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
    [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
    [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
  ];
  const DP_B5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
  const DP_B4 = [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40];
  function dopri(s, h, cfg) {
    const k = [];
    for (let i = 0; i < 7; i++) {
      const si = s.map((v, d) => v + h * DP_A[i].reduce((acc, a, j) => acc + a * k[j][d], 0));
      k.push(deriv(si, cfg));
    }
    const y = s.map((v, d) => v + h * DP_B5.reduce((acc, b, j) => acc + b * k[j][d], 0));
    let err = 0;
    for (let d = 0; d < 4; d++) {
      const e = h * DP_B5.reduce((acc, b, j) => acc + (b - DP_B4[j]) * k[j][d], 0);
      err = Math.max(err, Math.abs(e) / (P.tol * (1 + Math.abs(s[d]))));
    }
    return [y, err];
  }

  // Base (Laplace) covariance Σ = (H(θ*) + λI)⁻¹ and its Cholesky factor.
  function laplaceCov(lambda) {
    const [x, y] = STAR;
    const a = y * y + lambda,
      b = 2 * x * y - 1,
      c = x * x + lambda;
    const det = a * c - b * b;
    const S = [c / det, -b / det, a / det]; // [Σxx, Σxy, Σyy]
    const l11 = Math.sqrt(S[0]);
    const l21 = S[1] / l11;
    const l22 = Math.sqrt(S[2] - l21 * l21);
    return { S, L: [l11, l21, l22] };
  }
  const COV = laplaceCov(P.lambda);

  function gauss() {
    let u = 0,
      v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  // One draw from the base Gaussian N(0, Σ).
  function sampleBase() {
    const z1 = gauss(),
      z2 = gauss();
    const [l11, l21, l22] = COV.L;
    return [l11 * z1, l21 * z1 + l22 * z2];
  }

  // Gaussian KDE of `vals` evaluated on `grid`. Bandwidth: Silverman's rule (robust spread), floored at hMin.
  function kde(vals, grid, hMin) {
    const n = vals.length;
    const mean = vals.reduce((s, v) => s + v, 0) / n;
    const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
    const sorted = [...vals].sort((a, b) => a - b);
    const q = (p) => sorted[Math.min(n - 1, Math.floor(p * (n - 1)))];
    const iqr = q(0.75) - q(0.25);
    const spread = Math.min(sd, iqr / 1.34) || sd;
    const h = Math.max(hMin, 0.9 * spread * Math.pow(n, -0.2));
    const c = 1 / (n * h * Math.sqrt(2 * Math.PI));
    return grid.map((g) => {
      let s = 0;
      for (const v of vals) {
        const z = (g - v) / h;
        if (z < 6 && z > -6) s += Math.exp(-0.5 * z * z);
      }
      return c * s;
    });
  }

  // ─── Styles (injected so PurgeCSS cannot strip them) ───────────────────────
  function injectStyles() {
    if (document.getElementById("dims-widget-styles")) return;
    const css = `
      @font-face { font-family: "DW Main"; font-style: normal; font-weight: 400;
        src: url(${KATEX_FONTS}KaTeX_Main-Regular.woff2) format("woff2"); }
      @font-face { font-family: "DW Math"; font-style: italic; font-weight: 400;
        src: url(${KATEX_FONTS}KaTeX_Math-Italic.woff2) format("woff2"); }
      @font-face { font-family: "DW BoldMath"; font-style: italic; font-weight: 700;
        src: url(${KATEX_FONTS}KaTeX_Math-BoldItalic.woff2) format("woff2"); }
      @font-face { font-family: "DW Cal"; font-style: normal; font-weight: 400;
        src: url(${KATEX_FONTS}KaTeX_Caligraphic-Regular.woff2) format("woff2"); }
      @font-face { font-family: "DW AMS"; font-style: normal; font-weight: 400;
        src: url(${KATEX_FONTS}KaTeX_AMS-Regular.woff2) format("woff2"); }
      .dims-widget { margin: 1.5rem 0; }
      .dims-widget:has(+ .caption) { margin-bottom: .2rem; } /* caption hugs the figure */
      .dims-widget canvas { display: block; margin: 0 auto; max-width: 100%; }
      .dims-widget canvas.dw-interactive { cursor: crosshair; touch-action: none; }
      .dims-widget canvas.dw-density { margin-top: .5rem; }
      .dims-widget { transition: opacity .18s ease; }
      .dims-widget.dw-switching { opacity: 0; }
      .dims-widget .dw-row { display: flex; justify-content: center; align-items: center; gap: 16px; }
      .dims-widget .dw-row canvas { margin: 0; }
      .dims-widget .dw-controls { display: flex; flex-wrap: wrap; gap: .5rem 1rem; justify-content: center;
        align-items: center; margin-top: .6rem; font-size: .8rem; }
      .dims-widget .dw-group { display: inline-flex; align-items: center; gap: .3rem; }
      .dims-widget .dw-group-title { color: var(--global-text-color-light, #777); margin-right: .1rem; }
      .dims-widget button { font: inherit; line-height: 1.4; padding: .2rem .7rem; border-radius: 4px; cursor: pointer;
        border: 1px solid var(--global-divider-color, rgba(0,0,0,.2)); background: transparent;
        color: var(--global-text-color, #222); }
      .dims-widget button:hover { border-color: var(--global-theme-color, #2e4057); }
      .dims-widget button.dw-active { background: var(--global-theme-color, #2e4057);
        border-color: var(--global-theme-color, #2e4057); color: var(--global-bg-color, #fff); }
      .dims-widget .dw-controls.dw-columns { align-items: flex-start; gap: .5rem 2rem; }
      .dims-widget .dw-block { display: flex; flex-direction: column; align-items: stretch; gap: .3rem; }
      .dims-widget .dw-block-title { font-size: .72rem; text-transform: uppercase; letter-spacing: .06em;
        color: var(--global-text-color-light, #777); text-align: center; }
      .dims-widget .dw-block button { text-align: left; }
      .dims-widget input[type="range"] { width: 6.5rem; accent-color: var(--global-theme-color, #2e4057); }
      .dims-widget input[type="range"]:disabled { opacity: .4; }
      .dims-widget .dw-value { min-width: 2.6rem; font-variant-numeric: tabular-nums; }
      .dims-widget .dw-hint { text-align: center; font-size: .75rem; line-height: 1.45; margin-top: .35rem;
        color: var(--global-text-color-light, #777); }
    `;
    const el = document.createElement("style");
    el.id = "dims-widget-styles";
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

  // ─── Figure typography ─────────────────────────────────────────────────────
  // Labels inside the figures use the KaTeX fonts (Computer Modern look), so they match the equations in the
  // text and the LaTeX-rendered videos. The fonts are declared in injectStyles() and loaded on demand.
  const KATEX_FONTS = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/fonts/";
  const FONT_MAIN = '"DW Main", "Latin Modern Roman", "Computer Modern", "Times New Roman", serif';
  const FONT_MATH = '"DW Math", "DW Main", "Latin Modern Math", "Times New Roman", serif';

  // Tiny LaTeX-ish markup for canvas labels. Plain text is upright; inside $…$ letters are math italic,
  // digits/operators upright, \name is an upright word (e.g. \log), _x / _{…} subscript, ^x / ^{…} superscript.
  // Supported LaTeX: _x ^x _{…} ^{…}, Greek letters (\theta, \Theta, …), a few symbols (\subseteq, \cdot, …),
  // font commands \mathcal{…} \mathbb{…} \boldsymbol{…} \mathbf{…} \mathrm{…} \text{…}, nested braces.
  // Any other command (\log, \exp, …) is set upright as an operator name.
  const GREEK = {
    alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ϵ", varepsilon: "ε", zeta: "ζ", eta: "η",
    theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π",
    rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "ϕ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
    Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  };
  const SYMBOLS = {
    subseteq: " ⊆ ", subset: " ⊂ ", in: " ∈ ", cdot: "⋅", times: " × ", to: " → ", approx: " ≈ ",
    leq: " ≤ ", geq: " ≥ ", neq: " ≠ ", infty: "∞", nabla: "∇", partial: "∂", ldots: "…", quad: " ",
    ",": " ", ";": " ", " ": " ", "{": "{", "}": "}",
  };
  const FONT_CMDS = { mathcal: "cal", mathbb: "bb", boldsymbol: "bmath", mathbf: "bmain", mathrm: "main", text: "text" };

  function parseRich(str) {
    const runs = [];
    const push = (text, font, level = 0) => {
      const last = runs[runs.length - 1];
      if (last && last.font === font && last.level === level) last.text += text;
      else runs.push({ text, font, level });
    };
    // [content, nextIndex] for "x", "\cmd" or "{…}" (nested braces) starting at i
    const group = (s, i) => {
      if (s[i] === "{") {
        let depth = 0;
        for (let j = i; j < s.length; j++) {
          if (s[j] === "{") depth++;
          else if (s[j] === "}" && --depth === 0) return [s.slice(i + 1, j), j + 1];
        }
        return [s.slice(i + 1), s.length];
      }
      if (s[i] === "\\") {
        const m = s.slice(i + 1).match(/^([A-Za-z]+|.)/);
        return [s.slice(i, i + 1 + m[0].length), i + 1 + m[0].length];
      }
      return [s[i] || "", i + 1];
    };
    // A letter: italic math by default (upright Greek capitals, as in LaTeX); otherwise the font command's font.
    // \mathcal and \mathbb only have Latin letters, so Greek falls back to the default.
    const letter = (ch, font, level) => {
      const latin = /[A-Za-z]/.test(ch);
      if (font && (latin || font === "bmath" || font === "bmain" || font === "main")) push(ch, font, level);
      else push(ch, /[Α-Ω]/.test(ch) ? "main" : "math", level);
    };
    const parseMath = (s, level, font) => {
      for (let i = 0; i < s.length; ) {
        const ch = s[i];
        if (ch === "\\") {
          const cmd = s.slice(i + 1).match(/^([A-Za-z]+|.)/)[0];
          i += 1 + cmd.length;
          if (GREEK[cmd]) letter(GREEK[cmd], font, level);
          else if (SYMBOLS[cmd] !== undefined) push(level ? SYMBOLS[cmd].trim() || SYMBOLS[cmd] : SYMBOLS[cmd], "main", level);
          else if (FONT_CMDS[cmd]) {
            const [txt, next] = group(s, i);
            if (FONT_CMDS[cmd] === "text") push(txt, "main", level);
            else parseMath(txt, level, FONT_CMDS[cmd]);
            i = next;
          } else push((runs.length ? " " : "") + cmd + " ", "main", level); // operator name
        } else if (ch === "_" || ch === "^") {
          const [txt, next] = group(s, i + 1);
          parseMath(txt, ch === "_" ? -1 : 1, font);
          i = next;
        } else if (ch === "{") {
          const [txt, next] = group(s, i);
          parseMath(txt, level, font);
          i = next;
        } else {
          if (/[A-Za-zͰ-Ͽ]/.test(ch)) letter(ch, font, level);
          else if (ch === "-") push("−", "main", level);
          else if (ch === "=" || ch === "+") push(level ? ch : " " + ch + " ", "main", level);
          else if (ch !== " " && ch !== "}") push(ch, font === "bmain" || font === "bmath" ? "bmain" : "main", level);
          i++;
        }
      }
    };
    for (let i = 0; i < str.length; ) {
      if (str[i] === "$") {
        let j = str.indexOf("$", i + 1);
        if (j < 0) j = str.length;
        parseMath(str.slice(i + 1, j), 0, null);
        i = j + 1;
      } else {
        push(str[i], "main");
        i++;
      }
    }
    return runs;
  }

  // Set a hint's (or button's) text and typeset any $…$ in it with the page's MathJax (hints are created after the page's
  // own typesetting pass, so MathJax never sees them otherwise).
  function setHint(el, text) {
    const MJ = window.MathJax;
    if (MJ && MJ.typesetClear) MJ.typesetClear([el]);
    el.textContent = text;
    if (!text.includes("$")) return;
    const run = () => window.MathJax && window.MathJax.typesetPromise && window.MathJax.typesetPromise([el]).catch(() => {});
    if (MJ && MJ.startup && MJ.startup.promise) MJ.startup.promise.then(run);
    else window.addEventListener("load", () => setTimeout(run, 0), { once: true }); // MathJax not loaded yet
  }

  // Draw rich text at (x, y). align: left | center | right; baseline: alphabetic | middle | top.
  function drawRich(ctx, str, x, y, size, align = "left", baseline = "alphabetic") {
    const runs = parseRich(str);
    const fontOf = (r) => {
      const px = (r.level ? Math.round(size * 0.7) : size) + "px ";
      switch (r.font) {
        case "math": return "italic " + px + FONT_MATH;
        case "bmath": return "italic 700 " + px + '"DW BoldMath", ' + FONT_MATH;
        case "bmain": return "700 " + px + FONT_MAIN;
        case "cal": return px + '"DW Cal", ' + FONT_MAIN;
        case "bb": return px + '"DW AMS", ' + FONT_MAIN;
        default: return px + FONT_MAIN;
      }
    };
    let width = 0;
    for (const r of runs) {
      ctx.font = fontOf(r);
      r.w = ctx.measureText(r.text).width;
      width += r.w;
    }
    let cx = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
    const by = baseline === "middle" ? y + 0.33 * size : baseline === "top" ? y + 0.8 * size : y;
    const prevAlign = ctx.textAlign,
      prevBase = ctx.textBaseline;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    for (const r of runs) {
      ctx.font = fontOf(r);
      ctx.fillText(r.text, cx, by + (r.level < 0 ? 0.22 * size : r.level > 0 ? -0.38 * size : 0));
      cx += r.w;
    }
    ctx.textAlign = prevAlign;
    ctx.textBaseline = prevBase;
  }

  // ─── Widget ────────────────────────────────────────────────────────────────
  class DimsWidget {
    constructor(root) {
      this.root = root;
      root.dimsWidget = this; // handle for the scrolling layout (initScrolly)
      this.clock = 0; // wall-clock seconds since start; trail points are stamped with it
      this.cam = { yaw: -0.75, elev: 0.6 }; // camera for the 3D view: yaw around vertical, elevation above floor
      this.applyPreset(root.dataset.preset);
      this.observe();
      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.frame(t));
    }

    // (Re)configure the widget for a preset and rebuild its DOM. Called once by the constructor, and again
    // by the scrolling layout whenever the reader scrolls to a step with a different figure.
    // opts.stats = "off" hides the energy/loss panels (they don't fit in a narrow sticky column).
    applyPreset(name, opts = {}) {
      const root = this.root;
      root.dataset.preset = name || "playground";
      const preset = PRESETS[root.dataset.preset] || PRESETS.playground;
      const list = (v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : null);
      this.cfg = {
        geometry: root.dataset.geometry || preset.geometry,
        friction: root.dataset.friction || preset.friction,
        gravity: preset.gravity !== false,
        stop: root.dataset.stop || preset.stop,
        motion: preset.motion,
      };
      this.view3d = !!preset.view3d;
      this.static3d = !!preset.static3d;
      this.surfD = preset.surfDomain || P.surfDomain; // half-width of the θ range shown in the 3D view
      this.metricViz = !!preset.metricViz;
      this.autoRotate = this.view3d;
      this.simSpeed = preset.simSpeed || P.simSpeed;
      this.interaction = preset.interaction;
      this.showLaplace = !!preset.laplace;
      this.methods = preset.methods || [];
      this.slider = !!preset.slider;
      // Compact mode: a pinned figure on a phone. Only the plot and its buttons, so the text keeps half the screen.
      this.compact = !!root.dataset.fitHeight && window.matchMedia("(max-width: 900px)").matches;
      this.stats = !!preset.stats && opts.stats !== "off" && !this.compact;
      this.funcPanel = !!preset.funcPanel && !this.compact;
      if (this.funcPanel) this.stats = true; // same side canvas and layout; drawn by drawFunc()
      this.runTime = Number(root.dataset.runTime) || preset.runTime || Infinity;
      this.lossMax = Number(root.dataset.lossMax) || preset.lossMax || P.statsLossMax;
      this.cfg.eta0 = P.eta0;
      this.toggles = list(root.dataset.toggles) || preset.toggles || [];
      this.buttons = list(root.dataset.buttons) || preset.buttons || ["reset"];
      this.hintText = preset.hint || "";
      this.maxSize = Number(root.dataset.maxSize) || 520;

      this.particles = [];
      this.samples = []; // static Laplace samples: { x, y, single }
      this.drag = null;
      this.hover = null;
      this.reported = false;
      this.visible = this.visible ?? true;
      // Drop parts that only some presets build
      this.density = this.statsCanvas = this.row = this.etaInput = this.surf = null;
      this.sizeKey = null; // force resize() to size the new canvases

      this.build();
      this.readTheme();
      this.resize();
      this.dirty = true;
    }

    build() {
      this.root.innerHTML = "";
      this.canvas = document.createElement("canvas");
      if (this.interaction) this.canvas.classList.add("dw-interactive");
      this.ctx = this.canvas.getContext("2d");
      if (this.stats) {
        // Plot and time-series panels side by side (stacked on narrow screens; see resize()).
        this.row = document.createElement("div");
        this.row.className = "dw-row";
        this.statsCanvas = document.createElement("canvas");
        this.sctx = this.statsCanvas.getContext("2d");
        this.row.appendChild(this.canvas);
        this.row.appendChild(this.statsCanvas);
        this.root.appendChild(this.row);
      } else this.root.appendChild(this.canvas);

      const controls = document.createElement("div");
      controls.className = "dw-controls";
      this.controlsEl = controls;
      this.toggleButtons = {};
      for (const key of this.toggles) {
        const spec = LABELS[key];
        if (!spec) continue;
        const group = document.createElement("span");
        group.className = "dw-group";
        const title = document.createElement("span");
        title.className = "dw-group-title";
        title.textContent = spec.title + ":";
        group.appendChild(title);
        this.toggleButtons[key] = {};
        for (const [value, label] of Array.isArray(spec.options) ? spec.options : Object.entries(spec.options)) {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = label;
          b.addEventListener("click", () => {
            this.cfg[key] = value;
            this.reset();
            this.syncToggles();
          });
          this.toggleButtons[key][value] = b;
          group.appendChild(b);
        }
        controls.appendChild(group);
      }
      // Comparison layout: [One sample / Reset] column next to a stacked column of per-method "many" buttons.
      if (this.methods.length) {
        // Density strip under the main plot: KDEs of the "many" samples along / across the valley.
        if (!this.compact) {
          this.density = document.createElement("canvas");
          this.density.className = "dw-density";
          this.dctx = this.density.getContext("2d");
          this.root.appendChild(this.density);
        }
        controls.classList.add("dw-columns");
        const block = (titleText) => {
          const el = document.createElement("div");
          el.className = "dw-block";
          const t = document.createElement("div");
          t.className = "dw-block-title";
          t.textContent = titleText;
          el.appendChild(t);
          return el;
        };
        const single = block("One draw, all methods");
        for (const key of this.buttons) {
          const b = document.createElement("button");
          b.type = "button";
          setHint(b, LABELS.buttons[key]); // typesets any $…$ in the label
          b.addEventListener("click", () => this.action(key));
          single.appendChild(b);
        }
        const manyBlock = block(`${P.nMany} samples per click`);
        for (const key of this.methods) {
          const b = document.createElement("button");
          b.type = "button";
          const swatch = document.createElement("span");
          swatch.textContent = "● ";
          swatch.style.color = colorFor({ ...METHODS[key].cfg, method: key });
          b.appendChild(swatch);
          b.appendChild(document.createTextNode(METHODS[key].label));
          b.addEventListener("click", () => this.sampleMethod(key, true));
          manyBlock.appendChild(b);
        }
        controls.appendChild(single);
        controls.appendChild(manyBlock);
        this.root.appendChild(controls);
        this.hint = document.createElement("div");
        this.hint.className = "dw-hint";
        setHint(this.hint, this.hintText);
        this.root.appendChild(this.hint);
        this.syncToggles();
        this.bindPointer();
        return;
      }
      // η0 slider (log scale). Applies to particles launched after it changes; running ones keep theirs.
      if (this.slider) {
        const group = document.createElement("span");
        group.className = "dw-group";
        const title = document.createElement("span");
        title.className = "dw-group-title";
        title.textContent = "η₀:";
        const input = document.createElement("input");
        input.type = "range";
        input.min = Math.log10(0.05);
        input.max = Math.log10(5);
        input.step = 0.01;
        input.value = Math.log10(P.eta0);
        const value = document.createElement("span");
        value.className = "dw-value";
        const show = () => (value.textContent = this.cfg.eta0.toFixed(2));
        input.addEventListener("input", () => {
          this.cfg.eta0 = Math.pow(10, Number(input.value));
          show();
        });
        show();
        group.appendChild(title);
        group.appendChild(input);
        group.appendChild(value);
        controls.appendChild(group);
        this.etaInput = input;
      }
      const actions = document.createElement("span");
      actions.className = "dw-group";
      for (const key of this.buttons) {
        const label = LABELS.buttons[key];
        if (!label) continue;
        const b = document.createElement("button");
        b.type = "button";
        setHint(b, label); // typesets any $…$ in the label
        b.addEventListener("click", () => this.action(key));
        actions.appendChild(b);
      }
      controls.appendChild(actions);
      this.root.appendChild(controls);

      this.hint = document.createElement("div");
      this.hint.className = "dw-hint";
      setHint(this.hint, this.hintText);
      this.root.appendChild(this.hint);

      this.syncToggles();
      this.bindPointer();
    }

    syncToggles() {
      if (this.etaInput) this.etaInput.disabled = this.cfg.friction === "none";
      for (const [key, buttons] of Object.entries(this.toggleButtons)) {
        for (const [value, b] of Object.entries(buttons)) b.classList.toggle("dw-active", this.cfg[key] === value);
      }
    }

    observe() {
      new ResizeObserver(() => this.resize()).observe(this.root);
      if (this.root.dataset.fitHeight) window.addEventListener("resize", () => this.resize());
      new IntersectionObserver((entries) => {
        this.visible = entries[0].isIntersecting;
      }).observe(this.root);
      new MutationObserver(() => {
        this.readTheme();
        this.dirty = true;
      }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }

    readTheme() {
      this.fg = readColor(this.root, "--global-text-color", "#222");
      this.font = FONT_MAIN;
      this.heat = this.buildHeat();
      this.bg = readColor(this.root, "--global-bg-color", "#fff");
      if (this.view3d) {
        this.buildSurface();
        this.floorHeat = this.buildHeat(this.surfD);
      }
    }

    resize() {
      const avail = this.root.clientWidth || this.maxSize;
      const sideBySide = this.stats && avail >= P.statsSideBySide && !this.view3d; // 3D: panel always below
      const funcBelow = this.view3d && this.funcPanel ? P.funcBelow : 0; // its height per unit of plot size
      let w = Math.max(240, Math.min(avail, this.maxSize));
      if (sideBySide) w = Math.min(this.maxSize, Math.floor(avail * 0.55));
      // data-fit-height="0.86": the WHOLE widget (plot + density strip / stacked time series + controls + hint)
      // must fit in this fraction of the window height. Used by the pinned figure of the scrolling layout.
      const fit = this.compact ? P.fitPhone : Number(this.root.dataset.fitHeight);
      if (this.compact && this.hint) this.hint.style.display = "none";
      if (fit) {
        const extras = (this.controlsEl ? this.controlsEl.offsetHeight : 0) + (this.hint ? this.hint.offsetHeight : 0) + 28;
        let f = 1; // widget height per unit of plot size
        if (this.density) f += 0.36 + 0.03;
        if (this.stats && !sideBySide) f += 0.6;
        w = Math.max(200, Math.min(w, Math.floor((window.innerHeight * fit - extras) / f)));
        // data-fit-uniform: one plot size for every preset, so the figure doesn't jump in size when the
        // scrolling layout switches presets. Uses the tallest layouts: stacked time series (factor 1.6,
        // one controls row) and the comparison figure (density strip, two-column controls).
        if (this.view3d && !this.compact) {
          // The 3D view has no strips under it: let it use the full height of the column.
          w = Math.max(240, Math.min(avail, P.surfMaxSize, Math.floor((window.innerHeight * fit - extras) / (1 + funcBelow))));
        } else if (this.root.dataset.fitUniform && !this.compact) {
          const Hf = window.innerHeight * fit;
          const wUni = Math.min((Hf - 110) / 1.6, (Hf - 215) / 1.39);
          w = Math.max(200, Math.min(w, Math.floor(wUni)));
        }
      }
      const key = `${w}|${avail}`;
      if (key === this.sizeKey) return;
      this.sizeKey = key;
      this.cssSize = w;
      const dpr = window.devicePixelRatio || 1;
      if (this.stats) {
        this.row.style.flexDirection = sideBySide ? "row" : "column";
        this.sW = sideBySide ? Math.min(avail - w - 16, fit ? 520 : 460, this.funcPanel ? w : Infinity) : w;
        this.sH = funcBelow ? Math.round(w * funcBelow) : sideBySide ? w : fit ? Math.round(Math.max(170, w * 0.6)) : Math.round(Math.max(240, w * 0.8));
        this.statsCanvas.style.width = this.sW + "px";
        this.statsCanvas.style.height = this.sH + "px";
        this.statsCanvas.width = Math.round(this.sW * dpr);
        this.statsCanvas.height = Math.round(this.sH * dpr);
        this.sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      this.canvas.style.width = this.canvas.style.height = w + "px";
      this.canvas.width = this.canvas.height = Math.round(w * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.margin = { l: 36, r: 8, t: 8, b: 34 };
      this.plot = w - this.margin.l - this.margin.r;
      if (this.density) {
        this.dH = Math.round(Math.max(130, w * 0.36));
        this.density.style.width = w + "px";
        this.density.style.height = this.dH + "px";
        this.density.width = Math.round(w * dpr);
        this.density.height = Math.round(this.dH * dpr);
        this.dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      this.dirty = true;
    }

    // θ ↔ px
    toPx(x, y) {
      const D = P.domain;
      return [this.margin.l + ((x + D) / (2 * D)) * this.plot, this.margin.t + ((D - y) / (2 * D)) * this.plot];
    }
    toTheta(px, py) {
      const D = P.domain;
      return [((px - this.margin.l) / this.plot) * 2 * D - D, D - ((py - this.margin.t) / this.plot) * 2 * D];
    }
    scale() {
      return this.plot / (2 * P.domain);
    }

    buildHeat(D = P.domain) {
      const N = 240;
      const c = document.createElement("canvas");
      c.width = c.height = N;
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(N, N);
      const Lmax = Math.log1p(loss(D, D));
      const bands = 14;
      const [R, G, B] = this.fg;
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const x = -D + ((i + 0.5) / N) * 2 * D;
          const y = D - ((j + 0.5) / N) * 2 * D;
          const s = Math.min(1, Math.log1p(loss(x, y)) / Lmax);
          const band = Math.floor(Math.sqrt(s) * bands) / bands;
          const k = (j * N + i) * 4;
          img.data[k] = R;
          img.data[k + 1] = G;
          img.data[k + 2] = B;
          img.data[k + 3] = Math.round(255 * (0.02 + 0.34 * band));
        }
      }
      ctx.putImageData(img, 0, 0);
      return c;
    }

    // ─── Interaction ─────────────────────────────────────────────────────────
    bindPointer() {
      const pos = (e) => {
        const r = this.canvas.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
      };
      const inPlot = ([px, py]) =>
        px >= this.margin.l && px <= this.margin.l + this.plot && py >= this.margin.t && py <= this.margin.t + this.plot;

      if (this.view3d) {
        // Drag to rotate (yaw left/right, elevation up/down). Stops the slow auto-rotation for good.
        this.canvas.style.cursor = "grab";
        this.canvas.style.touchAction = "none";
        let last = null;
        this.canvas.addEventListener("pointerdown", (e) => {
          this.canvas.setPointerCapture(e.pointerId);
          last = pos(e);
          this.autoRotate = false;
          this.canvas.style.cursor = "grabbing";
        });
        this.canvas.addEventListener("pointermove", (e) => {
          if (!last) return;
          const p = pos(e);
          this.cam.yaw -= (p[0] - last[0]) * 0.01;
          this.cam.elev = Math.min(1.35, Math.max(0.12, this.cam.elev + (p[1] - last[1]) * 0.01));
          last = p;
          this.dirty = true;
        });
        const end = () => {
          last = null;
          this.canvas.style.cursor = "grab";
        };
        this.canvas.addEventListener("pointerup", end);
        this.canvas.addEventListener("pointercancel", end);
        return;
      }

      this.canvas.addEventListener("pointermove", (e) => {
        const p = pos(e);
        this.hover = inPlot(p) ? this.toTheta(...p) : null;
        if (this.drag) this.drag.end = p;
        this.dirty = true;
      });
      this.canvas.addEventListener("pointerleave", () => {
        this.hover = null;
        this.dirty = true;
      });
      if (!this.interaction) return;

      this.canvas.addEventListener("pointerdown", (e) => {
        const p = pos(e);
        if (!inPlot(p)) return;
        this.canvas.setPointerCapture(e.pointerId);
        this.drag = { start: p, end: p };
      });
      this.canvas.addEventListener("pointerup", () => {
        if (!this.drag) return;
        const { start, end } = this.drag;
        this.drag = null;
        const a = this.toTheta(...start);
        const moved = Math.hypot(end[0] - start[0], end[1] - start[1]) > 6;
        let v = [0, 0];
        if (moved && this.cfg.geometry !== "gradflow") {
          const b = this.toTheta(...end);
          v = [(b[0] - a[0]) * P.dragScale, (b[1] - a[1]) * P.dragScale];
        }
        this.addParticle(a, v);
      });
    }

    action(key) {
      if (key === "reset") this.reset();
      else if (key === "random") this.addParticle(STAR, sampleBase());
      else if (key === "few") for (let i = 0; i < 12; i++) this.addParticle(STAR, sampleBase());
      else if (key === "drop" || key === "drop1") {
        // Random starting points on the visible part of the surface, released at rest.
        // "drop1" replaces the previous ball, so the figure always shows one clean path.
        if (key === "drop1") this.particles = [];
        const D = this.surfD * 0.9;
        for (let i = 0; i < (key === "drop1" ? 1 : 8); i++) {
          let x, y;
          do {
            x = (2 * Math.random() - 1) * D;
            y = (2 * Math.random() - 1) * D;
          } while (loss(x, y) > P.surfCap * 0.8 || loss(x, y) < 0.3);
          this.addParticle([x, y], [0, 0]);
        }
      }
      else if (key === "one") {
        // One Laplace draw d: Laplace sample at θ* + d, and d as the initial velocity for every other method.
        // Replaces everything currently shown (previous single draw and any "many" samples).
        this.particles = [];
        this.samples = [];
        const d = sampleBase();
        for (const m of this.methods) {
          if (m === "laplace") this.samples.push({ x: STAR[0] + d[0], y: STAR[1] + d[1], single: true });
          else this.addParticle(STAR, d, false, { ...METHODS[m].cfg, method: m });
        }
      }
      else if (key === "many" || key === "geodesics") {
        for (let i = 0; i < P.nMany; i++) this.addParticle(STAR, sampleBase(), true);
        this.reported = false;
      } else if (key === "sample") {
        for (let i = 0; i < P.nMany; i++) {
          const d = sampleBase();
          this.samples.push({ x: STAR[0] + d[0], y: STAR[1] + d[1], single: false });
        }
        const good = this.samples.filter((q) => onValley(q.x, q.y)).length;
        setHint(this.hint, `${good} of ${this.samples.length} samples (${Math.round(
          (100 * good) / this.samples.length,
        )}%) land on the set of minima.`);
      }
      this.dirty = true;
    }

    sampleMethod(key, many) {
      const m = METHODS[key];
      // "Many" replaces a single draw but accumulates with earlier "many" samples.
      this.particles = this.particles.filter((p) => p.many);
      this.samples = this.samples.filter((q) => !q.single);
      const n = many ? P.nMany : 1;
      for (let i = 0; i < n; i++) {
        const d = sampleBase();
        if (key === "laplace") this.samples.push({ x: STAR[0] + d[0], y: STAR[1] + d[1], single: !many });
        else this.addParticle(STAR, d, many, { ...m.cfg, method: key });
      }
      this.dirty = true;
    }

    reset() {
      this.particles = [];
      this.samples = [];
      setHint(this.hint, this.hintText);
      this.dirty = true;
    }

    addParticle(pos, vel, many = false, override = null) {
      const cfg = { ...this.cfg, ...override };
      if (cfg.motion === "gradflow") Object.assign(cfg, { geometry: "gradflow", friction: "none" });
      else if (cfg.motion === "geodesic") Object.assign(cfg, { friction: "none", gravity: false });
      else if (cfg.motion === "dims") Object.assign(cfg, { friction: "dims", gravity: true });
      // Constant friction = DiMS friction at launch (see P).
      const r = pos[0] * pos[1] - 1;
      const gv = r * pos[1] * vel[0] + r * pos[0] * vel[1];
      const T0 = 0.5 * (vel[0] ** 2 + vel[1] ** 2 + (cfg.geometry === "curved" ? gv * gv : 0));
      cfg.gamma = (cfg.eta0 ?? P.eta0) * Math.sqrt(T0) + P.etaMin;
      this.particles.push({
        s: [pos[0], pos[1], vel[0], vel[1]],
        t: 0,
        cfg,
        color: colorFor(cfg),
        many,
        trail: [[pos[0], pos[1], this.clock]],
        h: 0.01, // current adaptive step size
        hist: [[0, energy([pos[0], pos[1], vel[0], vel[1]], cfg), loss(pos[0], pos[1])]],
        done: false,
      });
      this.dirty = true;
    }

    // ─── Simulation ──────────────────────────────────────────────────────────
    step(dtFrame) {
      for (const p of this.particles) {
        if (p.done) continue;
        const tStop = p.cfg.stop ? Number(p.cfg.stop) : this.runTime;
        let t = 0,
          n = 0;
        // Adaptive step size, carried over between frames in p.h. If a frame needs more than
        // maxSubsteps tries, the particle simply lags behind for that frame instead of losing accuracy.
        while (t < dtFrame - 1e-12 && p.t + t < tStop - 1e-9 && n < P.maxSubsteps) {
          const h = Math.min(p.h, P.hMax, dtFrame - t, tStop - p.t - t);
          const [y, err] = dopri(p.s, h, p.cfg);
          n++;
          if (err <= 1 || h <= P.hMin) {
            p.s = y;
            t += h;
          }
          p.h = h * Math.min(5, Math.max(0.2, 0.9 * Math.pow(1 / Math.max(err, 1e-12), 0.2)));
        }
        p.t += t;
        const [x, y, vx, vy] = p.s;
        // Time series: one point per 0.02 time units is plenty for the plot.
        if (this.stats && p.hist.length < P.histMax && p.t - p.hist[p.hist.length - 1][0] >= 0.02)
          if (isFinite(x) && isFinite(y)) p.hist.push([p.t, energy(p.s, p.cfg), loss(x, y)]);
        p.trail.push([x, y, this.clock]);
        if (p.trail.length > P.trailMax) p.trail.shift();
        // Tails: drop points that have aged out (keep one just outside the window for a clean cut).
        if (p.many) while (p.trail.length > 2 && p.trail[1][2] < this.clock - P.tailSeconds) p.trail.shift();

        const gmag = Math.abs(x * y - 1) * Math.hypot(x, y);
        const speed = p.cfg.geometry === "gradflow" ? gmag : Math.hypot(vx, vy);
        const escaped = !isFinite(x) || !isFinite(y) || Math.abs(x) > 4 * P.domain || Math.abs(y) > 4 * P.domain;
        const settled = speed < 1e-3 && gmag < 1e-3;
        const timeout = p.cfg.friction !== "none" && p.t > P.maxTime;
        const stopped = p.t >= tStop - 1e-9;
        if (escaped || settled || timeout || stopped) p.done = true;
        // Why it stopped: "escaped" (left |θ| > 4 × domain, or the state stopped being finite) is marked
        // with × in the time-series panels; every other ending keeps the round marker.
        if (escaped) p.end = "escaped";
      }

      // The comparison figure shows no on-valley counts.
      if (this.methods.length) return;
      // Report the fraction of "many" samples that landed on the valley once all have finished.
      const many = this.particles.filter((p) => p.many);
      if (many.length && !this.reported && many.every((p) => p.done)) {
        this.reported = true;
        const good = many.filter((p) => onValley(p.s[0], p.s[1])).length;
        setHint(this.hint, `${good} of ${many.length} samples (${Math.round(
          (100 * good) / many.length,
        )}%) land on the set of minima.`);
      }
    }

    frame(now) {
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.clock += dt;
      if (this.visible) {
        const active = this.particles.some((p) => !p.done);
        if (active) this.step(dt * this.simSpeed);
        // Keep redrawing while tails of stopped particles are still fading out.
        const fading = this.particles.some(
          (p) => p.many && p.trail.length > 1 && p.trail[p.trail.length - 1][2] > this.clock - P.tailSeconds - dt,
        );
        if (this.view3d && this.autoRotate) {
          this.cam.yaw += P.surfAutoRotate * dt;
          this.dirty = true;
        }
        if (active || fading || this.dirty) this.draw();
        this.dirty = false;
      }
      requestAnimationFrame((t) => this.frame(t));
    }

    // ─── Rendering ───────────────────────────────────────────────────────────
    rgba(a) {
      const [r, g, b] = this.fg;
      return `rgba(${r},${g},${b},${a})`;
    }

    // Marker: large for single samples, small for many. Method-colored fill, always a white edge.
    // On small markers the edge is thin and translucent so the fill color dominates when many overlap.
    marker(x, y, color, single) {
      const ctx = this.ctx;
      const [px, py] = this.toPx(x, y);
      ctx.beginPath();
      ctx.arc(px, py, single ? 5.5 : 3.8, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = single ? "#fff" : "rgba(255,255,255,0.55)";
      ctx.lineWidth = single ? 1.5 : 0.6;
      ctx.stroke();
    }

    // ─── 3D surface view ──────────────────────────────────────────────────────
    // Precompute the surface mesh (vertices at true height L(θ), cells above surfCap removed) and a fixed
    // Lambert shading per cell. Each frame only projects, depth-sorts (painter's algorithm) and fills.
    buildSurface() {
      const N = P.surfGrid,
        D = this.surfD,
        cap = P.surfCap;
      const V = [];
      for (let j = 0; j <= N; j++)
        for (let i = 0; i <= N; i++) {
          const x = -D + (2 * D * i) / N,
            y = -D + (2 * D * j) / N;
          V.push([x, y, loss(x, y)]);
        }
      const light = (() => {
        const l = [-0.45, -0.35, 0.82];
        const n = Math.hypot(...l);
        return l.map((v) => v / n);
      })();
      const cells = [];
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          const ids = [j * (N + 1) + i, j * (N + 1) + i + 1, (j + 1) * (N + 1) + i + 1, (j + 1) * (N + 1) + i];
          const pts = ids.map((k) => V[k]);
          // Clip the cell against the plane L = cap (Sutherland–Hodgman), so the cut rim is a smooth curve
          // instead of a staircase of whole cells.
          const poly = [];
          for (let e = 0; e < 4; e++) {
            const A = pts[e],
              B = pts[(e + 1) % 4];
            const inA = A[2] <= cap,
              inB = B[2] <= cap;
            if (inA) poly.push(A);
            if (inA !== inB) {
              const t = (cap - A[2]) / (B[2] - A[2]);
              poly.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1]), cap]);
            }
          }
          if (poly.length < 3) continue;
          // Normal from the two diagonals
          const a = [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]];
          const b = [pts[3][0] - pts[1][0], pts[3][1] - pts[1][1], pts[3][2] - pts[1][2]];
          let nx = a[1] * b[2] - a[2] * b[1],
            ny = a[2] * b[0] - a[0] * b[2],
            nz = a[0] * b[1] - a[1] * b[0];
          const nn = Math.hypot(nx, ny, nz) || 1;
          if (nz < 0) (nx = -nx), (ny = -ny), (nz = -nz);
          const lam = Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / nn);
          const h = poly.reduce((acc, q) => acc + q[2], 0) / poly.length;
          cells.push({ poly, lam, h });
        }
      this.surf = { V, cells };
    }

    // World (θ₁, θ₂, L) → screen [x, y, depth]. Orthographic camera; larger depth = farther away.
    project(x, y, z) {
      const { yaw, elev } = this.cam;
      const cy = Math.cos(yaw),
        sy = Math.sin(yaw),
        ce = Math.cos(elev),
        se = Math.sin(elev);
      const xr = cy * x - sy * y,
        yr = sy * x + cy * y;
      // The box θ ∈ [−D, D]², L ∈ [floor, cap] spans at most R = D√2 horizontally at any yaw, and
      // (cap − floor)·cos(elev) + 2R·sin(elev) vertically; scale so both fit with room for the labels.
      const W = this.cssSize,
        R = this.surfD * Math.SQRT2,
        Hz = P.surfCap - P.surfFloor,
        mx = 16,
        my = 34;
      const s = Math.min((W - 2 * mx) / (2 * R), (W - 2 * my) / (Hz * ce + 2 * R * se));
      const zc = z - (P.surfCap + P.surfFloor) / 2; // centre surface + floor vertically
      return [W / 2 + s * xr, W * 0.5 - s * (zc * ce + yr * se), yr * ce - zc * se];
    }

    draw3d() {
      const ctx = this.ctx,
        W = this.cssSize,
        D = this.surfD,
        cap = P.surfCap;
      ctx.clearRect(0, 0, W, W);
      if (!this.surf) this.buildSurface();
      const { cells } = this.surf;
      const [fr, fg, fb] = this.fg,
        [br, bgc, bb] = this.bg;
      const inside = (x, y) => Math.abs(x) <= D && Math.abs(y) <= D && loss(x, y) <= cap;
      const zf = P.surfFloor;

      // ── Parameter space: the flat plane underneath (heat map + valley), K = 2 dimensions ──
      // An orthographic view of a plane is affine, so the heat-map image is drawn with one transform.
      const N = this.floorHeat.width;
      const o = this.project(-D, D, zf),
        ex = this.project(D, D, zf),
        ey = this.project(-D, -D, zf);
      ctx.save();
      ctx.transform((ex[0] - o[0]) / N, (ex[1] - o[1]) / N, (ey[0] - o[0]) / N, (ey[1] - o[1]) / N, o[0], o[1]);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(this.floorHeat, 0, 0);
      ctx.restore();
      const floorPath = (pts) => {
        ctx.beginPath();
        pts.forEach(([x, y], i) => {
          const q = this.project(x, y, zf);
          i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
        });
      };
      floorPath([[-D, -D], [D, -D], [D, D], [-D, D], [-D, -D]]);
      ctx.strokeStyle = this.rgba(0.45);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = this.rgba(0.75);
      ctx.lineWidth = 1.3;
      for (const sign of [1, -1]) {
        const pts = [];
        for (let i = 0; i <= 80; i++) {
          const x = sign * (1 / D + (i / 80) * (D - 1 / D));
          pts.push([x, 1 / x]);
        }
        floorPath(pts);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      const sf = this.project(STAR[0], STAR[1], zf);
      this.drawStar(sf[0], sf[1], 6);

      // ── Metric indicatrices on the floor: {v : vᵀ G(θ) v = r²}, the floor steps that have length r on
      // the surface. G = I + ∇L∇Lᵀ, so each ellipse has radius r across the gradient and r/√(1+|∇L|²) along it.
      const r = P.metricRadius,
        n = P.metricGrid;
      // Indicatrix at (cx, cy): the floor steps v with vᵀG v = r², as a closed polyline of points θ + v
      const ellipse = (cx, cy) => {
          const [gx, gy] = gradL(cx, cy);
          const gn = Math.hypot(gx, gy);
          const [ux, uy] = gn > 1e-9 ? [gx / gn, gy / gn] : [1, 0];
          const a = r / Math.sqrt(1 + gn * gn); // along the gradient
          const pts = [];
          for (let k = 0; k <= 48; k++) {
            const t = (2 * Math.PI * k) / 48,
              ca = Math.cos(t) * a,
              cb = Math.sin(t) * r;
            pts.push([cx + ca * ux - cb * uy, cy + ca * uy + cb * ux]);
          }
          return pts;
        };
      // Grid of centres at integer multiples of the spacing, so (0, 0), (1, 1) = θ* and (−1, −1) are included
      const metricCentres = [];
      const kMax = Math.floor((D - 0.15) / n);
      for (let i = -kMax; i <= kMax; i++) for (let j = -kMax; j <= kMax; j++) metricCentres.push([i * n, j * n]);
      if (this.metricViz) {
        ctx.lineWidth = 1.1;
        for (const [cx, cy] of metricCentres) {
          floorPath(ellipse(cx, cy));
          ctx.strokeStyle = this.rgba(0.6);
          ctx.stroke();
        }
      }

      // Height axis at the far corner (drawn before the surface, which may hide part of it)
      {
        const cs = [
          [-D, -D],
          [D, -D],
          [D, D],
          [-D, D],
        ];
        const fc = cs.reduce((a, c) => (this.project(c[0], c[1], zf)[2] > this.project(a[0], a[1], zf)[2] ? c : a));
        const qa = this.project(fc[0], fc[1], zf),
          qb = this.project(fc[0], fc[1], cap);
        ctx.strokeStyle = this.rgba(0.45);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(qa[0], qa[1]);
        ctx.lineTo(qb[0], qb[1]);
        ctx.stroke();
      }

      // ── Shadows: each particle's position θ in parameter space, joined to its lifted point (θ, L(θ)) ──
      for (const p of this.particles) {
        const tr = p.trail.filter(([x, y]) => Math.abs(x) <= D && Math.abs(y) <= D);
        if (tr.length > 1) {
          floorPath(tr);
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        const [x, y] = p.s;
        if (!inside(x, y)) continue;
        const a = this.project(x, y, zf),
          b = this.project(x, y, loss(x, y));
        if (p.many) {
          // Ensembles: only the shadow dot on the floor (50 drop lines would clutter the view)
          ctx.beginPath();
          ctx.arc(a[0], a[1], 2.4, 0, 2 * Math.PI);
          ctx.fillStyle = p.color;
          ctx.fill();
          continue;
        }
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(a[0], a[1], 3.2, 0, 2 * Math.PI);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      // Items for the painter's algorithm: surface cells, valley segments, particle trails and markers.
      const items = [];
      for (const c of cells) {
        const q = c.poly.map((v) => this.project(v[0], v[1], v[2]));
        const depth = q.reduce((acc, v) => acc + v[2], 0) / q.length;
        items.push({ type: "cell", q, c, depth });
      }
      const push3 = (type, a, b, extra) => {
        const pa = this.project(a[0], a[1], loss(a[0], a[1]));
        const pb = b ? this.project(b[0], b[1], loss(b[0], b[1])) : pa;
        // Lines sit ON the surface: nudge them slightly toward the camera so they win against their own cell.
        items.push({ type, pa, pb, depth: (pa[2] + pb[2]) / 2 - 0.02, ...extra });
      };
      // Valley θ₁θ₂ = 1 (both branches) at L = 0
      for (const sign of [1, -1]) {
        let prev = null;
        for (let i = 0; i <= 120; i++) {
          const x = sign * (1 / D + (i / 120) * (D - 1 / D));
          const pt = [x, 1 / x];
          if (prev) push3("valley", prev, pt);
          prev = pt;
        }
      }
      // Particle trails and markers (only the parts inside the shown piece of surface)
      const t0 = this.clock - P.tailSeconds;
      for (const p of this.particles) {
        for (let i = 1; i < p.trail.length; i++) {
          const a = p.trail[i - 1],
            b = p.trail[i];
          if (p.many && b[2] < t0) continue;
          if (!inside(a[0], a[1]) || !inside(b[0], b[1])) continue;
          push3("trail", a, b, { color: p.color });
        }
        if (inside(p.s[0], p.s[1])) push3("marker", p.s, null, { color: p.color, depthBias: -0.05 });
      }
      // ── The same indicatrices lifted onto the surface: (θ + v, L(θ + v)). There they are (nearly) circles of
      // radius r -- the steps that look squeezed on the floor all have the same length on the surface.
      if (this.metricViz && P.liftIndicatrices)
        for (const [cx, cy] of metricCentres) {
          if (!inside(cx, cy)) continue;
          const pts = ellipse(cx, cy);
          for (let k = 1; k < pts.length; k++)
            if (inside(pts[k - 1][0], pts[k - 1][1]) && inside(pts[k][0], pts[k][1])) push3("ind", pts[k - 1], pts[k]);
        }
      // ── Tangent plane at one point: {(θ₀ + v, L(θ₀) + ∇Lᵀv)}, drawn as ONE item (plane, circle, point) just in
      // front of the surface at the touching point. Splitting it into patches made it flicker in and out of the
      // curved surface. The circle is the floor indicatrix at θ₀ lifted into the plane, where it is a true circle.
      if (this.metricViz && P.showTangentPlane) {
        const [tx, ty] = P.tangentAt,
          t0z = loss(tx, ty),
          [gx, gy] = gradL(tx, ty),
          S = P.tangentSize;
        const lift = (vx, vy) => this.project(tx + vx, ty + vy, t0z + gx * vx + gy * vy);
        const quad = [lift(-S, -S), lift(S, -S), lift(S, S), lift(-S, S)];
        const gn = Math.hypot(gx, gy),
          [ux, uy] = gn > 1e-9 ? [gx / gn, gy / gn] : [1, 0],
          aa = P.metricRadius / Math.sqrt(1 + gn * gn),
          r = P.metricRadius;
        const circle = [];
        for (let k = 0; k <= 60; k++) {
          const t = (2 * Math.PI * k) / 60,
            ca = Math.cos(t) * aa,
            cb = Math.sin(t) * r;
          circle.push(lift(ca * ux - cb * uy, ca * uy + cb * ux));
        }
        const c0 = lift(0, 0);
        items.push({ type: "tplane", quad, circle, c0, depth: c0[2] - P.tangentBias });
      }
      push3("star", STAR, null);
      for (const it of items) if (it.type === "marker" || it.type === "star") it.depth -= 0.05;
      for (const it of items) if (it.type === "ind") it.depth -= 0.06; // keep the lifted ellipses whole on the curved cells
      items.sort((a, b) => b.depth - a.depth);

      for (const it of items) {
        if (it.type === "cell") {
          // Opaque shade: mix background → text color by height and lighting.
          const k = Math.min(1, it.c.h / cap);
          const tone = (0.1 + 0.32 * Math.sqrt(k)) * (0.55 + 0.45 * it.c.lam);
          const col = `rgb(${Math.round(br + (fr - br) * tone)},${Math.round(bgc + (fg - bgc) * tone)},${Math.round(
            bb + (fb - bb) * tone,
          )})`;
          ctx.beginPath();
          ctx.moveTo(it.q[0][0], it.q[0][1]);
          for (let i = 1; i < it.q.length; i++) ctx.lineTo(it.q[i][0], it.q[i][1]);
          ctx.closePath();
          ctx.fillStyle = col;
          ctx.fill();
          ctx.strokeStyle = this.rgba(0.07); // faint grid lines help the eye read the shape
          ctx.lineWidth = 0.6;
          ctx.stroke();
        } else if (it.type === "valley") {
          ctx.strokeStyle = this.rgba(0.85);
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(it.pa[0], it.pa[1]);
          ctx.lineTo(it.pb[0], it.pb[1]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (it.type === "ind") {
          ctx.strokeStyle = this.rgba(0.7);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(it.pa[0], it.pa[1]);
          ctx.lineTo(it.pb[0], it.pb[1]);
          ctx.stroke();
        } else if (it.type === "trail") {
          ctx.strokeStyle = it.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(it.pa[0], it.pa[1]);
          ctx.lineTo(it.pb[0], it.pb[1]);
          ctx.stroke();
        } else if (it.type === "marker") {
          ctx.beginPath();
          ctx.arc(it.pa[0], it.pa[1], 5, 0, 2 * Math.PI);
          ctx.fillStyle = it.color;
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (it.type === "star") {
          this.drawStar(it.pa[0], it.pa[1], 8);
        } else if (it.type === "tplane") {
          const [mr, mg, mb] = P.metricRGB;
          ctx.beginPath();
          it.quad.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
          ctx.closePath();
          ctx.fillStyle = `rgba(${mr},${mg},${mb},${P.metricPlaneAlpha})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(${mr},${mg},${mb},0.8)`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.beginPath();
          it.circle.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
          ctx.strokeStyle = P.metricColor;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(it.c0[0], it.c0[1], 3, 0, 2 * Math.PI);
          ctx.fillStyle = P.metricColor;
          ctx.fill();
        }
      }

      // ── Labels: which object lives in how many dimensions ──
      const corners = [
        [-D, -D],
        [D, -D],
        [D, D],
        [-D, D],
      ];
      const depthAt = (c, z) => this.project(c[0], c[1], z)[2];
      const near = corners.reduce((a, c) => (depthAt(c, zf) < depthAt(a, zf) ? c : a));
      const far = corners.reduce((a, c) => (depthAt(c, zf) > depthAt(a, zf) ? c : a));
      const pb = this.project(far[0], far[1], cap);
      ctx.fillStyle = this.rgba(0.8);
      drawRich(ctx, "$\\mathcal{L}(\\boldsymbol{\\theta})$", pb[0], pb[1] - 9, 14, "center");
      // Floor label below its nearest corner; surface label above the rim at the same corner
      const fl = this.project(near[0], near[1], zf);
      const W2 = this.cssSize;
      const clampX = (x) => Math.min(W2 - 90, Math.max(90, x));
      ctx.fillStyle = this.rgba(0.85);
      drawRich(ctx, "Parameter space, $\\Theta \\subseteq \\mathbb{R}^K$", clampX(fl[0]), Math.min(W2 - 22, fl[1] + 20), 13, "center");
      // drawRich(ctx, "loss surface in $\\mathbb{R}^{K+1}$", 10, 20, 13, "left"); // fixed corner: never lands on the floor
      ctx.fillStyle = this.rgba(0.55);
      drawRich(ctx, "(here $K = 2$)", W2 - 8, W2 - 8, 12, "right");
    }

    draw() {
      if (this.view3d) {
        this.draw3d();
        if (this.funcPanel) this.drawFunc();
        return;
      }
      const ctx = this.ctx,
        D = P.domain,
        m = this.margin,
        w = this.plot,
        k = this.scale();
      ctx.clearRect(0, 0, this.cssSize, this.cssSize);

      // Landscape
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.heat, m.l, m.t, w, w);

      ctx.save();
      ctx.beginPath();
      ctx.rect(m.l, m.t, w, w);
      ctx.clip();

      // Valley S*: θ1·θ2 = 1
      ctx.strokeStyle = this.rgba(0.85);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      for (const sign of [1, -1]) {
        ctx.beginPath();
        for (let i = 0; i <= 300; i++) {
          const x = sign * (1 / D + (i / 300) * (D - 1 / D));
          const [px, py] = this.toPx(x, 1 / x);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Laplace ellipses (1σ, 2σ of the base Gaussian)
      if (this.showLaplace) {
        const [a, b, c] = COV.S;
        const tr = a + c,
          det = a * c - b * b;
        const l1 = tr / 2 + Math.sqrt((tr * tr) / 4 - det);
        const l2 = tr / 2 - Math.sqrt((tr * tr) / 4 - det);
        const ang = 0.5 * Math.atan2(2 * b, a - c);
        const [cx, cy] = this.toPx(...STAR);
        ctx.strokeStyle = COLORS.laplace;
        ctx.lineWidth = 1.5;
        for (const n of [1, 2]) {
          ctx.globalAlpha = n === 1 ? 0.95 : 0.6;
          ctx.beginPath();
          ctx.ellipse(cx, cy, n * Math.sqrt(l1) * k, n * Math.sqrt(l2) * k, -ang, 0, 2 * Math.PI);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Pass 1 — curves: particle trails (fading tails for many, full thick paths for single),
      // and straight segments from θ* for single Laplace samples.
      const t0 = this.clock - P.tailSeconds;
      for (const p of this.particles) {
        if (p.many) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.2;
          for (let i = 1; i < p.trail.length; i++) {
            const [x1, y1, s1] = p.trail[i];
            if (s1 < t0) continue;
            const [x0, y0] = p.trail[i - 1];
            const age = Math.min(1, (this.clock - s1) / P.tailSeconds); // 0 = newest, 1 = oldest
            ctx.globalAlpha = P.tailAlpha * (1 - (1 - P.tailFadeMin) * age);
            ctx.beginPath();
            ctx.moveTo(...this.toPx(x0, y0));
            ctx.lineTo(...this.toPx(x1, y1));
            ctx.stroke();
          }
          continue;
        }
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = p.many ? 0.3 : 0.9;
        ctx.lineWidth = p.many ? 1 : 2;
        ctx.beginPath();
        p.trail.forEach(([x, y], i) => {
          const [px, py] = this.toPx(x, y);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
      // Every Laplace sample is a straight step θ* + ṽ: drawn as a line from θ* (faint for many, bold for one).
      // In the later comparison figure, only the single "One sample" draw gets its line (not the many samples).
      for (const q of this.samples) {
        if (!this.showLaplace && !q.single) continue;
        ctx.strokeStyle = COLORS.laplace;
        ctx.globalAlpha = q.single ? 0.9 : 0.6;
        ctx.lineWidth = q.single ? 2 : 1.1;
        ctx.beginPath();
        ctx.moveTo(...this.toPx(...STAR));
        ctx.lineTo(...this.toPx(q.x, q.y));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Pass 2 — markers, always on top of every curve. Many first, singles last (on top).
      this.drawStar(...this.toPx(...STAR), 8);
      for (const q of this.samples) if (!q.single) this.marker(q.x, q.y, COLORS.laplace, false);
      for (const p of this.particles) if (p.many) this.marker(p.s[0], p.s[1], p.color, false);
      for (const q of this.samples) if (q.single) this.marker(q.x, q.y, COLORS.laplace, true);
      for (const p of this.particles) if (!p.many) this.marker(p.s[0], p.s[1], p.color, true);

      // Drag arrow, in the color of the dynamics it will launch
      if (this.drag) {
        const [x0, y0] = this.drag.start,
          [x1, y1] = this.drag.end;
        const col = colorFor(this.cfg);
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        const ang = Math.atan2(y1 - y0, x1 - x0);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - 9 * Math.cos(ang - 0.4), y1 - 9 * Math.sin(ang - 0.4));
        ctx.lineTo(x1 - 9 * Math.cos(ang + 0.4), y1 - 9 * Math.sin(ang + 0.4));
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x0, y0, 3.5, 0, 2 * Math.PI);
        ctx.fill();
      }

      ctx.restore();

      this.drawAxes();
      if (this.density) this.drawDensity();
      if (this.stats) this.funcPanel ? this.drawFunc() : this.drawStats();
    }

    // ─── Function space (first 2D figure) ─────────────────────────────────────
    // The toy model is f_θ(x) = θ₁θ₂·x: a line through the origin with slope θ₁θ₂, fit to one data point (1, 1).
    // Every θ on the valley θ₁θ₂ = 1 gives the SAME line f(x) = x; off the valley the slope is wrong.
    drawFunc() {
      const ctx = this.sctx,
        W = this.sW,
        H = this.sH;
      ctx.clearRect(0, 0, W, H);
      const left = 40,
        right = 10,
        top = 26,
        bottom = 38;
      const pw = W - left - right,
        ph = H - top - bottom;
      const [x0, x1] = [-0.5, 2.5],
        [y0, y1] = [-0.5, 2.5];
      const X = (x) => left + ((x - x0) / (x1 - x0)) * pw,
        Y = (y) => top + ph - ((y - y0) / (y1 - y0)) * ph;

      // Frame, axes through the origin, ticks
      ctx.strokeStyle = this.rgba(0.5);
      ctx.lineWidth = 1;
      ctx.strokeRect(left + 0.5, top + 0.5, pw - 1, ph - 1);
      ctx.strokeStyle = this.rgba(0.18);
      ctx.beginPath();
      ctx.moveTo(X(0), top);
      ctx.lineTo(X(0), top + ph);
      ctx.moveTo(left, Y(0));
      ctx.lineTo(left + pw, Y(0));
      ctx.stroke();
      ctx.fillStyle = this.rgba(0.8);
      for (const v of [0, 1, 2]) {
        drawRich(ctx, "$" + v + "$", X(v), top + ph + 4, 12, "center", "top");
        drawRich(ctx, "$" + v + "$", left - 5, Y(v), 12, "right", "middle");
      }
      drawRich(ctx, "$x$", left + pw / 2, top + ph + 18, 14, "center", "top");
      ctx.save();
      ctx.translate(12, top + ph / 2);
      ctx.rotate(-Math.PI / 2);
      drawRich(ctx, "$f_θ(x)$", 0, 0, 14, "center", "middle");
      ctx.restore();
      drawRich(ctx, "Function space, $f_θ(x) = θ_1θ_2 x$", left, top - 9, 13);

      ctx.save();
      ctx.beginPath();
      ctx.rect(left, top, pw, ph);
      ctx.clip();
      const line = (slope, color, width, dash = []) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(X(x0), Y(slope * x0));
        ctx.lineTo(X(x1), Y(slope * x1));
        ctx.stroke();
        ctx.setLineDash([]);
      };
      // Every minimum: the line through the data point
      line(1, this.rgba(0.75), 1.5, [6, 4]);
      // Hovered θ
      if (this.hover) line(this.hover[0] * this.hover[1], this.rgba(0.45), 1.5);
      // Each ball's current θ
      for (const p of this.particles) line(p.s[0] * p.s[1], p.color, p.many ? 1 : 2.2);
      ctx.restore();

      // The single observation
      ctx.beginPath();
      ctx.arc(X(1), Y(1), 6, 0, 2 * Math.PI);
      ctx.fillStyle = this.rgba(1);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = this.rgba(0.6);
      drawRich(ctx, "$(x,y)=(1, 1)$", X(1) + 10, Y(1) + 16, 12, "left");
      // drawRich(ctx, "every $θ$ on the set of minima", X(2.45), Y(1.7), 12, "right"); // below the dashed line
    }

    // ─── Energy and loss vs. time (Brake Smart figure) ────────────────────────
    // Top: total energy H = T + κL on a log axis (constant without friction, only ever decreasing with it).
    // Bottom: loss along the path. One line per launched particle, in its method color.
    drawStats() {
      const ctx = this.sctx,
        W = this.sW,
        Ht = this.sH;
      ctx.clearRect(0, 0, W, Ht);
      const left = 44,
        right = 10,
        titleH = 18,
        gap = 22,
        bottom = 34;
      const ph = (Ht - 2 * titleH - gap - bottom) / 2,
        pw = W - left - right;
      const ps = this.particles.filter((p) => p.hist && p.hist.length);

      // Shared time axis: fixed to the run time if the preset has one, else grows in steps of 10.
      const tLast = Math.max(0, ...ps.map((p) => p.hist[p.hist.length - 1][0]));
      const tMax = isFinite(this.runTime) ? this.runTime : Math.max(20, 10 * Math.ceil(tLast / 10));
      const toX = (t) => left + (t / tMax) * pw;

      const [eBot, eTop] = P.statsEnergyRange;
      const lTop = this.lossMax;

      const panels = [
        {
          top: titleH,
          title: "Energy, $H = T + V$",
          y: (h) => (Math.log10(Math.max(h[1], 1e-12)) - eBot) / (eTop - eBot),
          ticks: Array.from({ length: eTop - eBot + 1 }, (_, i) => eBot + i)
            .filter((k, i, a) => a.length <= 5 || (eTop - k) % 2 === 0)
            .map((k) => [(k - eBot) / (eTop - eBot), "$10^{" + k + "}$"]),
        },
        {
          top: 2 * titleH + ph + gap,
          title: "Loss along the path, $L(\u03b1(t))$",
          y: (h) => h[2] / lTop,
          ticks: [0, 0.5, 1].map((f) => [f, +(f * lTop).toPrecision(2) + ""]),
        },
      ];

      ctx.font = `12px ${FONT_MAIN}`;
      panels.forEach((panel, i) => {
        const top = panel.top;
        // Not clamped: values outside the fixed axis are drawn beyond the panel and clipped away, so a curve
        // leaves through the edge and re-enters when it comes back in range. (The ±0.5 bound only keeps
        // canvas coordinates finite for huge values; points that far out are clipped either way.)
        const toY = (f) => top + ph - Math.min(1.5, Math.max(-0.5, f)) * ph;
        // Axes
        ctx.strokeStyle = this.rgba(0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(left + 0.5, top);
        ctx.lineTo(left + 0.5, top + ph + 0.5);
        ctx.lineTo(left + pw, top + ph + 0.5);
        ctx.stroke();
        ctx.fillStyle = this.rgba(0.8);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        for (const [f, label] of panel.ticks) drawRich(ctx, label, left - 5, toY(f), 12, "right", "middle");
        drawRich(ctx, panel.title, left, top - 6, 13);
        {
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          for (let t = 0; t <= tMax + 1e-9; t += tMax > 40 ? 20 : tMax > 20 ? 10 : tMax > 10 ? 5 : 2) {
            ctx.strokeStyle = this.rgba(0.5);
            ctx.beginPath();
            ctx.moveTo(toX(t), top + ph);
            ctx.lineTo(toX(t), top + ph + 3);
            ctx.stroke();
            if (i === 1) drawRich(ctx, String(t), toX(t), top + ph + 5, 12, "center", "top");
          }
        }
        if (i === 1) {
          drawRich(ctx, "Time, $t$", left + pw / 2, top + ph + 19, 13, "center", "top");
        }

        // Curves
        ctx.save();
        ctx.beginPath();
        ctx.rect(left, top, pw, ph + 1.5); // tiny extra at the bottom so a loss of exactly 0 stays visible
        ctx.clip();
        for (const p of ps) {
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = p.many ? 0.35 : 0.95;
          ctx.lineWidth = p.many ? 1 : 1.8;
          ctx.beginPath();
          p.hist.forEach((h, j) => {
            const X = toX(h[0]),
              Y = toY(panel.y(h));
            j === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
          });
          ctx.stroke();
          const hLast = p.hist[p.hist.length - 1];
          const fLast = panel.y(hLast);
          const inRange = fLast >= 0 && fLast <= 1;
          const X = toX(hLast[0]),
            Y = toY(fLast);
          ctx.globalAlpha = 1;
          if (p.end === "escaped") {
            // × where the particle left the simulation; pinned to the panel edge if that point is off the axis
            const r = p.many ? 3.5 : 5;
            const Yc = Math.min(top + ph - r - 2, Math.max(top + r + 2, Y)); // kept fully inside the panel
            // Bold ×: a wider white stroke underneath acts as the edge (same white edge as the plot markers).
            const w = p.many ? 2 : 3;
            ctx.beginPath();
            ctx.moveTo(X - r, Yc - r);
            ctx.lineTo(X + r, Yc + r);
            ctx.moveTo(X + r, Yc - r);
            ctx.lineTo(X - r, Yc + r);
            ctx.lineCap = "round";
            ctx.strokeStyle = p.many ? "rgba(255,255,255,0.7)" : "#fff";
            ctx.lineWidth = w + (p.many ? 1.2 : 2.5);
            ctx.stroke();
            ctx.strokeStyle = p.color;
            ctx.lineWidth = w;
            ctx.stroke();
            ctx.lineCap = "butt";
          } else if (!p.many && inRange) {
            ctx.beginPath();
            ctx.arc(X, Y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = p.color;
            ctx.fill();
          }
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      });

      if (!ps.length) {
        ctx.fillStyle = this.rgba(0.5);
        ctx.font = `12px ${FONT_MAIN}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
      }
    }

    // ─── Density strip (comparison figure only) ───────────────────────────────
    // Two 1D KDEs of the "many" samples, one curve per method, in natural valley coordinates:
    //   along  u = ½ log|θ₁/θ₂|  (moves only under the rescaling symmetry; θ* is at u = 0)
    //   across w = θ₁θ₂          (equals 1 exactly on the valley)
    // Particles still in flight are included, so the curves animate as the samples settle.
    drawDensity() {
      const ctx = this.dctx,
        W = this.cssSize,
        H = this.dH;
      ctx.clearRect(0, 0, W, H);

      const groups = {};
      for (const key of this.methods) groups[key] = [];
      for (const q of this.samples) if (!q.single) groups.laplace?.push([q.x, q.y]);
      for (const p of this.particles) {
        if (!p.many || !groups[p.cfg.method]) continue;
        if (isFinite(p.s[0]) && isFinite(p.s[1])) groups[p.cfg.method].push([p.s[0], p.s[1]]);
      }
      const any = Object.values(groups).some((g) => g.length > 1);

      const panels = [
        {
          title: "Along the set of minima",
          label: "$\u00bd\\log|\u03b8_1/\u03b8_2|$",
          range: P.densityAlong,
          ref: 0,
          refLabel: "$\u03b8^*$",
          f: ([x, y]) => 0.5 * Math.log(Math.abs(x / y)),
        },
        {
          title: "Across the set of minima",
          label: "$\u03b8_1\u03b8_2$",
          range: P.densityAcross,
          ref: 1,
          refLabel: "set of minima",
          f: ([x, y]) => x * y,
        },
      ];
      const gap = 18,
        top = 20,
        bottom = 30,
        left = this.margin.l,
        right = this.margin.r;
      const pw = (W - left - right - gap) / 2,
        ph = H - top - bottom;
      const N = 160;

      panels.forEach((panel, i) => {
        const x0 = left + i * (pw + gap);
        const [a, b] = panel.range;
        const toX = (v) => x0 + ((v - a) / (b - a)) * pw;

        // KDE per method on a common grid
        const grid = Array.from({ length: N }, (_, j) => a + (j / (N - 1)) * (b - a));
        const curves = [];
        let ymax = 0;
        for (const key of this.methods) {
          const vals = groups[key].map(panel.f).filter(isFinite);
          if (vals.length < 2) continue;
          const ys = kde(vals, grid, P.densityBwFloor * (b - a));
          ymax = Math.max(ymax, ...ys);
          curves.push({ key, ys });
        }

        // Frame, reference line, labels
        ctx.strokeStyle = this.rgba(0.5);
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 0.5, top + 0.5, pw - 1, ph - 1);
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = this.rgba(0.6);
        ctx.beginPath();
        ctx.moveTo(toX(panel.ref), top);
        ctx.lineTo(toX(panel.ref), top + ph);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = this.rgba(0.8);
        ctx.font = `12px ${FONT_MAIN}`;
        ctx.textBaseline = "top";
        for (let v = Math.ceil(a); v <= Math.floor(b); v++) {
          ctx.textAlign = "center";
          drawRich(ctx, "$" + v + "$", toX(v), top + ph + 4, 12, "center", "top");
        }
        drawRich(ctx, panel.label, x0 + pw / 2, top + ph + 17, 13, "center", "top");
        drawRich(ctx, panel.title, x0, top - 6, 13);
        ctx.fillStyle = this.rgba(0.55);
        drawRich(ctx, panel.refLabel, toX(panel.ref) - 3, top + 14, 12, "right");

        if (!any) return;
        // Curves: filled area at low opacity + solid outline. Shared y-scale within a panel.
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, top, pw, ph);
        ctx.clip();
        const toY = (y) => top + ph - (y / (ymax || 1)) * (ph - 6);
        for (const { key, ys } of curves) {
          const col = colorFor({ ...METHODS[key].cfg, method: key });
          ctx.beginPath();
          ctx.moveTo(toX(grid[0]), top + ph);
          grid.forEach((g, j) => ctx.lineTo(toX(g), toY(ys[j])));
          ctx.lineTo(toX(grid[N - 1]), top + ph);
          ctx.closePath();
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.15;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.beginPath();
          grid.forEach((g, j) => (j === 0 ? ctx.moveTo(toX(g), toY(ys[j])) : ctx.lineTo(toX(g), toY(ys[j]))));
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
        ctx.restore();
      });

      if (!any) {
        ctx.fillStyle = this.rgba(0.5);
        ctx.font = `12px ${FONT_MAIN}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
      }
    }

    drawStar(cx, cy, r) {
      const ctx = this.ctx;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = cx + rad * Math.cos(a),
          y = cy + rad * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = this.rgba(1);
      ctx.fill();
    }

    drawAxes() {
      const ctx = this.ctx,
        m = this.margin,
        w = this.plot;
      ctx.strokeStyle = this.rgba(0.5);
      ctx.lineWidth = 1;
      ctx.strokeRect(m.l + 0.5, m.t + 0.5, w - 1, w - 1);
      ctx.fillStyle = this.rgba(0.8);
      ctx.font = `12px ${FONT_MAIN}`;
      const maxTick = 2 * Math.floor(P.domain / 2);
      for (let v = -maxTick; v <= maxTick; v += 2) {
        const [px] = this.toPx(v, 0);
        const [, py] = this.toPx(0, v);
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        drawRich(ctx, "$" + v + "$", px, m.t + w + 4, 12, "center", "top");
        drawRich(ctx, "$" + v + "$", m.l - 5, py, 12, "right", "middle");
      }
      drawRich(ctx, "$\u03b8_1$", m.l + w / 2, m.t + w + 18, 14, "center", "top");
      ctx.save();
      ctx.translate(11, m.t + w / 2);
      ctx.rotate(-Math.PI / 2);
      drawRich(ctx, "$\u03b8_2$", 0, 0, 14, "center", "middle");
      ctx.restore();
    }
  }

  // ─── Scrolling layout ("scrollytelling") ──────────────────────────────────
  // Markup: <div class="scrolly"> <div class="scrolly-figure"><div class="dims-widget" data-preset="…"></div></div>
  //           <div class="scrolly-steps"> <div class="step" data-preset="laplace" data-auto="sample">…</div> … </div>
  //         </div>
  // The figure stays pinned while the text scrolls; when a step reaches the middle of the window, the figure
  // switches to that step's preset and (optionally) runs one action, e.g. data-auto="sample".
  function initScrolly() {
    const created = []; // inline phone figures, returned so init() can redraw them once fonts load
    document.querySelectorAll(".scrolly").forEach((box) => {
      const fig = box.querySelector(".scrolly-figure .dims-widget");
      const steps = [...box.querySelectorAll(".step")];
      if (!fig || !steps.length || !fig.dimsWidget) return;
      // Phones: a pinned figure would take half the screen. Instead give every step its own inline figure
      // (under the step's heading) and run the step's action once when that figure scrolls into view.
      // The pinned figure column is hidden by the post's CSS at the same width.
      if (window.matchMedia("(max-width: 900px)").matches) {
        steps.forEach((step) => {
          const el = document.createElement("div");
          el.className = "dims-widget step-figure";
          el.dataset.preset = step.dataset.preset;
          el.dataset.dwReady = "1";
          const h = step.querySelector(":scope > h2");
          if (h) h.after(el);
          else step.prepend(el);
          const w = new DimsWidget(el);
          created.push(w);
          if (step.dataset.auto) {
            const io = new IntersectionObserver(
              (es) => {
                if (!es[0].isIntersecting) return;
                io.disconnect();
                setTimeout(() => w.action(step.dataset.auto), 300);
              },
              { threshold: 0.6 },
            );
            io.observe(el);
          }
        });
        return;
      }
      let current = null,
        timer = null;
      const activate = (step) => {
        if (step === current) return;
        current = step;
        steps.forEach((s) => s.classList.toggle("is-active", s === step));
        const w = fig.dimsWidget;
        const name = step.dataset.preset;
        if (!name || name === fig.dataset.preset) return;
        clearTimeout(timer);
        fig.classList.add("dw-switching"); // quick fade between figures
        timer = setTimeout(() => {
          w.applyPreset(name, { stats: step.dataset.stats });
          fig.classList.remove("dw-switching");
          if (step.dataset.auto) timer = setTimeout(() => w.action(step.dataset.auto), 350);
        }, 180);
      };
      const io = new IntersectionObserver(
        (entries) => entries.forEach((e) => e.isIntersecting && activate(e.target)),
        { rootMargin: "-45% 0px -45% 0px" }, // "intersecting" = crossing the middle band of the window
      );
      steps.forEach((s) => io.observe(s));

      // Links to the heading of a step marked data-align-figure (e.g. from the table of contents): jump there,
      // switch to that step's figure, then line the heading up with the top of the pinned figure.
      // Other steps keep the browser's normal jump.
      document.addEventListener("click", (e) => {
        const link = e.target.closest && e.target.closest('a[href^="#"]');
        if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
        const id = decodeURIComponent(link.getAttribute("href").slice(1));
        const target = id && document.getElementById(id);
        const step = target && box.contains(target) && target.closest(".step");
        if (!step || !("alignFigure" in step.dataset)) return;
        e.preventDefault();
        history.pushState(null, "", "#" + id);
        target.scrollIntoView({ block: "start" }); // instant jump; the pinned figure is now in place
        activate(step);
        setTimeout(() => {
          const offset = target.getBoundingClientRect().top - fig.getBoundingClientRect().top;
          window.scrollBy({ top: offset, behavior: "smooth" });
        }, 300); // after the figure has switched (fade + rebuild), so its size is final
      });
    });
    return created;
  }

  function init() {
    injectStyles();
    const widgets = [];
    document.querySelectorAll(".dims-widget").forEach((el) => {
      if (!el.dataset.dwReady) {
        el.dataset.dwReady = "1";
        widgets.push(new DimsWidget(el));
      }
    });
    widgets.push(...initScrolly());
    // Canvas text doesn't trigger web-font loading by itself: load explicitly, then redraw.
    if (document.fonts && widgets.length) {
      Promise.all([
        document.fonts.load('12px "DW Main"'),
        document.fonts.load('italic 12px "DW Math"'),
        document.fonts.load('italic 700 12px "DW BoldMath"'),
        document.fonts.load('12px "DW Cal"'),
        document.fonts.load('12px "DW AMS"'),
      ])
        .then(() => widgets.forEach((w) => (w.dirty = true)))
        .catch(() => {});
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
