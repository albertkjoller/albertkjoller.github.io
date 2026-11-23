/*
 * About-page figure: a density along one smooth, gently curving band that wraps around the page
 * content: it rises out of the left margin, arches over the name, and winds down the right margin
 * past the bio and the news. The band is widest around its mode (above the name).
 *
 * One particle at a time diffuses with Riemannian Langevin dynamics in the pullback metric of the
 * loss L = −log p (the surface (θ, √α·L(θ))):
 *
 *     G = I + α ∇L ∇Lᵀ,   dθ = [ −½ G⁻¹∇L + ½ ∇·G⁻¹ ] dt + G^{-1/2} dW      (stationary: p)
 *
 * with small steps. The first walker starts at the mode; each later one starts at a new place along the
 * band. Paths are never erased, so the band fills in over time, until the page is reloaded.
 *
 * Three stacked canvases: the density (static), the accumulated paths (drawn incrementally) and the
 * moving particle (only its small neighbourhood is repainted each frame).
 * Colors: CSS variable --page-figure-color (set per theme in _custom.scss); updates on theme change.
 */
(function () {
  "use strict";
  const fig = document.querySelector(".page-figure");
  if (!fig) return;
  const [cBase, cInk, cHead] = ["pf-base", "pf-ink", "pf-head"].map((c) => fig.querySelector("." + c));
  const xBase = cBase.getContext("2d"),
    xInk = cInk.getContext("2d"),
    xHead = cHead.getContext("2d");

  // ─── Settings ──────────────────────────────────────────────────────────────
  const P = {
    // The band's centre line: a rounded loop around the page content (a superellipse through the middle
    // of both margins, from `top` × first-screen height down to the bottom of the content), pushed in
    // and out along its normal by a few slow sine waves.
    top: 0.17, // top of the loop, as a fraction of the first screen's height
    roundness: 4, // superellipse exponent: 2 = ellipse, larger = squarer corners
    waves: [
      [5, 52, 0.6], // [cycles around the loop, amplitude in px, phase]
      [9, 20, 2.1],
      [13, 8, 4.0],
    ],
    topBoost: 0.5, // the waves are (1 + topBoost)× stronger along the top of the loop
    topWave: { amp: 0.12, cycles: 1.35, phase: 0.35 }, // a big S-wave across the top: amplitude (× first-screen height), cycles across the width
    bgSpacing: 50, // px between the faint background contour lines
    // Broad, shallow hills in the empty areas, so the background lines wrap around them instead of only
    // running parallel to the band: [x (fraction of the width), y (fraction of the page height), radius px, depth px]
    hills: [
      [0.5, 0.43, 260, 150],
      [0.3, 0.66, 220, 120],
      [0.7, 0.8, 240, 130],
      [0.18, 0.2, 180, 90],
      [0.86, 0.33, 170, 80],
      [0.45, 0.95, 200, 90],
    ],
    bgSmooth: 4, // the background lines follow a version of the density smoothed this many times wider
    bleedTop: 60, // px the figure extends above the page content (matches .page-figure's top in _custom.scss)
    bleed: 160, // px the figure extends below the page content (matches .page-figure's bottom in _custom.scss), so the bottom of the loop isn't cut off
    sigma: 34, // band half-width (px, desktop)
    sigmaPhone: 20,
    widthTop: 0.7, // wider around the mode (σ·(1 + widthTop)), back to σ further along
    widthWave: [
      [3, 0.25, 1.3], // the width also breathes along the loop: [cycles per loop, amplitude, phase]
      [7, 0.15, 0.4], // (amplitudes are doubled along the top, so the width varies most there)
    ],
    kappa: 1.2, // mild preference for the mode along the band
    alpha: 0.25, // metric height scale, in units of σ² (G = I + α σ² ∇L∇Lᵀ)
    step: 1.2, // px: standard deviation of one step (dt = step²)
    stepsPerFrame: 8,
    walkerSeconds: 30, // each walker runs this long, then the next one starts elsewhere on the band
    levels: [0.1, 0.3, 0.6], // contour levels of the band (fractions of the peak density)
    pathAlpha: 0.2, // opacity of the accumulated paths
    headTrail: 160, // recent steps drawn stronger, so the moving particle is visible
    maxPoints: 800000, // stored path points (for redrawing after a resize / theme change)
  };

  // ─── Colors (theme-aware) ──────────────────────────────────────────────────
  let col = [217, 100, 46];
  function readColors() {
    const probe = document.createElement("span");
    probe.style.color = "var(--page-figure-color, #d9642e)";
    probe.style.display = "none";
    fig.appendChild(probe);
    const m = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g);
    probe.remove();
    if (m && m.length >= 3) col = m.slice(0, 3).map(Number);
  }
  const rgba = (a) => `rgba(${col[0]},${col[1]},${col[2]},${a})`;

  // ─── Geometry ──────────────────────────────────────────────────────────────
  let W = 0,
    H = 0,
    dpr = 1,
    sigma = P.sigma,
    alpha = 1,
    curve = [], // dense polyline along the band: [x, y, s] with s = arc length
    len = 1,
    sMode = 0;

  // "Along the top" weight for the loop parameter θ (top centre: θ = −π/2)
  const topWeight = (th) => {
    const d = Math.atan2(Math.sin(th + Math.PI / 2), Math.cos(th + Math.PI / 2)); // angle from the top, in (−π, π]
    return Math.exp(-((d / 0.9) ** 2));
  };

  // The centre line as a dense polyline [x, y, s] (s = arc length), closed (first point repeated at the end)
  function buildLoop(cx, cy, A, B, topAmp) {
    const N = 1400,
      e = 2 / P.roundness;
    const sgnPow = (v) => Math.sign(v) * Math.abs(v) ** e;
    const base = [];
    for (let i = 0; i < N; i++) {
      const th = -Math.PI / 2 + (2 * Math.PI * i) / N; // start at the top centre (the mode)
      base.push([cx + A * sgnPow(Math.cos(th)), cy + B * sgnPow(Math.sin(th)), th]);
    }
    const out = base.map(([x, y, th], i) => {
      // outward normal from the neighbours
      const [xa, ya] = base[(i - 1 + N) % N],
        [xb, yb] = base[(i + 1) % N];
      const tx = xb - xa,
        ty = yb - ya,
        tl = Math.hypot(tx, ty) || 1;
      const nx = ty / tl,
        ny = -tx / tl;
      const t = (i / N) * 2 * Math.PI;
      let off = 0;
      for (const [k, amp, ph] of P.waves) off += amp * Math.sin(k * t + ph);
      const wt = topWeight(th);
      off *= 1 + P.topBoost * wt;
      // the big S-wave across the top: u = −1 … 1 from the left to the right side
      const u = Math.max(-1, Math.min(1, (x - cx) / A));
      off += topAmp * wt * Math.sin(Math.PI * P.topWave.cycles * u + P.topWave.phase);
      return [x + nx * off, y + ny * off];
    });
    out.push(out[0].slice());
    let acc = 0;
    out.forEach((p, i) => {
      if (i) acc += Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]);
      p[2] = acc;
    });
    return out;
  }

  function layout() {
    const r = fig.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    W = r.width;
    H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, W * H > 2.5e6 ? 1 : 2); // big canvases: keep memory reasonable
    for (const [c, x] of [
      [cBase, xBase],
      [cInk, xInk],
      [cHead, xHead],
    ]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const post = fig.closest(".post");
    const content = post ? post.clientWidth : Math.min(W, 900);
    const phone = W < content + 120;
    sigma = phone ? P.sigmaPhone : P.sigma;
    alpha = P.alpha * sigma * sigma;
    // The loop runs through the middle of both margins (phones: just inside the screen edges)
    const margin = phone ? 10 : (W - content) / 4;
    const hero = document.querySelector(".hero-header");
    const hH = hero ? hero.getBoundingClientRect().height : Math.min(H, 900);
    const yTop = P.bleedTop + P.top * hH,
      yBot = H - P.bleed + 60; // the bottom of the loop: 60 px below the page content
    curve = buildLoop(W / 2, (yTop + yBot) / 2, W / 2 - margin, (yBot - yTop) / 2, P.topWave.amp * hH);
    len = curve[curve.length - 1][2];
    sMode = 0; // the loop starts at the top centre
    buildKernels();
    return true;
  }

  // Density: a smooth sum of Gaussian bumps placed along the centre line (a kernel density along the
  // curve). Unlike a distance-to-curve density, this has no kinks where the curve bends inward.
  // Each kernel: [x, y, σ, weight]; weights keep the ridge height ≈ exp(−κ z²) whatever the local width.
  let kernels = [],
    kMax = 1; // the largest kernel σ (for the search radius)
  function buildKernels() {
    kernels = [];
    const spacing = sigma * 0.5;
    const nK = Math.max(8, Math.round(len / spacing));
    for (let i = 0; i < nK; i++) {
      const sArc = (i / nK) * len;
      let z = (sArc - sMode) / len;
      z -= Math.round(z); // circular: −½ … ½ around the loop
      const top = Math.exp(-((z / 0.14) ** 2)); // ≈ 1 along the top of the loop
      let wave = 0;
      for (const [k, amp, ph] of P.widthWave) wave += amp * Math.cos(2 * Math.PI * k * (sArc / len) + ph);
      const sg = sigma * Math.max(0.4, 1 + P.widthTop * top + wave * (1 + 0.4 * top));
      const [kx, ky] = curvePoint(sArc);
      kernels.push([kx, ky, sg, ((len / nK) / (Math.sqrt(2 * Math.PI) * sg)) * Math.exp(-P.kappa * z * z)]);
    }
    kMax = kernels.reduce((m, k) => Math.max(m, k[2]), 0);
  }
  function density(x, y) {
    let p = 0;
    const R = 4.5 * kMax;
    for (const [kx, ky, sg, w] of kernels) {
      const dx = x - kx,
        dy = y - ky;
      if (dx > R || dx < -R || dy > R || dy < -R) continue;
      p += w * Math.exp(-(dx * dx + dy * dy) / (2 * sg * sg));
    }
    return p;
  }
  // Loss L = −log p
  const loss = (x, y) => -Math.log(density(x, y) + 1e-12);
  function gradL(x, y) {
    const h = 0.5;
    return [(loss(x + h, y) - loss(x - h, y)) / (2 * h), (loss(x, y + h) - loss(x, y - h)) / (2 * h)];
  }
  // Inverse pullback metric G⁻¹ = I − α g gᵀ/(1 + α|g|²), as [a, b, c] = [[a, b], [b, c]]
  function Ginv(x, y) {
    const [g1, g2] = gradL(x, y);
    const k = alpha / (1 + alpha * (g1 * g1 + g2 * g2));
    return [1 - k * g1 * g1, -k * g1 * g2, 1 - k * g2 * g2];
  }
  // A point on the band's centre line at arc length s
  function curvePoint(sArc) {
    for (let i = 1; i < curve.length; i++)
      if (curve[i][2] >= sArc) {
        const [ax, ay, as] = curve[i - 1],
          [bx, by, bs] = curve[i];
        const t = (sArc - as) / (bs - as || 1);
        return [ax + t * (bx - ax), ay + t * (by - ay)];
      }
    return curve[curve.length - 1].slice(0, 2);
  }
  // Paths are stored relative to the canvas size, so they roughly survive a resize
  const norm = (x, y) => [x / W, y / H];
  const px = (u, v) => [u * W, v * H];

  // ─── Density layer ─────────────────────────────────────────────────────────
  // The geometry (density grid, contour segments, masks) depends only on the layout, so it is computed
  // once per size and cached; a theme switch only repaints it in the new color.
  let geo = null;

  // Marching squares on a grid F (gw × gh points, spacing n) → flat segment list [x0, y0, x1, y1, ...]
  function isoSegments(F, gw, gh, n, L, out) {
    for (let j = 0; j < gh - 1; j++)
      for (let i = 0; i < gw - 1; i++) {
        const v0 = F[j * gw + i],
          v1 = F[j * gw + i + 1],
          v2 = F[(j + 1) * gw + i + 1],
          v3 = F[(j + 1) * gw + i];
        const b0 = v0 < L,
          b1 = v1 < L,
          b2 = v2 < L,
          b3 = v3 < L;
        if (b0 === b1 && b1 === b2 && b2 === b3) continue;
        const x = i * n,
          y = j * n;
        const pts = [];
        if (b0 !== b1) pts.push(x + ((L - v0) / (v1 - v0)) * n, y);
        if (b1 !== b2) pts.push(x + n, y + ((L - v1) / (v2 - v1)) * n);
        if (b2 !== b3) pts.push(x + n - ((L - v2) / (v3 - v2)) * n, y + n);
        if (b3 !== b0) pts.push(x, y + n - ((L - v3) / (v0 - v3)) * n);
        for (let q = 0; q + 3 < pts.length; q += 4) out.push(pts[q], pts[q + 1], pts[q + 2], pts[q + 3]);
      }
    return out;
  }

  function buildGeometry() {
    // 1) Band density on a fine grid, by splatting each kernel onto the cells near it
    const n = 5;
    const GW = Math.ceil(W / n) + 1,
      GH = Math.ceil(H / n) + 1;
    const f = new Float32Array(GW * GH);
    for (const [kx, ky, sg, w] of kernels) {
      const R = 4 * sg;
      const i0 = Math.max(0, Math.floor((kx - R) / n)),
        i1 = Math.min(GW - 1, Math.ceil((kx + R) / n));
      const j0 = Math.max(0, Math.floor((ky - R) / n)),
        j1 = Math.min(GH - 1, Math.ceil((ky + R) / n));
      const c = 1 / (2 * sg * sg);
      for (let j = j0; j <= j1; j++) {
        const dy = j * n - ky;
        for (let i = i0; i <= i1; i++) {
          const dx = i * n - kx;
          f[j * GW + i] += w * Math.exp(-(dx * dx + dy * dy) * c);
        }
      }
    }
    let fMax = 0;
    for (let q = 0; q < f.length; q++) if (f[q] > fMax) fMax = f[q];
    for (let q = 0; q < f.length; q++) f[q] /= fMax || 1; // contour levels are fractions of the peak
    const bandSegs = P.levels.map((L) => isoSegments(f, GW, GH, n, L, []));

    // 2) Background field on a coarse grid: a heavily smoothed version of the density (log-sum-exp over
    //    a subset of kernels, one pass), turned into a smooth "distance", minus the hills
    const m = 12;
    const gw = Math.ceil(W / m) + 1,
      gh = Math.ceil(H / m) + 1;
    const Sg = sigma * P.bgSmooth,
      c = 1 / (2 * Sg * Sg);
    const step = Math.max(1, Math.round(kernels.length / 120));
    const ks = kernels.filter((_, i) => i % step === 0);
    const F = new Float32Array(gw * gh);
    let Lmin = Infinity;
    for (let j = 0; j < gh; j++)
      for (let i = 0; i < gw; i++) {
        const x = i * m,
          y = j * m;
        let mm = Infinity,
          sum = 0;
        for (const k of ks) {
          const e = ((x - k[0]) ** 2 + (y - k[1]) ** 2) * c;
          if (e < mm) {
            sum = sum * Math.exp(e - mm) + 1; // streaming log-sum-exp
            mm = e;
          } else sum += Math.exp(mm - e);
        }
        const L = mm - Math.log(sum);
        F[j * gw + i] = L;
        if (L < Lmin) Lmin = L;
      }
    let lo = Infinity,
      hi = -Infinity;
    for (let j = 0; j < gh; j++)
      for (let i = 0; i < gw; i++) {
        let v = Math.sqrt(2 * (F[j * gw + i] - Lmin)) * Sg;
        for (const [hx, hy, hr, hd] of P.hills) {
          const dx = i * m - hx * W,
            dy = j * m - hy * H;
          v -= hd * Math.exp(-(dx * dx + dy * dy) / (2 * hr * hr));
        }
        F[j * gw + i] = v;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    const bgSegs = [];
    for (let Lv = Math.ceil((lo + 1) / P.bgSpacing) * P.bgSpacing + P.bgSpacing * 0.5; Lv < hi; Lv += P.bgSpacing)
      isoSegments(F, gw, gh, m, Lv, bgSegs);

    // 3) Mask for the background lines: fade out smoothly over the band
    const bw = GW - 1,
      bh = GH - 1;
    const mask = document.createElement("canvas");
    mask.width = bw;
    mask.height = bh;
    const mx = mask.getContext("2d");
    const img = mx.createImageData(bw, bh);
    for (let j = 0; j < bh; j++)
      for (let i = 0; i < bw; i++) {
        const t = Math.min(1, Math.max(0, (f[j * GW + i] - 0.004) / 0.06));
        img.data[4 * (j * bw + i) + 3] = Math.round(255 * t * t * (3 - 2 * t)); // smoothstep
      }
    mx.putImageData(img, 0, 0);

    // ... and around the name and tagline
    const fr = fig.getBoundingClientRect();
    const textBoxes = [...document.querySelectorAll(".hero-text")].map((el) => {
      const r = el.getBoundingClientRect();
      return [r.left - fr.left - 30, r.top - fr.top - 20, r.width + 60, r.height + 40];
    });
    return { n, GW, GH, f, bandSegs, bgSegs, mask, textBoxes };
  }

  function stroke(ctx, segs) {
    ctx.beginPath();
    for (let q = 0; q < segs.length; q += 4) {
      ctx.moveTo(segs[q], segs[q + 1]);
      ctx.lineTo(segs[q + 2], segs[q + 3]);
    }
    ctx.stroke();
  }

  function drawBase() {
    const { n, GW, GH, f, bandSegs, bgSegs, mask, textBoxes } = geo;
    xBase.clearRect(0, 0, W, H);
    // Glow
    const gw = GW - 1,
      gh = GH - 1;
    const g = document.createElement("canvas");
    g.width = gw;
    g.height = gh;
    const gx = g.getContext("2d");
    const img = gx.createImageData(gw, gh);
    for (let j = 0; j < gh; j++)
      for (let i = 0; i < gw; i++) {
        const k = 4 * (j * gw + i);
        img.data[k] = col[0];
        img.data[k + 1] = col[1];
        img.data[k + 2] = col[2];
        img.data[k + 3] = Math.round(255 * 0.13 * Math.sqrt(f[j * GW + i]));
      }
    gx.putImageData(img, 0, 0);
    xBase.imageSmoothingEnabled = true;
    xBase.drawImage(g, 0, 0, gw * n, gh * n);
    // The band's level sets
    xBase.lineWidth = 1;
    bandSegs.forEach((segs, li) => {
      xBase.strokeStyle = rgba(0.12 + 0.2 * (li / (bandSegs.length - 1 || 1)));
      stroke(xBase, segs);
    });
    // Background lines on their own layer, faded out over the band and around the name
    const lay = document.createElement("canvas");
    lay.width = Math.round(W * dpr);
    lay.height = Math.round(H * dpr);
    const lx = lay.getContext("2d");
    lx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lx.strokeStyle = rgba(0.13);
    lx.lineWidth = 1;
    lx.lineJoin = "round";
    stroke(lx, bgSegs);
    lx.globalCompositeOperation = "destination-out";
    lx.imageSmoothingEnabled = true;
    lx.drawImage(mask, 0, 0, gw * n, gh * n);
    lx.filter = "blur(28px)";
    lx.fillStyle = "#000";
    for (const [x, y, w, h] of textBoxes) lx.fillRect(x, y, w, h);
    xBase.save();
    xBase.setTransform(1, 0, 0, 1, 0, 0);
    xBase.drawImage(lay, 0, 0);
    xBase.restore();
  }

  // ─── Walkers ───────────────────────────────────────────────────────────────
  function gauss() {
    let u = 0,
      v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const walkers = []; // each: flat [u0, v0, u1, v1, ...] (normalized)
  let stored = 0,
    cur = null,
    x = 0,
    y = 0,
    stepsLeft = 0;
  const GOLDEN = (Math.sqrt(5) - 1) / 2;

  function newWalker() {
    const k = walkers.length;
    // k = 0: the mode above the name; then spread evenly along the band (golden-ratio sequence)
    const sArc = (((sMode / len + k * GOLDEN) % 1) * len); // k = 0: the mode
    [x, y] = curvePoint(sArc);
    cur = norm(x, y);
    walkers.push(cur);
    stepsLeft = P.walkerSeconds * 60 * P.stepsPerFrame;
  }

  function step() {
    const dt = P.step * P.step;
    const [g1, g2] = gradL(x, y);
    const n2 = g1 * g1 + g2 * g2;
    const k = 1 / (1 + alpha * n2);
    let dx = -0.5 * k * g1 * dt,
      dy = -0.5 * k * g2 * dt; // −½ G⁻¹∇L
    const h = 1;
    const G1 = Ginv(x + h, y),
      G0 = Ginv(x - h, y),
      H1 = Ginv(x, y + h),
      H0 = Ginv(x, y - h);
    dx += 0.25 * ((G1[0] - G0[0]) / h + (H1[1] - H0[1]) / h) * dt; // ½ ∇·G⁻¹
    dy += 0.25 * ((G1[1] - G0[1]) / h + (H1[2] - H0[2]) / h) * dt;
    const z1 = gauss(),
      z2 = gauss(),
      sq = Math.sqrt(dt);
    if (n2 > 0) {
      const nn = Math.sqrt(n2),
        u1 = g1 / nn,
        u2 = g2 / nn;
      const along = (z1 * u1 + z2 * u2) * (1 - Math.sqrt(k)); // G^{-1/2}: shrink the part along ∇L
      dx += sq * (z1 - along * u1);
      dy += sq * (z2 - along * u2);
    } else {
      dx += sq * z1;
      dy += sq * z2;
    }
    const x0 = x,
      y0 = y;
    x += dx;
    y += dy;
    if (stored < P.maxPoints) {
      const [u, v] = norm(x, y);
      cur.push(u, v);
      stored++;
    }
    xInk.beginPath();
    xInk.moveTo(x0, y0);
    xInk.lineTo(x, y);
    xInk.stroke();
    if (--stepsLeft <= 0) newWalker();
  }

  function inkStyle() {
    xInk.strokeStyle = rgba(P.pathAlpha);
    xInk.lineWidth = 1;
    xInk.lineCap = "round";
  }
  function redrawInk() {
    xInk.clearRect(0, 0, W, H);
    inkStyle();
    xInk.beginPath();
    for (const w of walkers)
      for (let i = 2; i < w.length; i += 2) {
        const [a0, b0] = px(w[i - 2], w[i - 1]),
          [a1, b1] = px(w[i], w[i + 1]);
        xInk.moveTo(a0, b0);
        xInk.lineTo(a1, b1);
      }
    xInk.stroke();
  }

  // The moving particle and its recent trail: repaint only around it
  let dirty = null;
  function drawHead() {
    if (dirty) xHead.clearRect(dirty[0] - 6, dirty[1] - 6, dirty[2] - dirty[0] + 12, dirty[3] - dirty[1] + 12);
    const w = cur,
      n = w.length / 2,
      from = Math.max(0, n - P.headTrail);
    let box = [x, y, x, y];
    xHead.lineWidth = 1.6;
    xHead.lineCap = "round";
    for (let i = from + 1; i < n; i++) {
      const [a0, b0] = px(w[2 * i - 2], w[2 * i - 1]),
        [a1, b1] = px(w[2 * i], w[2 * i + 1]);
      xHead.strokeStyle = rgba(0.9 * ((i - from) / (n - from)) ** 1.5);
      xHead.beginPath();
      xHead.moveTo(a0, b0);
      xHead.lineTo(a1, b1);
      xHead.stroke();
      box = [Math.min(box[0], a1), Math.min(box[1], b1), Math.max(box[2], a1), Math.max(box[3], b1)];
    }
    xHead.fillStyle = rgba(1);
    xHead.beginPath();
    xHead.arc(x, y, 3, 0, 2 * Math.PI);
    xHead.fill();
    dirty = box;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────
  // New size: recompute the geometry, then repaint
  function rebuild() {
    const before = cur ? norm(x, y) : null;
    if (!layout()) return false;
    if (before) [x, y] = px(...before);
    geo = buildGeometry();
    repaint();
    return true;
  }
  // Same size, new colors (theme switch): repaint only
  function repaint() {
    drawBase();
    redrawInk();
    inkStyle();
    xHead.clearRect(0, 0, W, H);
    dirty = null;
    if (cur) drawHead();
  }

  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let running = false,
    visible = true;
  function frame() {
    running = false;
    if (!visible || document.hidden) return;
    for (let k = 0; k < P.stepsPerFrame; k++) step();
    drawHead();
    running = true;
    requestAnimationFrame(frame);
  }
  function start() {
    if (!running && !reduced) {
      running = true;
      requestAnimationFrame(frame);
    }
  }

  readColors();
  if (!rebuild()) return;
  inkStyle();
  newWalker();
  if (reduced) {
    // A still image: a few walkers' worth of paths
    for (let w = 0; w < 8; w++) {
      for (let k = 0; k < 4000; k++) step();
      newWalker();
    }
  }
  drawHead();
  start();

  new MutationObserver(() => {
    readColors();
    if (geo) repaint();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  // The page grows as fonts/images/news load, and on window resizes: re-fit the ring
  let rt,
    lastSize = "";
  new ResizeObserver(() => {
    const key = `${Math.round(fig.clientWidth)}x${Math.round(fig.clientHeight)}`;
    if (key === lastSize) return;
    lastSize = key;
    clearTimeout(rt);
    rt = setTimeout(rebuild, 250);
  }).observe(fig);
  new IntersectionObserver((e) => {
    visible = e[0].isIntersecting;
    if (visible) start();
  }).observe(fig);
  document.addEventListener("visibilitychange", start);
})();
