/*
 * options_lab.js — Interface du Labo Options : simulateur de stratégies, cours, labo Grecques et quiz.
 * Dépend de options_engine.js (window.OptionsEngine) et options_content.js (window.OptionsContent).
 */
(() => {
  "use strict";
  const E = window.OptionsEngine;
  const CT = window.OptionsContent;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const STORE_KEY = "laboOptions.v1";

  // ---------- Formatage (fr-FR) ----------
  const nfCache = {};
  const nf = (d) =>
    nfCache[d] || (nfCache[d] = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const NBSP = " ";
  const MINUS = "−";
  const num = (v, d = 2) => (v < 0 ? MINUS : "") + nf(d).format(Math.abs(v));
  const sNum = (v, d = 2) => (v > 0 ? "+" : v < 0 ? MINUS : "") + nf(d).format(Math.abs(v));
  const money = (v, d = 2) => num(v, d) + NBSP + "$";
  const sMoney = (v, d = 0) => (Math.abs(v) < 0.5 * Math.pow(10, -d) ? nf(d).format(0) : sNum(v, d)) + NBSP + "$";
  const pct = (v, d = 1) => num(v, d) + NBSP + "%";
  const sPct = (v, d = 1) => sNum(v, d) + NBSP + "%";
  const px = (x) => money(x, Math.abs(x - Math.round(x)) < 0.005 ? 0 : 2);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  // ---------- Dates et échéances ----------
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const TODAY = startOfDay(new Date());
  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const fmtDate = (d, o) => d.toLocaleDateString("fr-FR", o || { weekday: "short", day: "numeric", month: "short" });
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function thirdFriday(y, m) {
    const first = new Date(y, m, 1);
    return new Date(first.getFullYear(), first.getMonth(), 1 + ((5 - first.getDay() + 7) % 7) + 14);
  }
  function buildExpirations() {
    const map = new Map();
    let d = addDays(TODAY, 1);
    while (d.getDay() !== 5) d = addDays(d, 1);
    for (let i = 0; i < 6; i++) {
      map.set(d.getTime(), d);
      d = addDays(d, 7);
    }
    for (let m = 0; m <= 12; m++) {
      const tf = thirdFriday(TODAY.getFullYear(), TODAY.getMonth() + m);
      if (tf > TODAY) map.set(tf.getTime(), tf);
    }
    for (let y = 1; y <= 2; y++) {
      const tf = thirdFriday(TODAY.getFullYear() + y, 0);
      map.set(tf.getTime(), tf);
    }
    return Array.from(map.values())
      .sort((a, b) => a - b)
      .map((date) => ({ date, dte: Math.round((date - TODAY) / 864e5) }));
  }
  const EXPS = buildExpirations();

  // ---------- Stockage local (confort uniquement) ----------
  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  const store = loadStore();
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(
          STORE_KEY,
          JSON.stringify({
            sim: simSnapshot(),
            tab: currentTab,
            lesson: currentLesson,
            read: Array.from(readLessons),
            quizBest,
            lab,
          })
        );
      } catch (e) {
        /* stockage indisponible : on continue sans */
      }
    }, 250);
  }

  // ---------- État du simulateur ----------
  let uid = 1;
  const EXAMPLE = {
    ticker: "AAPL",
    spot: 306.38,
    ivPct: 26.4,
    ratePct: 4,
    nearDte: 32,
    strategyKey: "long-call",
    legs: [{ kind: "call", side: 1, qty: 1, strike: 305, exp: "near", premium: 10.825 }],
  };
  const st = {
    ticker: EXAMPLE.ticker,
    spot: EXAMPLE.spot,
    ivPct: EXAMPLE.ivPct,
    ratePct: EXAMPLE.ratePct,
    nearDte: EXAMPLE.nearDte,
    farDte: 60,
    legs: [],
    strategyKey: "long-call",
    custom: false,
    day: 0,
    rangePct: 14,
    ivMult: 1,
    view: "graph",
    metric: "pl",
    filter: "tous",
  };
  const OUTLOOKS = [
    ["tous", "Toutes"],
    ["haussier", "Haussier"],
    ["baissier", "Baissier"],
    ["neutre", "Neutre"],
    ["volatilite", "Volatilité"],
    ["actions", "Avec actions"],
  ];
  const outlookLabel = (k) => (OUTLOOKS.find((o) => o[0] === k) || ["", ""])[1];

  function simSnapshot() {
    const o = Object.assign({}, st);
    o.legs = st.legs.map((l) => ({ kind: l.kind, side: l.side, qty: l.qty, strike: l.strike, exp: l.exp, premium: l.premium }));
    return o;
  }
  function restoreSim(s) {
    if (!s || !Array.isArray(s.legs)) return false;
    const okNum = (v, a, b) => typeof v === "number" && isFinite(v) && v >= a && v <= b;
    if (!okNum(s.spot, 0.01, 1e6) || !okNum(s.ivPct, 1, 300) || !okNum(s.nearDte, 1, 1100)) return false;
    Object.assign(st, {
      ticker: String(s.ticker || "XYZ").toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 6) || "XYZ",
      spot: s.spot,
      ivPct: s.ivPct,
      ratePct: okNum(s.ratePct, 0, 20) ? s.ratePct : 4,
      nearDte: Math.round(s.nearDte),
      farDte: okNum(s.farDte, 2, 1500) ? Math.round(s.farDte) : 60,
      strategyKey: E.getStrategy(s.strategyKey) ? s.strategyKey : "long-call",
      custom: !!s.custom,
      day: okNum(s.day, 0, 1100) ? Math.round(s.day) : 0,
      rangePct: okNum(s.rangePct, 3, 60) ? s.rangePct : 14,
      ivMult: okNum(s.ivMult, 0.25, 3) ? s.ivMult : 1,
      view: s.view === "table" ? "table" : "graph",
      metric: ["pl", "plpct", "value"].includes(s.metric) ? s.metric : "pl",
      filter: OUTLOOKS.some((o) => o[0] === s.filter) ? s.filter : "tous",
    });
    st.legs = s.legs
      .filter((l) => l && ["call", "put", "stock"].includes(l.kind))
      .slice(0, 8)
      .map((l) => ({
        id: uid++,
        kind: l.kind,
        side: l.side === -1 ? -1 : 1,
        qty: Math.max(1, Math.round(+l.qty || 1)),
        strike: l.kind === "stock" ? 0 : Math.max(0.5, +l.strike || st.spot),
        exp: l.exp === "far" ? "far" : "near",
        premium: typeof l.premium === "number" && l.premium >= 0 ? l.premium : null,
      }));
    ensureFar();
    return true;
  }

  function ensureFar() {
    if (st.farDte <= st.nearDte) {
      const next = EXPS.find((e) => e.dte >= st.nearDte + 28);
      st.farDte = next ? next.dte : st.nearDte + 30;
    }
  }
  function autoRange() {
    const iv = st.ivPct / 100;
    let r = 1.8 * iv * Math.sqrt(st.nearDte / E.DAYS_PER_YEAR) * 100;
    st.legs.forEach((l) => {
      if (l.kind !== "stock") r = Math.max(r, (Math.abs(l.strike / st.spot - 1) * 100) + 3);
    });
    st.rangePct = clamp(Math.round(r), 5, 60);
  }
  function loadStrategy(key) {
    const ctx = E.strategyContext(st.spot, st.ivPct / 100, st.nearDte);
    st.legs = E.buildStrategy(key, ctx).map((l) => Object.assign(l, { id: uid++ }));
    st.strategyKey = key;
    st.custom = false;
    st.day = 0;
    st.ivMult = 1;
    ensureFar();
    autoRange();
  }
  function loadExample() {
    Object.assign(st, {
      ticker: EXAMPLE.ticker,
      spot: EXAMPLE.spot,
      ivPct: EXAMPLE.ivPct,
      ratePct: EXAMPLE.ratePct,
      nearDte: EXAMPLE.nearDte,
      strategyKey: EXAMPLE.strategyKey,
      custom: false,
      day: 0,
      ivMult: 1,
    });
    st.legs = EXAMPLE.legs.map((l) => Object.assign({}, l, { id: uid++ }));
    ensureFar();
    autoRange();
    syncMarketInputs();
  }

  function compute() {
    const mkt = { spot: st.spot, iv: st.ivPct / 100, rate: st.ratePct / 100 };
    const legs = st.legs.map((l) =>
      Object.assign({}, l, { dte: l.kind === "stock" ? 0 : l.exp === "far" ? st.farDte : st.nearDte })
    );
    const priced = E.priceLegs(legs, mkt);
    const an = priced.length ? E.analyzePosition(priced, mkt, st.nearDte) : null;
    const day = an ? Math.min(st.day, an.horizon) : 0;
    st.day = day;
    return { mkt, priced, an, day };
  }

  // ---------- Graphique sur canvas ----------
  function alpha(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const g = (n) => cs.getPropertyValue(n).trim();
    const c = {};
    ["fg", "muted", "line", "accent", "profit", "loss", "prob", "warn", "violet", "surface", "raise"].forEach(
      (k) => (c[k] = g("--" + k))
    );
    c.font = g("--font-data") || "monospace";
    return c;
  }
  function niceTicks(min, max, count) {
    const span = max - min;
    if (!(span > 0)) return [min];
    const raw = span / Math.max(count, 1);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
  function interp(pts, x) {
    if (!pts.length || x < pts[0][0] || x > pts[pts.length - 1][0]) return null;
    let lo = 0;
    let hi = pts.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (pts[m][0] <= x) lo = m;
      else hi = m;
    }
    const [x0, y0] = pts[lo];
    const [x1, y1] = pts[hi];
    return x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }

  const plots = [];
  class Plot {
    constructor(el) {
      this.el = el;
      this.canvas = document.createElement("canvas");
      this.tip = document.createElement("div");
      this.tip.className = "plot-tip";
      this.tip.hidden = true;
      el.append(this.canvas, this.tip);
      this.spec = null;
      this.hover = null;
      const move = (e) => {
        if (!this.geom) return;
        const r = this.canvas.getBoundingClientRect();
        const x = e.clientX - r.left;
        this.hover = x >= this.geom.X0 && x <= this.geom.X1 ? x : null;
        this.draw();
      };
      this.canvas.addEventListener("pointermove", move);
      this.canvas.addEventListener("pointerdown", move);
      this.canvas.addEventListener("pointerleave", () => {
        this.hover = null;
        this.draw();
      });
      if ("ResizeObserver" in window) new ResizeObserver(() => this.draw()).observe(el);
      else window.addEventListener("resize", () => this.draw());
      plots.push(this);
    }
    set(spec) {
      this.spec = spec;
      this.draw();
    }
    draw() {
      const spec = this.spec;
      const w = this.el.clientWidth;
      const h = this.el.clientHeight;
      if (!spec || !w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const cv = this.canvas;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
        cv.style.width = w + "px";
        cv.style.height = h + "px";
      }
      const ctx = cv.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const col = readColors();
      const X0 = spec.padLeft || 66;
      const X1 = w - 12;
      const Y0 = 26;
      const Y1 = h - 28;
      const { xmin, xmax, ymin, ymax } = spec;
      const sx = (x) => X0 + ((x - xmin) / (xmax - xmin)) * (X1 - X0);
      const sy = (y) => Y1 - ((y - ymin) / (ymax - ymin)) * (Y1 - Y0);
      this.geom = { X0, X1, Y0, Y1, inv: (p) => xmin + ((p - X0) / (X1 - X0)) * (xmax - xmin) };
      ctx.font = `11px ${col.font}`;
      ctx.lineWidth = 1;

      // Grille et axes
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      niceTicks(ymin, ymax, Math.max(3, Math.round((Y1 - Y0) / 55))).forEach((v) => {
        const y = Math.round(sy(v)) + 0.5;
        ctx.strokeStyle = alpha(col.line, 0.8);
        ctx.beginPath();
        ctx.moveTo(X0, y);
        ctx.lineTo(X1, y);
        ctx.stroke();
        ctx.fillStyle = col.muted;
        ctx.fillText(spec.yFmt(v), X0 - 8, y);
      });
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      niceTicks(xmin, xmax, Math.max(3, Math.round((X1 - X0) / 92))).forEach((v) => {
        const x = Math.round(sx(v)) + 0.5;
        ctx.strokeStyle = alpha(col.line, 0.4);
        ctx.beginPath();
        ctx.moveTo(x, Y0);
        ctx.lineTo(x, Y1);
        ctx.stroke();
        ctx.fillStyle = col.muted;
        const label = spec.xFmt(v);
        const half = ctx.measureText(label).width / 2;
        ctx.fillText(label, clamp(x, half + 2, w - half - 2), Y1 + 8);
      });

      ctx.save();
      ctx.beginPath();
      ctx.rect(X0, Y0 - 2, X1 - X0, Y1 - Y0 + 4);
      ctx.clip();

      // Distribution de probabilité
      if (spec.density && spec.density.length > 1) {
        const d = spec.density;
        const dmax = Math.max.apply(null, d.map((p) => p[1])) || 1;
        const H = (Y1 - Y0) * 0.82;
        ctx.beginPath();
        ctx.moveTo(sx(d[0][0]), Y1);
        d.forEach(([x, v]) => ctx.lineTo(sx(x), Y1 - (v / dmax) * H));
        ctx.lineTo(sx(d[d.length - 1][0]), Y1);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, Y1 - H, 0, Y1);
        g.addColorStop(0, alpha(col.prob, 0.36));
        g.addColorStop(1, alpha(col.prob, 0.05));
        ctx.fillStyle = g;
        ctx.fill();
      }

      // Ligne de base (P/L nul ou coût d'entrée)
      if (spec.base != null && spec.base >= ymin && spec.base <= ymax) {
        const y = Math.round(sy(spec.base)) + 0.5;
        ctx.strokeStyle = alpha(col.fg, 0.55);
        ctx.beginPath();
        ctx.moveTo(X0, y);
        ctx.lineTo(X1, y);
        ctx.stroke();
      }

      spec.series.forEach((s) => {
        if (s.pts.length < 2) return;
        if (s.signed) this.drawSigned(ctx, s, sx, sy, X0, X1, Y0, Y1, col, spec.base || 0);
        else this.drawLine(ctx, s, sx, sy, col);
      });
      ctx.restore();

      // Marqueurs verticaux (cours, points morts, strike)
      let lastRight = -1e9;
      let row = 0;
      (spec.markers || [])
        .filter((m) => m.x >= xmin && m.x <= xmax)
        .sort((a, b) => a.x - b.x)
        .forEach((m) => {
          const x = Math.round(sx(m.x)) + 0.5;
          const color = col[m.color] || m.color;
          ctx.save();
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.9;
          ctx.setLineDash(m.dash || []);
          ctx.beginPath();
          ctx.moveTo(x, Y0);
          ctx.lineTo(x, Y1);
          ctx.stroke();
          ctx.restore();
          if (m.label) {
            const tw = ctx.measureText(m.label).width;
            const lx = clamp(x, X0 + tw / 2, X1 - tw / 2);
            row = lx - tw / 2 < lastRight + 6 ? row + 1 : 0;
            lastRight = lx + tw / 2;
            ctx.fillStyle = color;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(m.label, lx, row % 2 ? Y0 + 14 : Y0 - 6);
          }
        });

      // Survol
      if (this.hover != null && spec.tooltip) {
        const p = this.hover;
        const xv = this.geom.inv(p);
        ctx.save();
        ctx.strokeStyle = alpha(col.fg, 0.5);
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(p + 0.5, Y0);
        ctx.lineTo(p + 0.5, Y1);
        ctx.stroke();
        ctx.restore();
        spec.series.forEach((s) => {
          const yv = interp(s.pts, xv);
          if (yv == null || yv < ymin || yv > ymax) return;
          ctx.beginPath();
          ctx.arc(p, sy(yv), 4, 0, Math.PI * 2);
          ctx.fillStyle = s.signed ? (yv >= (spec.base || 0) ? col.profit : col.loss) : col[s.color] || s.color;
          ctx.fill();
          ctx.strokeStyle = col.surface;
          ctx.lineWidth = 2;
          ctx.stroke();
        });
        this.tip.innerHTML = spec.tooltip(xv);
        this.tip.hidden = false;
        const tw = this.tip.offsetWidth;
        this.tip.style.left = (p + 14 + tw > w ? Math.max(0, p - 14 - tw) : p + 14) + "px";
        this.tip.style.top = Y0 + 6 + "px";
      } else {
        this.tip.hidden = true;
      }
    }
    drawSigned(ctx, s, sx, sy, X0, X1, Y0, Y1, col, base) {
      const pts = s.pts;
      const yb = clamp(sy(base), Y0, Y1);
      const path = new Path2D();
      pts.forEach(([x, y], i) => (i ? path.lineTo(sx(x), sy(y)) : path.moveTo(sx(x), sy(y))));
      const area = new Path2D(path);
      area.lineTo(sx(pts[pts.length - 1][0]), yb);
      area.lineTo(sx(pts[0][0]), yb);
      area.closePath();
      const half = (top, bottom, color, strongAtTop) => {
        if (bottom - top < 0.5) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(X0, top, X1 - X0, bottom - top);
        ctx.clip();
        const g = ctx.createLinearGradient(0, top, 0, bottom);
        g.addColorStop(0, alpha(color, strongAtTop ? 0.42 : 0.03));
        g.addColorStop(1, alpha(color, strongAtTop ? 0.03 : 0.42));
        ctx.fillStyle = g;
        ctx.fill(area);
        ctx.strokeStyle = color;
        ctx.lineWidth = s.width || 2.5;
        ctx.lineJoin = "round";
        ctx.stroke(path);
        ctx.restore();
      };
      half(Y0 - 2, yb, col.profit, true);
      half(yb, Y1 + 2, col.loss, false);
    }
    drawLine(ctx, s, sx, sy, col) {
      ctx.save();
      ctx.strokeStyle = col[s.color] || s.color;
      ctx.globalAlpha = s.alpha == null ? 1 : s.alpha;
      ctx.lineWidth = s.width || 2;
      ctx.lineJoin = "round";
      ctx.setLineDash(s.dash || []);
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
      ctx.stroke();
      ctx.restore();
    }
  }

  // Petit profil de gain à l'échéance (SVG) pour les cartes de stratégie
  const miniCache = {};
  function miniSVG(key) {
    if (miniCache[key]) return miniCache[key];
    const spot = 100;
    const mkt = { spot, iv: 0.3, rate: 0.04 };
    const legs = E.buildStrategy(key, E.strategyContext(spot, 0.3, 30)).map((l) =>
      Object.assign(l, { dte: l.kind === "stock" ? 0 : l.exp === "far" ? 60 : 30 })
    );
    const priced = E.priceLegs(legs, mkt);
    const hz = E.horizonDays(priced);
    const W = 120;
    const H = 40;
    const lo = 76;
    const hi = 124;
    const n = 72;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = lo + ((hi - lo) * i) / n;
      pts.push([x, E.positionPL(priced, x, hz, 1, mkt.rate)]);
    }
    const m = Math.max.apply(null, pts.map((p) => Math.abs(p[1]))) || 1;
    const X = (x) => +(((x - lo) / (hi - lo)) * W).toFixed(2);
    const Y = (v) => +(H / 2 - (v / m) * (H / 2 - 3)).toFixed(2);
    const runs = [];
    let cur = null;
    pts.forEach((p, i) => {
      const sgn = p[1] >= 0 ? 1 : -1;
      if (!cur) {
        cur = { sgn, pts: [[X(p[0]), Y(p[1])]] };
        return;
      }
      if (sgn !== cur.sgn) {
        const q = pts[i - 1];
        const t = q[1] / (q[1] - p[1]);
        const cx = X(q[0] + t * (p[0] - q[0]));
        cur.pts.push([cx, H / 2]);
        runs.push(cur);
        cur = { sgn, pts: [[cx, H / 2]] };
      }
      cur.pts.push([X(p[0]), Y(p[1])]);
    });
    if (cur) runs.push(cur);
    const body = runs
      .map((r) => {
        const line = r.pts.map((p) => p.join(",")).join(" ");
        const poly = `${r.pts[0][0]},${H / 2} ${line} ${r.pts[r.pts.length - 1][0]},${H / 2}`;
        return `<polygon class="${r.sgn > 0 ? "fp" : "fn"}" points="${poly}"/><polyline class="${
          r.sgn > 0 ? "lp" : "ln"
        }" vector-effect="non-scaling-stroke" points="${line}"/>`;
      })
      .join("");
    miniCache[key] = `<svg class="mini" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><line class="zero" vector-effect="non-scaling-stroke" x1="0" y1="${
      H / 2
    }" x2="${W}" y2="${H / 2}"/>${body}</svg>`;
    return miniCache[key];
  }

  // ---------- Simulateur : rendu ----------
  const plChart = new Plot($("#plChart"));
  let ladderState = null;
  let dragging = null;

  function syncMarketInputs() {
    $("#mTicker").value = st.ticker;
    $("#mSpot").value = st.spot;
    $("#mIv").value = st.ivPct;
    $("#mRate").value = st.ratePct;
  }

  function renderHeader() {
    const s = E.getStrategy(st.strategyKey);
    const custom = st.custom || !s;
    $("#stratName").textContent = custom ? "Stratégie personnalisée" : s.name;
    $("#stratFr").textContent = custom ? "Combinez les jambes librement" : s.fr;
    const tag = $("#stratTag");
    tag.className = "tag " + (custom ? "custom" : s.outlook);
    tag.textContent = custom ? "Personnalisée" : outlookLabel(s.outlook);
    $("#quoteTicker").textContent = st.ticker;
    $("#quotePx").textContent = money(st.spot);
  }

  function renderPicker() {
    $("#stratFilters").innerHTML = OUTLOOKS.map(
      ([k, label]) =>
        `<button type="button" class="chip" data-filter="${k}" aria-pressed="${st.filter === k}">${label}</button>`
    ).join("");
    const list = E.STRATEGIES.filter((s) => st.filter === "tous" || s.outlook === st.filter);
    $("#stratStrip").innerHTML = list
      .map(
        (s) =>
          `<button type="button" class="strat" data-strat="${s.key}" aria-pressed="${
            !st.custom && st.strategyKey === s.key
          }">${miniSVG(s.key)}<b>${s.name}</b><span>${s.fr}</span></button>`
      )
      .join("");
  }

  function renderExpirations() {
    const groups = [];
    EXPS.forEach((e) => {
      const key = e.date.getFullYear() * 12 + e.date.getMonth();
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        let label = cap(fmtDate(e.date, { month: "short" }));
        if (e.date.getFullYear() !== TODAY.getFullYear()) label += " '" + String(e.date.getFullYear()).slice(-2);
        g = { key, label, items: [] };
        groups.push(g);
      }
      g.items.push(e);
    });
    $("#expChips").innerHTML = groups
      .map(
        (g) =>
          `<div class="exp-month"><span>${g.label}</span><div class="exp-days">${g.items
            .map(
              (e) =>
                `<button type="button" class="exp-day" data-dte="${e.dte}" aria-pressed="${
                  e.dte === st.nearDte
                }" aria-label="${fmtDate(e.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${
                  e.dte
                } jours">${e.date.getDate()}</button>`
            )
            .join("")}</div></div>`
      )
      .join("");
    const exp = addDays(TODAY, st.nearDte);
    $("#expLabel").textContent = `${st.nearDte} j · ${fmtDate(exp)}`;
    const dteInput = $("#dteInput");
    if (document.activeElement !== dteInput) dteInput.value = st.nearDte;

    const hasFar = st.legs.some((l) => l.kind !== "stock" && l.exp === "far");
    $("#farRow").hidden = !hasFar;
    if (hasFar) {
      const opts = EXPS.filter((e) => e.dte > st.nearDte);
      if (!opts.some((e) => e.dte === st.farDte)) opts.push({ date: addDays(TODAY, st.farDte), dte: st.farDte });
      opts.sort((a, b) => a.dte - b.dte);
      $("#farSelect").innerHTML = opts
        .map(
          (e) =>
            `<option value="${e.dte}"${e.dte === st.farDte ? " selected" : ""}>${fmtDate(e.date)} (${e.dte} j)</option>`
        )
        .join("");
    }
  }

  // Avec deux échéances (calendaire), l'étiquette précise celle de la jambe
  const chipLabel = (l) => {
    const mixed = st.legs.some((x) => x.kind !== "stock" && x.exp === "far");
    return (
      (l.qty > 1 ? l.qty + "× " : "") +
      num(l.strike, Number.isInteger(l.strike) ? 0 : 1) +
      (l.kind === "call" ? "C" : "P") +
      (mixed ? " " + (l.exp === "far" ? st.farDte : st.nearDte) + "j" : "")
    );
  };

  function renderLadder() {
    const el = $("#ladder");
    const w = el.clientWidth || 640;
    const step = E.strikeStep(st.spot);
    const ks = st.legs.filter((l) => l.kind !== "stock").map((l) => l.strike);
    let lo = Math.min.apply(null, [st.spot * 0.8].concat(ks));
    let hi = Math.max.apply(null, [st.spot * 1.2].concat(ks));
    lo = Math.max(0, Math.floor(lo / step) * step - step);
    hi = Math.ceil(hi / step) * step + step;
    ladderState = { lo, hi, step };
    const pos = (v) => (((v - lo) / (hi - lo)) * 100).toFixed(3) + "%";
    const nSteps = Math.round((hi - lo) / step);
    const pxStep = w / nSteps;
    const NICE = [1, 2, 4, 5, 10, 20, 40, 50, 100, 200];
    const tickEvery = NICE.find((n) => n * pxStep >= 6) || 200;
    const labelEvery = NICE.find((n) => n >= tickEvery && n % tickEvery === 0 && n * pxStep >= 44) || 200;

    // Rangées des étiquettes : achats au-dessus de l'axe, ventes en dessous
    const rows = { buy: [], sell: [] };
    const chips = st.legs
      .filter((l) => l.kind !== "stock")
      .slice()
      .sort((a, b) => a.strike - b.strike)
      .map((l) => {
        const side = l.side > 0 ? "buy" : "sell";
        const label = chipLabel(l);
        const cw = 18 + label.length * 7.6;
        const cx = ((l.strike - lo) / (hi - lo)) * w;
        let r = rows[side].findIndex((right) => right + 4 < cx - cw / 2);
        if (r === -1) {
          r = rows[side].length;
          rows[side].push(0);
        }
        rows[side][r] = cx + cw / 2;
        return { l, side, label, r };
      });
    const buyRows = Math.max(1, rows.buy.length);
    const sellRows = Math.max(1, rows.sell.length);
    const ROW = 28;
    const axisY = buyRows * ROW + 12;
    el.style.height = axisY + 32 + sellRows * ROW + 4 + "px";

    let html = `<div class="axis" style="top:${axisY}px"></div>`;
    const first = Math.ceil(lo / step);
    for (let i = first; i * step <= hi + 1e-9; i++) {
      if (i % tickEvery) continue;
      const k = +(i * step).toFixed(4);
      const major = i % labelEvery === 0;
      html += `<i class="tick${major ? " major" : ""}" style="left:${pos(k)};top:${axisY}px"></i>`;
      if (major) html += `<span class="tlabel" style="left:${pos(k)};top:${axisY + 8}px">${num(k, Number.isInteger(k) ? 0 : 1)}</span>`;
    }
    html += `<i class="spot" style="left:${pos(st.spot)};top:${axisY - 10}px" title="Cours actuel ${money(st.spot)}"></i>`;
    chips.forEach(({ l, side, label, r }) => {
      const top = side === "buy" ? axisY - 6 - (r + 1) * ROW : axisY + 32 + r * ROW;
      html += `<button type="button" class="leg-chip ${side}" data-leg="${l.id}" style="left:${pos(l.strike)};top:${top}px" aria-label="${
        side === "buy" ? "Achat" : "Vente"
      } ${l.kind === "call" ? "call" : "put"} strike ${num(l.strike, 2)}, flèches gauche et droite pour déplacer">${label}</button>`;
    });
    el.innerHTML = html;
  }

  function regionShort(r) {
    if (!r) return "";
    switch (r.type) {
      case "below":
        return r.x <= 0 ? "si le cours tombe à 0 $" : `sous ${px(r.x)}`;
      case "above":
        return `au-dessus de ${px(r.x)}`;
      case "at":
        return `à ${px(r.x)}`;
      case "between":
        return `entre ${px(r.a)} et ${px(r.b)}`;
      case "outside":
        return `sous ${px(r.a)} ou au-dessus de ${px(r.b)}`;
      default:
        return "";
    }
  }
  function regionPhrase(r) {
    if (!r) return "";
    const t = st.ticker;
    switch (r.type) {
      case "below":
        return r.x <= 0 ? `si ${t} tombe à 0 $` : `si ${t} termine sous ${px(r.x)}`;
      case "above":
        return `si ${t} termine au-dessus de ${px(r.x)}`;
      case "at":
        return `si ${t} termine à ${px(r.x)}`;
      case "between":
        return `si ${t} termine entre ${px(r.a)} et ${px(r.b)}`;
      case "outside":
        return `si ${t} termine sous ${px(r.a)} ou au-dessus de ${px(r.b)}`;
      default:
        return "";
    }
  }
  function zoneText(zones) {
    if (!zones.length) return "Aucune zone de profit";
    const parts = zones.map(([a, b]) => {
      if (a <= 0 && b === Infinity) return "toujours en profit";
      if (a <= 0) return `sous ${px(b)}`;
      if (b === Infinity) return `au-dessus de ${px(a)}`;
      return `entre ${px(a)} et ${px(b)}`;
    });
    return cap(parts.join(" ou "));
  }
  const movePct = (x) => sPct((x / st.spot - 1) * 100, 1);

  function renderStats(c) {
    const el = $("#stats");
    if (!c.an) {
      el.innerHTML = `<div class="stat" style="grid-column:1/-1"><span class="k">Position vide</span><span class="s">Choisissez une stratégie ou ajoutez une jambe.</span></div>`;
      return;
    }
    const a = c.an;
    const be = a.breakevens;
    const items = [
      {
        k: a.cost >= 0 ? "Débit net" : "Crédit net",
        v: money(Math.abs(a.cost)),
        s: a.cost >= 0 ? "payé à l'ouverture" : "encaissé à l'ouverture",
      },
      {
        k: "Perte max",
        v: isFinite(a.maxLoss) ? money(Math.max(0, -a.maxLoss)) : "Illimitée",
        cls: isFinite(a.maxLoss) ? "neg" : "neg txt",
        s: isFinite(a.maxLoss) ? regionShort(a.maxLossRegion) : "si le cours monte sans limite",
      },
      {
        k: "Gain max",
        v: isFinite(a.maxProfit) ? (a.maxProfit > 0 ? money(a.maxProfit) : "Aucun") : "Illimité",
        cls: isFinite(a.maxProfit) && a.maxProfit > 0 ? "pos" : "pos txt",
        s: isFinite(a.maxProfit) ? regionShort(a.maxProfitRegion) : "si le cours monte sans limite",
      },
      { k: "Probabilité de profit", v: pct(a.pop * 100, 0), s: `à l'échéance (${a.horizon} j)` },
      {
        k: be.length > 1 ? "Points morts" : "Point mort",
        v: zoneText(a.profitZones),
        cls: "txt",
        s: be.length ? be.map((b) => `${px(b)} (${movePct(b)})`).join(" · ") : "aucun",
      },
    ];
    el.innerHTML = items
      .map(
        (i) =>
          `<div class="stat"><span class="k">${i.k}</span><span class="v ${i.cls || ""}">${i.v}</span><span class="s">${i.s}</span></div>`
      )
      .join("");
  }

  function metricFns(c) {
    const a = c.an;
    const risk = isFinite(a.maxLoss) && a.maxLoss < -0.005 ? -a.maxLoss : Math.abs(a.cost);
    const rate = c.mkt.rate;
    if (st.metric === "value") {
      return {
        at: (S, d, ivm) => E.positionValue(c.priced, S, d, ivm, rate),
        base: a.cost,
        fmt: (v) => money(v, 0),
        axis: (v) => (Math.abs(v) >= 10000 ? num(v / 1000, 1) + " k$" : num(v, 0) + " $"),
        label: "Valeur de la position",
      };
    }
    if (st.metric === "plpct") {
      return {
        at: (S, d, ivm) => (risk ? (E.positionPL(c.priced, S, d, ivm, rate) / risk) * 100 : 0),
        base: 0,
        fmt: (v) => sPct(v, 0),
        axis: (v) => sNum(v, 0) + " %",
        label: isFinite(a.maxLoss) ? "P/L en % du risque max" : "P/L en % de la prime",
      };
    }
    return {
      at: (S, d, ivm) => E.positionPL(c.priced, S, d, ivm, rate),
      base: 0,
      fmt: (v) => sMoney(v, 0),
      axis: (v) => (Math.abs(v) >= 10000 ? sNum(v / 1000, 1) + " k$" : sNum(v, 0) + " $"),
      label: "Profit / perte",
    };
  }

  function renderChart(c) {
    const legend = $("#chartLegend");
    if (!c.an) {
      plChart.set(null);
      plChart.canvas.getContext("2d").clearRect(0, 0, plChart.canvas.width, plChart.canvas.height);
      plChart.tip.hidden = true;
      legend.innerHTML = "<span>Ajoutez une jambe pour afficher le profil de gain.</span>";
      return;
    }
    const a = c.an;
    const m = metricFns(c);
    const lo = st.spot * (1 - st.rangePct / 100);
    const hi = st.spot * (1 + st.rangePct / 100);
    const N = 260;
    const xs = [];
    for (let i = 0; i <= N; i++) xs.push(lo + ((hi - lo) * i) / N);
    a.breakevens.forEach((b) => b > lo && b < hi && xs.push(b));
    c.priced.forEach((l) => l.kind !== "stock" && l.strike > lo && l.strike < hi && xs.push(l.strike));
    xs.sort((p, q) => p - q);
    const atExpiry = c.day >= a.horizon;
    const dateCurve = xs.map((x) => [x, m.at(x, c.day, st.ivMult)]);
    const expCurve = atExpiry ? null : xs.map((x) => [x, m.at(x, a.horizon, 1)]);
    const ys = dateCurve.map((p) => p[1]).concat(expCurve ? expCurve.map((p) => p[1]) : [], [m.base]);
    let ymin = Math.min.apply(null, ys);
    let ymax = Math.max.apply(null, ys);
    const padY = (ymax - ymin) * 0.1 || Math.max(1, Math.abs(ymax) * 0.1);
    ymin -= padY;
    ymax += padY;
    const T = a.horizon / E.DAYS_PER_YEAR;
    const density = T > 0 ? xs.map((x) => [x, E.lognormalPdf(x, st.spot, T, c.mkt.iv, c.mkt.rate)]) : null;
    const dateTxt = fmtDate(addDays(TODAY, c.day), { day: "numeric", month: "short" });

    const markers = [{ x: st.spot, color: "fg", dash: [4, 4], label: `Cours ${px(st.spot)}` }];
    a.breakevens.forEach((b) => markers.push({ x: b, color: "accent", label: px(b) }));

    plChart.set({
      xmin: lo,
      xmax: hi,
      ymin,
      ymax,
      base: m.base,
      density,
      padLeft: 70,
      xFmt: (v) => num(v, v >= 100 || Number.isInteger(v) ? 0 : 1) + " $",
      yFmt: m.axis,
      markers,
      series: [
        expCurve ? { pts: expCurve, color: "fg", dash: [6, 5], width: 1.6, alpha: 0.85 } : null,
        { pts: dateCurve, signed: true, width: 2.6 },
      ].filter(Boolean),
      tooltip: (x) => {
        const vDate = m.at(x, c.day, st.ivMult);
        const lines = [
          `Cours <b>${money(x)}</b> <span class="muted">(${movePct(x)})</span>`,
          `${atExpiry ? "À l'échéance" : "Le " + dateTxt} : <b class="${vDate >= m.base ? "pos" : "neg"}">${m.fmt(vDate)}</b>`,
        ];
        if (!atExpiry) {
          const vExp = m.at(x, a.horizon, 1);
          lines.push(`À l'échéance : <b class="${vExp >= m.base ? "pos" : "neg"}">${m.fmt(vExp)}</b>`);
        }
        if (T > 0) {
          const pAbove = 1 - E.probBelow(x, st.spot, T, c.mkt.iv, c.mkt.rate);
          lines.push(`<span class="muted">Proba. de finir au-dessus : ${pct(pAbove * 100, 0)}</span>`);
        }
        return lines.join("<br>");
      },
    });
    legend.innerHTML =
      `<span><i class="sw-date"></i>${m.label} ${atExpiry ? "à l'échéance" : "le " + esc(dateTxt) + " (J+" + c.day + ")"}</span>` +
      (expCurve ? `<span><i class="sw-exp"></i>À l'échéance (${a.horizon} j)</span>` : "") +
      (density ? `<span><i class="sw-prob"></i>Probabilité à l'échéance</span>` : "");
  }

  function renderTable(c) {
    const el = $("#plTable");
    if (!c.an) {
      el.innerHTML = "";
      return;
    }
    const a = c.an;
    const m = metricFns(c);
    const lo = st.spot * (1 - st.rangePct / 100);
    const hi = st.spot * (1 + st.rangePct / 100);
    const nRows = 14;
    const prices = [];
    for (let i = 0; i <= nRows; i++) prices.push(hi - ((hi - lo) * i) / nRows);
    let spotIdx = prices.findIndex((p) => p < st.spot);
    if (spotIdx === -1) spotIdx = prices.length;
    prices.splice(spotIdx, 0, st.spot);
    const nCols = Math.min(a.horizon, 7);
    const days = [];
    for (let j = 0; j <= nCols; j++) days.push(nCols ? Math.round((a.horizon * j) / nCols) : 0);
    const uniqDays = Array.from(new Set(days));
    const grid = prices.map((p) => uniqDays.map((d) => m.at(p, d, st.ivMult)));
    let maxAbs = 0;
    grid.forEach((r) => r.forEach((v) => (maxAbs = Math.max(maxAbs, Math.abs(v - m.base)))));
    const head = uniqDays
      .map((d) => {
        const date = addDays(TODAY, d);
        const sub = d === a.horizon ? "échéance" : "J+" + d;
        return `<th scope="col">${fmtDate(date, { day: "numeric", month: "short" })}<small>${sub}</small></th>`;
      })
      .join("");
    const body = prices
      .map((p, i) => {
        const cells = grid[i]
          .map((v) => {
            const dv = v - m.base;
            const k = maxAbs ? Math.min(1, Math.abs(dv) / maxAbs) : 0;
            const colr = dv >= 0 ? "--profit" : "--loss";
            const mix = Math.round(8 + 62 * k);
            return `<td style="background:color-mix(in srgb,var(${colr}) ${mix}%,var(--surface))">${m.fmt(v)}</td>`;
          })
          .join("");
        const spot = i === spotIdx;
        return `<tr${spot ? ' class="spot-row"' : ""}><th scope="row">${money(p)}<small>${spot ? "cours actuel" : movePct(p)}</small></th>${cells}</tr>`;
      })
      .join("");
    el.innerHTML = `<table class="heat"><thead><tr><th scope="col">Cours</th>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function renderSliders(c) {
    const hz = c.an ? c.an.horizon : 0;
    const ds = $("#daySlider");
    ds.max = hz;
    ds.value = c.day;
    ds.disabled = hz === 0;
    const date = addDays(TODAY, c.day);
    $("#dateLabel").textContent = `${fmtDate(date)} (J+${c.day})`;
    $("#dateSub").textContent =
      hz === 0 ? "" : c.day >= hz ? "À l'échéance" : `${hz - c.day} j avant l'échéance`;
    $("#rangeSlider").value = st.rangePct;
    $("#rangeLabel").textContent = "±" + num(st.rangePct, 0) + NBSP + "%";
    $("#ivSlider").value = st.ivMult;
    $("#ivLabel").textContent = `${pct(st.ivPct * st.ivMult, 1)} (×${num(st.ivMult, 2)})`;
    $$("[data-view]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.view === st.view));
    $$("[data-metric]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.metric === st.metric));
  }

  function renderLegs(c) {
    const el = $("#legs");
    const active = document.activeElement;
    const keepId = active && el.contains(active) ? active.id : null;
    $("#legsNote").textContent = st.legs.length ? `${st.legs.length} jambe${st.legs.length > 1 ? "s" : ""}` : "";
    if (!st.legs.length) {
      el.innerHTML = `<p class="note">Aucune jambe. Ajoutez un call, un put ou des actions.</p>`;
      return;
    }
    const step = E.strikeStep(st.spot);
    el.innerHTML = c.priced
      .map((l) => {
        const id = l.id;
        const isOpt = l.kind !== "stock";
        const total = l.side * E.legSize(l) * l.entry;
        const expDate = addDays(TODAY, l.dte);
        const occ = isOpt ? E.occSymbol(st.ticker, expDate, l.kind, l.strike) : `${st.ticker} · actions`;
        const theo = isOpt ? num(l.theo, 2) : "";
        const mid = isOpt
          ? `<div class="leg-mid">
              <label class="field"><span>Strike $</span><input id="leg-${id}-strike" data-f="strike" type="number" min="0.5" step="${step}" value="${l.strike}"></label>
              <label class="field"><span>Échéance</span><select id="leg-${id}-exp" data-f="exp"><option value="near"${
                l.exp === "near" ? " selected" : ""
              }>${st.nearDte} j</option><option value="far"${l.exp === "far" ? " selected" : ""}>${
                st.farDte
              } j</option></select></label>
              <div class="field"><span>Prime $</span><div class="prem"><input id="leg-${id}-premium" data-f="premium" type="number" min="0" step="0.01" placeholder="${theo}" value="${
                l.premium != null ? l.premium : ""
              }" aria-label="Prime par action, vide = prix théorique"><button type="button" id="leg-${id}-reset" data-act="reset" title="Revenir au prix théorique" aria-label="Revenir au prix théorique">↺</button></div></div>
            </div>`
          : `<p class="note">Achetées au cours actuel : ${money(st.spot)} par action.</p>`;
        const ivTxt = isOpt
          ? `VI ${pct(l.iv * 100, 1)}${l.premium != null ? " (implicite)" : ""}${l.ivClamped ? " · prime hors bornes" : ""}`
          : "";
        return `<div class="leg" data-id="${id}">
          <div class="leg-top">
            <div class="seg" role="group" aria-label="Sens">
              <button type="button" id="leg-${id}-buy" class="on-buy" data-act="side" data-v="1" aria-pressed="${l.side > 0}">Achat</button>
              <button type="button" id="leg-${id}-sell" class="on-sell" data-act="side" data-v="-1" aria-pressed="${l.side < 0}">Vente</button>
            </div>
            <label class="field"><span>${isOpt ? "Contrats" : "Actions"}</span><input id="leg-${id}-qty" data-f="qty" type="number" min="1" step="1" value="${l.qty}"></label>
            <label class="field"><span>Type</span><select id="leg-${id}-kind" data-f="kind">
              <option value="call"${l.kind === "call" ? " selected" : ""}>Call</option>
              <option value="put"${l.kind === "put" ? " selected" : ""}>Put</option>
              <option value="stock"${l.kind === "stock" ? " selected" : ""}>Actions</option>
            </select></label>
            <button type="button" id="leg-${id}-remove" class="icon-btn" data-act="remove" aria-label="Supprimer la jambe">✕</button>
          </div>
          ${mid}
          <div class="leg-foot"><span class="occ">${esc(occ)}</span><span>${ivTxt}${ivTxt ? " · " : ""}${
          total >= 0 ? "débit" : "crédit"
        } ${money(Math.abs(total))}</span></div>
        </div>`;
      })
      .join("");
    if (keepId) {
      const n = document.getElementById(keepId);
      if (n) n.focus();
    }
  }

  function renderGreeks(c) {
    const el = $("#greeks");
    if (!c.an) {
      el.innerHTML = "";
      $("#greeksNote").textContent = "";
      return;
    }
    const g = E.positionGreeks(c.priced, st.spot, c.day, st.ivMult, c.mkt.rate);
    $("#greeksNote").textContent = `au cours actuel, J+${c.day}`;
    const t = st.ticker;
    const rows = [
      [
        "Δ",
        "Delta",
        sNum(g.delta, 1),
        `≈ ${sMoney(g.delta, 0)} si ${t} monte de 1 $ : la position se comporte comme ${num(Math.abs(g.delta), 0)} actions ${
          g.delta >= 0 ? "achetées" : "vendues à découvert"
        }.`,
      ],
      ["Γ", "Gamma", sNum(g.gamma, 2), `Le delta varie de ${sNum(g.gamma, 2)} pour 1 $ de hausse du cours.`],
      [
        "Θ",
        "Theta",
        sMoney(g.theta, 2) + "/j",
        g.theta < 0
          ? `À cours constant, la position perd ≈ ${money(-g.theta, 0)} par jour.`
          : `À cours constant, la position gagne ≈ ${money(g.theta, 0)} par jour.`,
      ],
      ["ν", "Vega", sMoney(g.vega, 2), `Effet de +1 point de volatilité implicite.`],
      ["ρ", "Rho", sMoney(g.rho, 2), `Effet de +1 point de taux d'intérêt.`],
    ];
    el.innerHTML = rows
      .map(
        ([s, n, v, ex]) =>
          `<div class="greek"><span class="sym" aria-hidden="true">${s}</span><span class="nm">${n}</span><span class="val">${v}</span><span class="ex">${esc(
            ex
          )}</span></div>`
      )
      .join("");
  }

  function renderReading(c) {
    const el = $("#reading");
    const s = E.getStrategy(st.strategyKey);
    let html =
      !st.custom && s
        ? `<p><strong>Idée.</strong> ${s.idea}</p><p><strong>Quand l'utiliser.</strong> ${s.when}</p>`
        : `<p>Position personnalisée : combinez librement les jambes et observez le profil obtenu.</p>`;
    if (c.an) {
      const a = c.an;
      const t = esc(st.ticker);
      const items = [];
      items.push(
        a.cost >= 0
          ? `Vous payez <strong>${money(a.cost)}</strong> à l'ouverture (débit net).`
          : `Vous encaissez <strong>${money(-a.cost)}</strong> à l'ouverture (crédit net).`
      );
      items.push(
        isFinite(a.maxLoss)
          ? `Perte maximale : <strong>${money(Math.max(0, -a.maxLoss))}</strong>${
              a.maxLossRegion ? ", " + esc(regionPhrase(a.maxLossRegion)) : ""
            } à l'échéance.`
          : `Perte <strong>illimitée</strong> si ${t} monte fortement. Une protection (call acheté plus haut) la plafonnerait.`
      );
      if (!isFinite(a.maxProfit)) items.push(`Gain <strong>illimité</strong> si ${t} continue de monter.`);
      else if (a.maxProfit > 0)
        items.push(
          `Gain maximal : <strong>${money(a.maxProfit)}</strong>${
            a.maxProfitRegion ? ", " + esc(regionPhrase(a.maxProfitRegion)) : ""
          }.`
        );
      else items.push(`Cette position ne peut pas être gagnante à l'échéance.`);
      if (a.breakevens.length === 1)
        items.push(
          `Point mort à l'échéance : <strong>${px(a.breakevens[0])}</strong>, soit ${movePct(a.breakevens[0])} par rapport au cours actuel.`
        );
      else if (a.breakevens.length > 1)
        items.push(`Points morts : ${a.breakevens.map((b) => `<strong>${px(b)}</strong> (${movePct(b)})`).join(" et ")}.`);
      items.push(
        `Probabilité estimée de terminer en profit : <strong>${pct(a.pop * 100, 0)}</strong> (loi log-normale, VI ${pct(
          st.ivPct,
          1
        )}).`
      );
      if (a.horizon > 0) {
        const em = a.expectedMove;
        items.push(
          `Mouvement attendu d'ici l'échéance (1 écart-type) : ±${money(em)} (±${pct((em / st.spot) * 100, 1)}). ${t} a environ 68 % de chances de finir entre ${px(
            st.spot - em
          )} et ${px(st.spot + em)}.`
        );
      }
      if (c.priced.some((l) => l.kind !== "stock" && l.exp === "far"))
        items.push(`La jambe lointaine garde de la valeur temps à la première échéance : le P/L affiché est estimé par le modèle.`);
      if (c.priced.some((l) => l.premium != null))
        items.push(`Les jambes à prime saisie utilisent leur propre volatilité implicite, recalculée à partir de cette prime.`);
      html += `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
    }
    el.innerHTML = html;
  }

  function renderSim(opts) {
    opts = opts || {};
    const c = compute();
    renderHeader();
    if (!opts.skipPicker) renderPicker();
    renderExpirations();
    if (!opts.skipLadder) renderLadder();
    renderStats(c);
    const table = st.view === "table";
    $("#plChart").hidden = table;
    $("#chartLegend").hidden = table;
    $("#plTable").hidden = !table;
    if (table) renderTable(c);
    else renderChart(c);
    renderSliders(c);
    renderLegs(c);
    renderGreeks(c);
    renderReading(c);
    scheduleSave();
  }

  // ---------- Simulateur : événements ----------
  function bindSim() {
    $("#mTicker").addEventListener("input", (e) => {
      const v = e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 6);
      if (v !== e.target.value) e.target.value = v;
      st.ticker = v || "XYZ";
      renderSim({ skipPicker: true });
    });
    $("#mSpot").addEventListener("change", (e) => {
      const v = parseFloat(e.target.value);
      if (!(v > 0) || v > 1e6) {
        e.target.value = st.spot;
        return;
      }
      st.spot = Math.round(v * 100) / 100;
      if (!st.custom) loadStrategy(st.strategyKey);
      else autoRange();
      renderSim();
    });
    $("#mIv").addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      if (v >= 1 && v <= 300) {
        st.ivPct = v;
        renderSim({ skipPicker: true });
      }
    });
    $("#mRate").addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      if (v >= 0 && v <= 20) {
        st.ratePct = v;
        renderSim({ skipPicker: true });
      }
    });
    $("#btnExample").addEventListener("click", () => {
      loadExample();
      renderSim();
    });

    $("#stratFilters").addEventListener("click", (e) => {
      const b = e.target.closest("[data-filter]");
      if (!b) return;
      st.filter = b.dataset.filter;
      renderPicker();
      scheduleSave();
    });
    $("#stratStrip").addEventListener("click", (e) => {
      const b = e.target.closest("[data-strat]");
      if (!b) return;
      loadStrategy(b.dataset.strat);
      renderSim();
    });

    $("#expChips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-dte]");
      if (!b) return;
      setNearDte(+b.dataset.dte);
    });
    $("#dteInput").addEventListener("change", (e) => {
      const v = Math.round(parseFloat(e.target.value));
      if (!(v >= 1 && v <= 1100)) {
        e.target.value = st.nearDte;
        return;
      }
      setNearDte(v);
    });
    $("#farSelect").addEventListener("change", (e) => {
      st.farDte = +e.target.value;
      st.legs.forEach((l) => l.exp === "far" && (l.premium = null));
      renderSim({ skipPicker: true });
    });

    // Étiquettes de strike : glisser-déposer et clavier
    const ladder = $("#ladder");
    ladder.addEventListener("pointerdown", (e) => {
      const chip = e.target.closest(".leg-chip");
      if (!chip) return;
      e.preventDefault();
      chip.setPointerCapture(e.pointerId);
      chip.focus({ preventScroll: true });
      dragging = { id: +chip.dataset.leg, chip, rect: ladder.getBoundingClientRect() };
    });
    ladder.addEventListener("pointermove", (e) => {
      if (!dragging || !ladderState) return;
      const { lo, hi, step } = ladderState;
      const x = clamp(e.clientX - dragging.rect.left, 0, dragging.rect.width);
      const k = Math.max(step, E.roundToStep(lo + (x / dragging.rect.width) * (hi - lo), step));
      const leg = st.legs.find((l) => l.id === dragging.id);
      if (!leg || leg.strike === k) return;
      leg.strike = k;
      leg.premium = null;
      dragging.chip.style.left = (((k - lo) / (hi - lo)) * 100).toFixed(3) + "%";
      dragging.chip.textContent = chipLabel(leg);
      renderSim({ skipLadder: true, skipPicker: true });
    });
    const endDrag = () => {
      if (!dragging) return;
      const id = dragging.id;
      dragging = null;
      renderSim({ skipPicker: true });
      const chip = $(`.leg-chip[data-leg="${id}"]`);
      if (chip) chip.focus({ preventScroll: true });
    };
    ladder.addEventListener("pointerup", endDrag);
    ladder.addEventListener("pointercancel", endDrag);
    ladder.addEventListener("keydown", (e) => {
      const chip = e.target.closest(".leg-chip");
      if (!chip || !ladderState) return;
      const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const leg = st.legs.find((l) => l.id === +chip.dataset.leg);
      if (!leg) return;
      leg.strike = Math.max(ladderState.step, E.roundToStep(leg.strike + d * ladderState.step, ladderState.step));
      leg.premium = null;
      renderSim({ skipPicker: true });
      const again = $(`.leg-chip[data-leg="${leg.id}"]`);
      if (again) again.focus();
    });

    $("#daySlider").addEventListener("input", (e) => {
      st.day = +e.target.value;
      renderSim({ skipPicker: true, skipLadder: true });
    });
    $("#rangeSlider").addEventListener("input", (e) => {
      st.rangePct = +e.target.value;
      renderSim({ skipPicker: true, skipLadder: true });
    });
    $("#ivSlider").addEventListener("input", (e) => {
      st.ivMult = +e.target.value;
      renderSim({ skipPicker: true, skipLadder: true });
    });
    $$("[data-view]").forEach((b) =>
      b.addEventListener("click", () => {
        st.view = b.dataset.view;
        renderSim({ skipPicker: true, skipLadder: true });
      })
    );
    $$("[data-metric]").forEach((b) =>
      b.addEventListener("click", () => {
        st.metric = b.dataset.metric;
        renderSim({ skipPicker: true, skipLadder: true });
      })
    );

    // Jambes
    const legsEl = $("#legs");
    const legOf = (node) => {
      const box = node.closest(".leg");
      return box ? st.legs.find((l) => l.id === +box.dataset.id) : null;
    };
    legsEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const leg = legOf(b);
      if (!leg) return;
      if (b.dataset.act === "side") {
        const v = +b.dataset.v;
        if (leg.side === v) return;
        leg.side = v;
        st.custom = true;
      } else if (b.dataset.act === "remove") {
        st.legs = st.legs.filter((l) => l !== leg);
        st.custom = true;
      } else if (b.dataset.act === "reset") {
        leg.premium = null;
      }
      renderSim();
    });
    legsEl.addEventListener("change", (e) => {
      const f = e.target.dataset.f;
      const leg = legOf(e.target);
      if (!f || !leg) return;
      const v = e.target.value;
      if (f === "qty") {
        const q = Math.round(parseFloat(v));
        if (q >= 1 && q <= 10000) {
          if (q !== leg.qty) st.custom = true;
          leg.qty = q;
        }
      } else if (f === "kind") {
        const was = leg.kind;
        leg.kind = v;
        leg.premium = null;
        if (v === "stock") {
          leg.qty = 100;
          leg.strike = 0;
          leg.side = 1;
        } else if (was === "stock") {
          leg.qty = 1;
          leg.strike = E.strategyContext(st.spot, st.ivPct / 100, st.nearDte).atm;
        }
        st.custom = true;
      } else if (f === "strike") {
        const k = parseFloat(v);
        if (k > 0 && k < 1e6) {
          leg.strike = Math.round(k * 100) / 100;
          leg.premium = null;
        }
      } else if (f === "exp") {
        leg.exp = v === "far" ? "far" : "near";
        leg.premium = null;
        ensureFar();
        st.custom = true;
      } else if (f === "premium") {
        const p = parseFloat(v);
        leg.premium = v.trim() === "" || !(p >= 0) ? null : p;
      }
      renderSim();
    });
    $$("[data-add]").forEach((b) =>
      b.addEventListener("click", () => {
        if (st.legs.length >= 8) return;
        const kind = b.dataset.add;
        const atm = E.strategyContext(st.spot, st.ivPct / 100, st.nearDte).atm;
        st.legs.push({
          id: uid++,
          kind,
          side: 1,
          qty: kind === "stock" ? 100 : 1,
          strike: kind === "stock" ? 0 : atm,
          exp: "near",
          premium: null,
        });
        st.custom = true;
        renderSim();
      })
    );
  }

  function setNearDte(v) {
    st.nearDte = v;
    st.legs.forEach((l) => l.exp === "near" && (l.premium = null));
    ensureFar();
    renderSim({ skipPicker: true });
  }

  // ---------- Onglets ----------
  const TABS = ["simulateur", "cours", "grecques", "quiz"];
  let currentTab = "simulateur";
  function showTab(name, focusTop) {
    if (!TABS.includes(name)) name = "simulateur";
    currentTab = name;
    $$(".tab").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === name));
    $$(".tab-panel").forEach((p) => (p.hidden = p.id !== "tab-" + name));
    try {
      if (location.hash.slice(1) !== name) history.replaceState(null, "", "#" + name);
    } catch (e) {
      /* historique indisponible dans certains cadres */
    }
    if (name === "simulateur") renderSim();
    if (name === "cours") renderCourse();
    if (name === "grecques") renderLab();
    if (name === "quiz") renderQuiz();
    if (focusTop) window.scrollTo({ top: 0 });
    scheduleSave();
  }

  // ---------- Cours ----------
  const LESSONS = CT.LESSONS;
  const readLessons = new Set(Array.isArray(store.read) ? store.read.filter((id) => LESSONS.some((l) => l.id === id)) : []);
  let currentLesson = LESSONS.some((l) => l.id === store.lesson) || store.lesson === "glossaire" ? store.lesson : LESSONS[0].id;

  function renderCourse() {
    const n = readLessons.size;
    $("#progressLabel").textContent = `${n} / ${LESSONS.length} leçons`;
    $("#progressBar").style.width = (n / LESSONS.length) * 100 + "%";
    $("#lessonList").innerHTML =
      LESSONS.map(
        (l, i) =>
          `<li><button type="button" data-lesson="${l.id}" aria-current="${currentLesson === l.id}"><span class="n">${String(i + 1).padStart(
            2,
            "0"
          )}</span><span>${l.title}</span><span class="done" title="Leçon lue">${readLessons.has(l.id) ? "✓" : ""}</span></button></li>`
      ).join("") +
      `<li><button type="button" data-lesson="glossaire" aria-current="${currentLesson === "glossaire"}"><span class="n">A–Z</span><span>Glossaire</span><span></span></button></li>`;
    if (currentLesson === "glossaire") renderGlossary();
    else renderLesson();
  }

  function ctaButton(c) {
    if (c.preset) return `<button type="button" class="btn" data-go-preset="${c.preset}">${c.label}</button>`;
    if (c.example) return `<button type="button" class="btn" data-go-example="1">${c.label}</button>`;
    return `<button type="button" class="btn ghost" data-go-tab="${c.tab}">${c.label}</button>`;
  }

  function renderLesson() {
    const i = LESSONS.findIndex((l) => l.id === currentLesson);
    const l = LESSONS[i];
    readLessons.add(l.id);
    const fig = l.figure
      ? `<div class="figure">${l.figure
          .map((k) => {
            const s = E.getStrategy(k);
            return `<button type="button" class="fig strat" data-go-preset="${k}" title="Ouvrir dans le simulateur">${miniSVG(
              k
            )}<b>${s.name}</b><span class="note">${s.fr}</span></button>`;
          })
          .join("")}</div>`
      : "";
    const prev = LESSONS[i - 1];
    const next = LESSONS[i + 1];
    $("#lesson").innerHTML = `
      <div class="meta">Leçon ${i + 1} sur ${LESSONS.length} · ${l.minutes} min de lecture</div>
      <h1>${l.title}</h1>
      ${fig}
      <div class="lesson-body">${l.body}</div>
      <div class="keys"><h3>À retenir</h3><ul>${l.keyPoints.map((k) => `<li>${k}</li>`).join("")}</ul></div>
      <div class="cta">${l.cta.map(ctaButton).join("")}</div>
      <div class="lesson-pager">
        ${prev ? `<button type="button" class="btn ghost" data-lesson="${prev.id}">← ${prev.title}</button>` : "<span></span>"}
        ${
          next
            ? `<button type="button" class="btn ghost" data-lesson="${next.id}">${next.title} →</button>`
            : `<button type="button" class="btn ghost" data-go-tab="quiz">Passer au quiz →</button>`
        }
      </div>`;
    const n = readLessons.size;
    $("#progressLabel").textContent = `${n} / ${LESSONS.length} leçons`;
    $("#progressBar").style.width = (n / LESSONS.length) * 100 + "%";
    const doneMark = $(`#lessonList [data-lesson="${l.id}"] .done`);
    if (doneMark) doneMark.textContent = "✓";
    scheduleSave();
  }

  function renderGlossary() {
    $("#lesson").innerHTML = `
      <div class="meta">Référence</div>
      <h1>Glossaire</h1>
      <div class="gloss">
        <label class="field" for="glossSearch"><span>Rechercher un terme</span><input id="glossSearch" type="text" placeholder="ex. theta, assignation, VI…" autocomplete="off"></label>
        <div class="gloss-list" id="glossList"></div>
      </div>`;
    const draw = (q) => {
      const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const nq = norm(q || "");
      const items = CT.GLOSSARY.filter(([t, d]) => !nq || norm(t + " " + d).includes(nq));
      $("#glossList").innerHTML = items.length
        ? items.map(([t, d]) => `<div class="gloss-item"><b>${t}</b><span>${d}</span></div>`).join("")
        : `<p class="note">Aucun terme ne correspond à « ${esc(q)} ».</p>`;
    };
    draw("");
    $("#glossSearch").addEventListener("input", (e) => draw(e.target.value));
  }

  function bindCourse() {
    document.addEventListener("click", (e) => {
      const lessonBtn = e.target.closest("[data-lesson]");
      if (lessonBtn) {
        currentLesson = lessonBtn.dataset.lesson;
        renderCourse();
        const top = $("#lesson").getBoundingClientRect().top + window.scrollY - 80;
        if (window.scrollY > top) window.scrollTo({ top });
        return;
      }
      const preset = e.target.closest("[data-go-preset]");
      if (preset) {
        loadStrategy(preset.dataset.goPreset);
        showTab("simulateur", true);
        return;
      }
      if (e.target.closest("[data-go-example]")) {
        loadExample();
        showTab("simulateur", true);
        return;
      }
      const tab = e.target.closest("[data-go-tab]");
      if (tab) showTab(tab.dataset.goTab, true);
    });
  }

  // ---------- Labo Grecques ----------
  const lab = Object.assign(
    { kind: "call", S: 100, K: 100, T: 30, V: 30, R: 4, metric: "price" },
    store.lab && typeof store.lab === "object" ? store.lab : {}
  );
  ["S", "K", "T", "V", "R"].forEach((k) => {
    if (typeof lab[k] !== "number" || !isFinite(lab[k])) lab[k] = { S: 100, K: 100, T: 30, V: 30, R: 4 }[k];
  });
  if (!["call", "put"].includes(lab.kind)) lab.kind = "call";
  if (!["price", "delta", "gamma", "theta", "vega"].includes(lab.metric)) lab.metric = "price";
  const LAB_FIELDS = { S: [1, 2000], K: [1, 2000], T: [1, 730], V: [1, 200], R: [0, 20] };
  const labChart = new Plot($("#labChart"));

  function renderLab() {
    Object.keys(LAB_FIELDS).forEach((k) => {
      const n = $("#lab" + k + "n");
      if (document.activeElement !== n) n.value = lab[k];
      $("#lab" + k).value = lab[k];
    });
    $$("#labKind [data-kind]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.kind === lab.kind));
    $$("#labMetric [data-m]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.m === lab.metric));
    const { kind, S, K, T, V, R } = lab;
    const g = E.bsGreeks(kind, S, K, T / E.DAYS_PER_YEAR, V / 100, R / 100);
    const intr = E.intrinsic(kind, S, K);
    const tv = Math.max(0, g.price - intr);
    const atm = Math.abs(S - K) <= S * 0.005;
    const itm = !atm && (kind === "call" ? S > K : S < K);
    const mon = atm ? ["neutre", "À la monnaie (ATM)"] : itm ? ["haussier", "Dans la monnaie (ITM)"] : ["baissier", "Hors de la monnaie (OTM)"];
    $("#labPrice").innerHTML = `
      <div class="stat"><span class="k">Prime ${kind === "call" ? "du call" : "du put"}</span><span class="v">${money(g.price)}</span><span class="s">${money(
      g.price * 100
    )} par contrat · <span class="tag ${mon[0]}">${mon[1]}</span></span></div>
      <div class="stat"><span class="k">Valeur intrinsèque</span><span class="v">${money(intr)}</span><span class="s">${
      kind === "call" ? "max(S − K, 0)" : "max(K − S, 0)"
    }</span></div>
      <div class="stat"><span class="k">Valeur temps</span><span class="v">${money(tv)}</span><span class="s">${
      g.price > 0 ? pct((tv / g.price) * 100, 0) + " de la prime" : "—"
    }</span></div>`;
    const cards = [
      ["Δ", "Delta", num(g.delta, 3), `+1 $ sur le sous-jacent : ${sMoney(g.delta * 100, 0)} par contrat.`],
      ["Γ", "Gamma", num(g.gamma, 4), `+1 $ : le delta passe de ${num(g.delta, 2)} à ${num(g.delta + g.gamma, 2)}.`],
      ["Θ", "Theta", num(g.theta, 3), `Chaque jour : ${sMoney(g.theta * 100, 0)} par contrat.`],
      ["ν", "Vega", num(g.vega, 3), `+1 point de VI : ${sMoney(g.vega * 100, 0)} par contrat.`],
      ["ρ", "Rho", num(g.rho, 3), `+1 point de taux : ${sMoney(g.rho * 100, 0)} par contrat.`],
    ];
    $("#labGreeks").innerHTML = cards
      .map(
        ([s, n, v, ex]) =>
          `<div class="gcard"><span><span class="sym">${s}</span> <b>${n}</b></span><span class="val">${v}</span><span class="ex">${ex}</span></div>`
      )
      .join("");

    // Courbes en fonction du cours, pour plusieurs durées restantes
    const xmin = Math.max(0.5, Math.min(K * 0.6, S * 0.9));
    const xmax = Math.max(K * 1.4, S * 1.1);
    const N = 220;
    const xs = [];
    for (let i = 0; i <= N; i++) xs.push(xmin + ((xmax - xmin) * i) / N);
    const daysSet = Array.from(new Set([T, Math.max(1, Math.round(T / 3)), 1])).filter((d) => d >= 1).sort((a, b) => b - a);
    const colors = ["accent", "violet", "warn"];
    const val = (x, d) => {
      const r = E.bsGreeks(kind, x, K, d / E.DAYS_PER_YEAR, V / 100, R / 100);
      return lab.metric === "price" ? r.price : r[lab.metric];
    };
    const series = daysSet.map((d, i) => ({ pts: xs.map((x) => [x, val(x, d)]), color: colors[i], width: i ? 1.8 : 2.6, label: `${d} j` }));
    if (lab.metric === "price")
      series.push({ pts: xs.map((x) => [x, E.intrinsic(kind, x, K)]), color: "fg", dash: [6, 5], width: 1.5, alpha: 0.8, label: "Échéance" });
    const all = series.reduce((acc, s) => acc.concat(s.pts.map((p) => p[1])), []);
    let ymin = Math.min.apply(null, all.concat(lab.metric === "price" ? [0] : []));
    let ymax = Math.max.apply(null, all.concat(lab.metric === "price" ? [0] : []));
    if (lab.metric !== "price" && ymin > 0) ymin = 0;
    if (lab.metric !== "price" && ymax < 0) ymax = 0;
    const pad = (ymax - ymin) * 0.08 || 0.01;
    const dec = { price: 2, delta: 2, gamma: 3, theta: 3, vega: 3 }[lab.metric];
    labChart.set({
      xmin,
      xmax,
      ymin: ymin - pad,
      ymax: ymax + pad,
      base: lab.metric === "price" ? null : 0,
      padLeft: 58,
      xFmt: (v) => num(v, 0) + " $",
      yFmt: (v) => num(v, lab.metric === "price" ? (Math.abs(ymax) >= 100 ? 0 : 1) : dec),
      markers: [
        { x: K, color: "muted", dash: [2, 3], label: `Strike ${px(K)}` },
        { x: S, color: "fg", dash: [4, 4], label: `Cours ${px(S)}` },
      ],
      series,
      tooltip: (x) =>
        `Cours <b>${money(x)}</b><br>` +
        series
          .map((s) => {
            const y = interp(s.pts, x);
            return `${s.label} : <b>${y == null ? "—" : num(y, lab.metric === "price" ? 2 : dec + 1)}</b>`;
          })
          .join("<br>"),
    });
    const swatch = (c, dash) =>
      `<i style="display:inline-block;width:18px;border-top:2px ${dash ? "dashed" : "solid"} var(--${c});vertical-align:middle;margin-right:6px"></i>`;
    $("#labLegend").innerHTML = series.map((s) => `<span>${swatch(s.color, !!s.dash)}${s.label}</span>`).join("");
    scheduleSave();
  }

  function bindLab() {
    Object.keys(LAB_FIELDS).forEach((k) => {
      const [a, b] = LAB_FIELDS[k];
      $("#lab" + k).addEventListener("input", (e) => {
        lab[k] = +e.target.value;
        renderLab();
      });
      $("#lab" + k + "n").addEventListener("change", (e) => {
        const v = parseFloat(e.target.value);
        if (v >= a && v <= b) lab[k] = k === "T" ? Math.round(v) : v;
        renderLab();
      });
    });
    $("#labKind").addEventListener("click", (e) => {
      const b = e.target.closest("[data-kind]");
      if (!b) return;
      lab.kind = b.dataset.kind;
      renderLab();
    });
    $("#labMetric").addEventListener("click", (e) => {
      const b = e.target.closest("[data-m]");
      if (!b) return;
      lab.metric = b.dataset.m;
      renderLab();
    });
  }

  // ---------- Quiz ----------
  const ROUND = 10;
  let quizBest = typeof store.quizBest === "number" ? store.quizBest : null;
  let quiz = null;
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function newRound() {
    const statics = shuffle(CT.QUIZ.slice()).slice(0, ROUND - 3);
    const gens = shuffle(CT.QUIZ_GENERATORS.slice()).slice(0, 3).map((g) => g());
    const qs = shuffle(statics.concat(gens)).map((q) => {
      const order = shuffle(q.options.map((_, i) => i));
      return { q: q.q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer), explain: q.explain };
    });
    quiz = { qs, idx: 0, picks: [] };
  }
  function renderQuiz() {
    if (!quiz) newRound();
    const el = $("#quiz");
    const done = quiz.idx >= quiz.qs.length;
    const dots = quiz.qs
      .map((q, i) => {
        const p = quiz.picks[i];
        const cls = p == null ? (i === quiz.idx ? "cur" : "") : p === q.answer ? "ok" : "ko";
        return `<i class="${cls}"></i>`;
      })
      .join("");
    const best = quizBest == null ? "" : `<span class="note">Meilleur score : ${quizBest} / ${ROUND}</span>`;
    if (done) {
      const score = quiz.picks.filter((p, i) => p === quiz.qs[i].answer).length;
      const msg =
        score >= 9
          ? "Excellent. Vous maîtrisez les bases, passez aux stratégies avancées dans le simulateur."
          : score >= 6
          ? "Bon résultat. Relisez les explications des questions manquées."
          : "Les bases ne sont pas encore acquises : reprenez les leçons 1 à 4, puis recommencez.";
      const missed = quiz.qs
        .map((q, i) => ({ q, p: quiz.picks[i] }))
        .filter((x) => x.p !== x.q.answer)
        .map((x) => `<li><strong>${esc(x.q.q)}</strong><br>Bonne réponse : ${esc(x.q.options[x.q.answer])}. <span class="muted">${esc(x.q.explain)}</span></li>`)
        .join("");
      el.innerHTML = `
        <div class="quiz-top"><h1>Quiz</h1>${best}</div>
        <div class="qdots">${dots}</div>
        <div class="qcard">
          <span class="eyebrow">Résultat</span>
          <div class="score">${score} / ${ROUND}</div>
          <p>${msg}</p>
          ${missed ? `<div><h3>À revoir</h3><ul class="experiments">${missed}</ul></div>` : ""}
          <div class="cta"><button type="button" class="btn" id="quizRestart">Nouvelle série</button><button type="button" class="btn ghost" data-go-tab="cours">Revoir les cours</button></div>
        </div>`;
      return;
    }
    const q = quiz.qs[quiz.idx];
    const picked = quiz.picks[quiz.idx];
    const answered = picked != null;
    el.innerHTML = `
      <div class="quiz-top"><h1>Quiz</h1>${best}</div>
      <div class="qdots" aria-hidden="true">${dots}</div>
      <div class="qcard">
        <span class="eyebrow">Question ${quiz.idx + 1} sur ${quiz.qs.length}</span>
        <h2>${esc(q.q)}</h2>
        <div class="opts">${q.options
          .map((o, i) => {
            let cls = "opt";
            if (answered && i === q.answer) cls += " right";
            else if (answered && i === picked) cls += " wrong";
            return `<button type="button" class="${cls}" data-opt="${i}"${answered ? " disabled" : ""}><span class="l">${"ABCD"[i]}</span><span>${esc(o)}</span></button>`;
          })
          .join("")}</div>
        ${
          answered
            ? `<p class="explain"><strong>${picked === q.answer ? "Exact." : "Pas tout à fait."}</strong> ${esc(q.explain)}</p>
               <div class="cta"><button type="button" class="btn" id="quizNext">${quiz.idx + 1 < quiz.qs.length ? "Question suivante" : "Voir le résultat"}</button></div>`
            : ""
        }
      </div>`;
  }
  function bindQuiz() {
    $("#quiz").addEventListener("click", (e) => {
      const opt = e.target.closest("[data-opt]");
      if (opt && quiz && quiz.picks[quiz.idx] == null) {
        quiz.picks[quiz.idx] = +opt.dataset.opt;
        renderQuiz();
        const next = $("#quizNext");
        if (next) next.focus({ preventScroll: true });
        return;
      }
      if (e.target.closest("#quizNext")) {
        quiz.idx++;
        if (quiz.idx >= quiz.qs.length) {
          const score = quiz.picks.filter((p, i) => p === quiz.qs[i].answer).length;
          quizBest = quizBest == null ? score : Math.max(quizBest, score);
          scheduleSave();
        }
        renderQuiz();
        return;
      }
      if (e.target.closest("#quizRestart")) {
        newRound();
        renderQuiz();
      }
    });
  }

  // ---------- Démarrage ----------
  function redrawAll() {
    plots.forEach((p) => p.draw());
  }
  function start() {
    if (!restoreSim(store.sim)) loadExample();
    syncMarketInputs();
    bindSim();
    bindCourse();
    bindLab();
    bindQuiz();
    $$(".tab").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
    window.addEventListener("hashchange", () => {
      const h = location.hash.slice(1);
      if (TABS.includes(h) && h !== currentTab) showTab(h);
    });
    let ladderW = 0;
    const onLadderResize = () => {
      const w = $("#ladder").clientWidth;
      if (w && w !== ladderW && !dragging) {
        ladderW = w;
        renderLadder();
      }
    };
    if ("ResizeObserver" in window) new ResizeObserver(onLadderResize).observe($("#ladder"));
    else window.addEventListener("resize", onLadderResize);
    try {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redrawAll);
    } catch (e) {
      /* ancien navigateur */
    }
    new MutationObserver(redrawAll).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const h = location.hash.slice(1);
    showTab(TABS.includes(h) ? h : TABS.includes(store.tab) ? store.tab : "simulateur");
  }
  start();
})();
