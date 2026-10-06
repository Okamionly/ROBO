(() => {
  // ---------- Black-Scholes-Merton (options européennes) ----------
  const SQRT2PI = Math.sqrt(2 * Math.PI);
  function pdf(x){ return Math.exp(-0.5 * x * x) / SQRT2PI; }
  // Abramowitz & Stegun 26.2.17 (|erreur| < 7.5e-8)
  function cdf(x){
    const k = 1 / (1 + 0.2316419 * Math.abs(x));
    const poly = k * (0.319381530 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))));
    const p = 1 - pdf(x) * poly;
    return x >= 0 ? p : 1 - p;
  }

  // T en années ; sigma, r, q en décimal. Véga et rho par point (1 %), thêta par jour calendaire.
  function bsm(type, S, K, T, r, q, sigma){
    const call = type === "call";
    if(!(T > 0)){
      const step = S > K ? 1 : S < K ? 0 : 0.5;
      return {
        price: call ? Math.max(S - K, 0) : Math.max(K - S, 0),
        delta: call ? step : step - 1,
        gamma: 0, theta: 0, vega: 0, rho: 0,
        probITM: call ? (S > K ? 1 : 0) : (S < K ? 1 : 0),
      };
    }
    const sqT = Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqT);
    const d2 = d1 - sigma * sqT;
    const dq = Math.exp(-q * T), dr = Math.exp(-r * T);
    const nd1 = pdf(d1);
    const gamma = dq * nd1 / (S * sigma * sqT);
    const vega = S * dq * nd1 * sqT / 100;
    const decay = -S * dq * nd1 * sigma / (2 * sqT);
    if(call){
      const Nd1 = cdf(d1), Nd2 = cdf(d2);
      return {
        price: S * dq * Nd1 - K * dr * Nd2,
        delta: dq * Nd1, gamma, vega,
        theta: (decay - r * K * dr * Nd2 + q * S * dq * Nd1) / 365,
        rho: K * T * dr * Nd2 / 100,
        probITM: Nd2,
      };
    }
    const Nmd1 = cdf(-d1), Nmd2 = cdf(-d2);
    return {
      price: K * dr * Nmd2 - S * dq * Nmd1,
      delta: -dq * Nmd1, gamma, vega,
      theta: (decay + r * K * dr * Nmd2 - q * S * dq * Nmd1) / 365,
      rho: -K * T * dr * Nmd2 / 100,
      probITM: Nmd2,
    };
  }

  if(typeof module !== "undefined" && module.exports) module.exports = { bsm, cdf };
  if(typeof document === "undefined") return;

  // ---------- Affichage ----------
  const $ = (s) => document.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const VB = { w:260, h:214, l:24, r:252, t:10, b:180 };
  const N = 161;

  const PANELS = [
    { key:"pnl",   title:"Risque (P&L)", sym:"P&L", color:"#22c55e", neg:"#ef4444", expiry:true },
    { key:"theta", title:"Thêta", sym:"Θ", color:"#22b8cf", unit:" / jour" },
    { key:"delta", title:"Delta", sym:"Δ", color:"#f0365a", expiry:true },
    { key:"vega",  title:"Véga",  sym:"ν", color:"#5ccf1f", unit:" / pt vol" },
    { key:"gamma", title:"Gamma", sym:"Γ", color:"#d63ad6" },
    { key:"rho",   title:"Rho",   sym:"ρ", color:"#e0a922", unit:" / pt taux" },
  ];

  const state = { type:"call", side:"long" };
  let cur = null;

  function num(v){
    if(!isFinite(v)) return "—";
    const a = Math.abs(v);
    if(a < 1e-9) return "0";
    const opts = a >= 100 ? { maximumFractionDigits:0 }
      : a >= 1 ? { minimumFractionDigits:2, maximumFractionDigits:2 }
      : { maximumSignificantDigits:3 };
    return v.toLocaleString("fr-FR", opts);
  }
  function signed(v){ return (v > 1e-9 ? "+" : v < -1e-9 ? "−" : "") + num(Math.abs(v)); }
  function price(v){ return isFinite(v) ? v.toLocaleString("fr-FR", { minimumFractionDigits:2, maximumFractionDigits:2 }) : "—"; }
  function pct(v){ return (100 * v).toLocaleString("fr-FR", { maximumFractionDigits:1 }) + " %"; }
  function fmtDays(d){ return d >= 10 ? String(Math.round(d)) : d.toLocaleString("fr-FR", { maximumFractionDigits:1 }); }

  function el(tag, attrs, parent){
    const e = document.createElementNS(NS, tag);
    for(const k in attrs) e.setAttribute(k, attrs[k]);
    if(parent) parent.appendChild(e);
    return e;
  }

  function readParams(){
    const n = (id, def) => { const v = parseFloat($(id).value); return isFinite(v) ? v : def; };
    return {
      type: state.type, side: state.side,
      S: Math.max(n("#spot", 100), 1e-6),
      K: Math.max(n("#strike", 100), 1e-6),
      sigma: Math.max(n("#vol", 30), 0.1) / 100,
      r: n("#rate", 0) / 100,
      q: n("#div", 0) / 100,
      days: Math.min(Math.max(Math.round(n("#days", 30)), 1), 365),
    };
  }

  // Plage de prix centrée sur le strike (±3 écarts-types), élargie pour toujours contenir le spot.
  function priceRange(p){
    const half = p.K * Math.max(0.12, 3 * p.sigma * Math.sqrt(p.days / 365));
    const pad = 0.1 * half;
    const lo = Math.max(Math.min(p.K - half, p.S - pad), p.K * 0.005);
    const hi = Math.max(p.K + half, p.S + pad);
    return [lo, hi];
  }

  function valueOf(key, g){
    return cur.sign * (key === "pnl" ? g.price - cur.premium : g[key]);
  }

  function drawPanel(panel, xs, series, p, lo, hi){
    const svg = panel.svg;
    svg.replaceChildren();

    let mn = 0, mx = 0;
    for(const s of series) for(const y of s.ys){ if(y < mn) mn = y; if(y > mx) mx = y; }
    if(mx - mn < 1e-12){ mx += 1; mn -= 1; }
    const span = mx - mn;
    mx += mx > 0 ? span * 0.08 : span * 0.03;
    mn -= mn < 0 ? span * 0.08 : span * 0.03;

    const X = (v) => VB.l + (v - lo) / (hi - lo) * (VB.r - VB.l);
    const Y = (v) => VB.b - (v - mn) / (mx - mn) * (VB.b - VB.t);
    const y0 = Y(0);
    panel.scale = { X, Y };

    // Dégradés et découpes au-dessus / au-dessous de zéro
    const id = panel.key;
    const neg = panel.neg || panel.color;
    const defs = el("defs", {}, svg);
    const gu = el("linearGradient", { id:`gu-${id}`, gradientUnits:"userSpaceOnUse", x1:0, y1:VB.t, x2:0, y2:y0 }, defs);
    el("stop", { offset:0, "stop-color":panel.color, "stop-opacity":0.55 }, gu);
    el("stop", { offset:1, "stop-color":panel.color, "stop-opacity":0.04 }, gu);
    const gd = el("linearGradient", { id:`gd-${id}`, gradientUnits:"userSpaceOnUse", x1:0, y1:VB.b, x2:0, y2:y0 }, defs);
    el("stop", { offset:0, "stop-color":neg, "stop-opacity":0.55 }, gd);
    el("stop", { offset:1, "stop-color":neg, "stop-opacity":0.04 }, gd);
    el("rect", { x:0, y:0, width:VB.w, height:y0 }, el("clipPath", { id:`cu-${id}` }, defs));
    el("rect", { x:0, y:y0, width:VB.w, height:VB.h - y0 }, el("clipPath", { id:`cd-${id}` }, defs));

    el("rect", { x:VB.l, y:VB.t, width:VB.r - VB.l, height:VB.b - VB.t, fill:"none", stroke:"#2c3550" }, svg);

    const line = (ys) => ys.map((y, i) => `${i ? "L" : "M"}${X(xs[i]).toFixed(2)} ${Y(y).toFixed(2)}`).join("");
    const solid = series[0];
    const area = `${line(solid.ys)}L${X(xs[xs.length - 1]).toFixed(2)} ${y0}L${X(xs[0]).toFixed(2)} ${y0}Z`;
    el("path", { d:area, fill:`url(#gu-${id})`, "clip-path":`url(#cu-${id})` }, svg);
    el("path", { d:area, fill:`url(#gd-${id})`, "clip-path":`url(#cd-${id})` }, svg);

    el("line", { x1:VB.l, x2:VB.r, y1:y0, y2:y0, stroke:"#c9d1e0", "stroke-opacity":0.55 }, svg);

    // Échéance (pointillés fins), puis échéances intermédiaires, puis courbe actuelle par-dessus
    for(const s of [...series].reverse()){
      const attrs = { d:line(s.ys), fill:"none", "stroke-width":s.style === "solid" ? 2.6 : 1.8, "stroke-linejoin":"round", "stroke-linecap":"round" };
      if(s.style === "dash"){ attrs["stroke-dasharray"] = "6 4"; attrs["stroke-opacity"] = 0.75; }
      if(s.style === "dot"){ attrs["stroke-dasharray"] = "1.5 3.5"; attrs["stroke-opacity"] = 0.7; }
      if(panel.neg){
        el("path", { ...attrs, stroke:panel.color, "clip-path":`url(#cu-${id})` }, svg);
        el("path", { ...attrs, stroke:panel.neg, "clip-path":`url(#cd-${id})` }, svg);
      } else {
        el("path", { ...attrs, stroke:panel.color }, svg);
      }
    }

    // Axes
    const axis = { fill:"#9aa3b2", "font-size":14 };
    if(panel.key === "pnl"){
      el("text", { ...axis, x:VB.l - 8, y:VB.t + 2, "text-anchor":"end", transform:`rotate(-90 ${VB.l - 8} ${VB.t + 2})` }, svg).textContent = "Gain";
      el("text", { ...axis, x:VB.l - 8, y:VB.b - 2, "text-anchor":"start", transform:`rotate(-90 ${VB.l - 8} ${VB.b - 2})` }, svg).textContent = "Perte";
    } else {
      el("text", { ...axis, x:VB.l - 8, y:VB.t + 9, "text-anchor":"middle", "font-size":17 }, svg).textContent = "+";
      el("text", { ...axis, x:VB.l - 8, y:VB.b, "text-anchor":"middle", "font-size":17 }, svg).textContent = "−";
    }
    const xk = X(p.K);
    el("line", { x1:xk, x2:xk, y1:VB.b, y2:VB.b + 4, stroke:"#9aa3b2" }, svg);
    el("text", { ...axis, x:xk, y:VB.b + 15, "text-anchor":"middle", "font-size":12 }, svg).textContent = "K";
    el("text", { ...axis, x:(VB.l + VB.r) / 2, y:VB.h - 3, "text-anchor":"middle" }, svg).textContent = "Prix du sous-jacent";

    // Point A = spot actuel
    const xa = X(p.S), ya = Y(panel.atSpot);
    el("line", { x1:xa, x2:xa, y1:VB.t, y2:VB.b, stroke:"#e6ebf5", "stroke-opacity":0.7, "stroke-dasharray":"2 3" }, svg);
    el("circle", { cx:xa, cy:ya, r:3.6, fill:"#fff", stroke:panel.color, "stroke-width":2 }, svg);
    const la = ya < (VB.t + VB.b) / 2 ? ya + 20 : ya - 10;
    el("text", { x:xa, y:la, "text-anchor":"middle", fill:"#fff", "font-size":16, stroke:"#0f1115", "stroke-width":3, "paint-order":"stroke" }, svg).textContent = "A";

    // Repère de survol
    const g = el("g", { visibility:"hidden", "pointer-events":"none" }, svg);
    panel.hover = {
      g,
      line: el("line", { y1:VB.t, y2:VB.b, stroke:panel.color, "stroke-opacity":0.85 }, g),
      dot: el("circle", { r:3.4, fill:panel.color, stroke:"#0f1115", "stroke-width":1.5 }, g),
    };
  }

  function readout(panel, v, S, atSpot){
    return `${panel.sym} = ${signed(v)}${panel.unit || ""} · ${atSpot ? "A" : "S"} = ${price(S)}`;
  }

  function explain(key, p, now){
    const long = p.side === "long", call = p.type === "call";
    const prem = price(now.price);
    const be = price(call ? p.K + now.price : p.K - now.price);
    const dir = (call ? 1 : -1) * (long ? 1 : -1) > 0;
    switch(key){
      case "pnl":
        if(long && call) return `Le call s'apprécie quand le sous-jacent monte. Gain théoriquement illimité ; perte maximale limitée à la prime payée (${prem}). Point mort à l'échéance : ${be}.`;
        if(long) return `Le put s'apprécie quand le sous-jacent baisse. Gain maximal ${price(p.K - now.price)} (sous-jacent à 0) ; perte maximale limitée à la prime payée (${prem}). Point mort à l'échéance : ${be}.`;
        if(call) return `Le vendeur du call encaisse la prime (${prem}) : c'est son gain maximal. Perte théoriquement illimitée si le sous-jacent monte. Point mort à l'échéance : ${be}.`;
        return `Le vendeur du put encaisse la prime (${prem}) : c'est son gain maximal. Perte maximale ${price(p.K - now.price)} si le sous-jacent tombe à 0. Point mort à l'échéance : ${be}.`;
      case "theta":
        return long
          ? `Le thêta est généralement négatif pour l'acheteur : ${call ? "le call" : "le put"} perd de la valeur chaque jour qui passe. L'érosion s'accélère à l'approche de l'échéance (pointillés) et se concentre autour du strike.`
          : `Le thêta est généralement positif pour le vendeur : le temps qui passe joue en sa faveur. Ce gain s'accélère à l'approche de l'échéance (pointillés), surtout autour du strike.`;
      case "delta":
        return `Le delta est ${dir ? "positif (0 à +1)" : "négatif (−1 à 0)"} : la position gagne quand le sous-jacent ${dir ? "monte" : "baisse"} et perd dans le cas inverse (à volatilité constante). À l'approche de l'échéance, la courbe se raidit autour du strike : la position devient plus sensible aux variations de prix.`;
      case "vega":
        return long
          ? `Le véga est positif : une hausse de la volatilité implicite profite à la position, une baisse la pénalise. Il est maximal près du strike et diminue à l'approche de l'échéance.`
          : `Le véga est négatif : une hausse de la volatilité implicite pénalise le vendeur, une baisse lui profite. L'exposition est maximale près du strike et diminue à l'approche de l'échéance.`;
      case "gamma":
        return long
          ? `Le gamma, vitesse de variation du delta, est positif et maximal près du strike : c'est là que le delta bouge le plus vite. Le pic se resserre et grandit à l'approche de l'échéance.`
          : `Le gamma est négatif pour le vendeur : le delta évolue contre la position quand le prix bouge. Le risque est maximal près du strike et s'intensifie à l'approche de l'échéance.`;
      case "rho": {
        const why = call
          ? "acheter un call plutôt que le sous-jacent laisse le cash placé au taux sans risque"
          : "le strike encaissé à l'échéance vaut moins aujourd'hui quand les taux montent";
        return `Le rho est ${dir ? "positif : une hausse des taux augmente" : "négatif : une hausse des taux réduit"} la valeur de la position (${why}). Son effet diminue à l'approche de l'échéance.`;
      }
    }
    return "";
  }

  function renderKpis(p, now){
    const long = p.side === "long", call = p.type === "call";
    const intrinsic = call ? Math.max(p.S - p.K, 0) : Math.max(p.K - p.S, 0);
    const capped = price(p.K - now.price);
    const items = [
      [long ? "Prime payée" : "Prime encaissée", price(now.price)],
      ["Point mort (échéance)", price(call ? p.K + now.price : p.K - now.price)],
      ["Valeur intrinsèque", price(intrinsic)],
      ["Valeur temps", price(now.price - intrinsic)],
      ["Proba. ITM (risque-neutre)", pct(now.probITM)],
      ["Gain max", long ? (call ? "illimité" : capped) : price(now.price)],
      ["Perte max", long ? price(now.price) : (call ? "illimitée" : capped)],
    ];
    $("#kpis").replaceChildren(...items.map(([label, value]) => {
      const pill = document.createElement("span");
      pill.className = "pill";
      const l = document.createElement("span"); l.className = "muted"; l.textContent = label;
      const b = document.createElement("b"); b.textContent = value;
      pill.append(l, b);
      return pill;
    }));
  }

  function renderLegend(days){
    const sample = (dash, opacity) => {
      const svg = el("svg", { width:28, height:8, viewBox:"0 0 28 8", "aria-hidden":"true" });
      el("line", { x1:1, x2:27, y1:4, y2:4, stroke:"#eef1f7", "stroke-width":2, "stroke-opacity":opacity, "stroke-dasharray":dash, "stroke-linecap":"round" }, svg);
      return svg;
    };
    const item = (svg, text) => { const s = document.createElement("span"); s.append(svg, text); return s; };
    $("#legend").replaceChildren(
      item(sample("none", 1), `Aujourd'hui (J-${fmtDays(days)})`),
      item(sample("6 4", 0.75), `J-${fmtDays(days * 2 / 3)} et J-${fmtDays(days / 3)}`),
      item(sample("1.5 3.5", 0.7), "À l'échéance (P&L, Delta)"),
    );
  }

  function render(){
    const p = readParams();
    $("#daysOut").textContent = p.days;
    const now = bsm(p.type, p.S, p.K, p.days / 365, p.r, p.q, p.sigma);
    cur = { p, premium:now.price, sign:p.side === "long" ? 1 : -1 };
    const [lo, hi] = priceRange(p);
    cur.lo = lo; cur.hi = hi;

    const xs = Array.from({ length:N }, (_, i) => lo + (hi - lo) * i / (N - 1));
    const slices = [
      { days:p.days, style:"solid" },
      { days:p.days * 2 / 3, style:"dash" },
      { days:p.days / 3, style:"dash" },
      { days:0, style:"dot" },
    ];
    const grid = slices.map((s) => xs.map((x) => bsm(p.type, x, p.K, s.days / 365, p.r, p.q, p.sigma)));

    for(const panel of PANELS){
      const series = slices
        .map((s, i) => ({ ...s, ys:grid[i].map((g) => valueOf(panel.key, g)) }))
        .filter((s) => s.days > 0 || panel.expiry);
      panel.atSpot = valueOf(panel.key, now);
      drawPanel(panel, xs, series, p, lo, hi);
      panel.valEl.textContent = readout(panel, panel.atSpot, p.S, true);
      panel.txtEl.textContent = explain(panel.key, p, now);
    }
    renderKpis(p, now);
    renderLegend(p.days);
  }

  function onHover(e){
    if(!cur) return;
    const r = e.currentTarget.getBoundingClientRect();
    const vx = (e.clientX - r.left) / r.width * VB.w;
    if(vx < VB.l || vx > VB.r){ clearHover(); return; }
    const S = cur.lo + (vx - VB.l) / (VB.r - VB.l) * (cur.hi - cur.lo);
    const { p } = cur;
    const g = bsm(p.type, S, p.K, p.days / 365, p.r, p.q, p.sigma);
    for(const panel of PANELS){
      const v = valueOf(panel.key, g);
      const x = panel.scale.X(S);
      panel.hover.line.setAttribute("x1", x);
      panel.hover.line.setAttribute("x2", x);
      panel.hover.dot.setAttribute("cx", x);
      panel.hover.dot.setAttribute("cy", panel.scale.Y(v));
      panel.hover.g.setAttribute("visibility", "visible");
      panel.valEl.textContent = readout(panel, v, S, false);
    }
  }

  function clearHover(){
    if(!cur) return;
    for(const panel of PANELS){
      panel.hover?.g.setAttribute("visibility", "hidden");
      panel.valEl.textContent = readout(panel, panel.atSpot, cur.p.S, true);
    }
  }

  function init(){
    const host = $("#panels");
    for(const panel of PANELS){
      const card = document.createElement("div");
      card.className = "gk";
      const h = document.createElement("h3");
      h.textContent = panel.title;
      const val = document.createElement("div");
      val.className = "gk-val";
      val.style.color = panel.color;
      const svg = el("svg", { viewBox:`0 0 ${VB.w} ${VB.h}`, role:"img", "aria-label":`${panel.title} en fonction du prix du sous-jacent` });
      const txt = document.createElement("p");
      txt.className = "gk-txt";
      card.append(h, val, svg, txt);
      host.appendChild(card);
      Object.assign(panel, { svg, valEl:val, txtEl:txt });
      svg.addEventListener("pointermove", onHover);
      svg.addEventListener("pointerleave", clearHover);
    }

    document.querySelectorAll(".seg").forEach((seg) => seg.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-v]");
      if(!b) return;
      state[seg.dataset.name] = b.dataset.v;
      seg.querySelectorAll("button").forEach((x) => {
        x.classList.toggle("on", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      });
      render();
    }));
    ["#spot", "#strike", "#vol", "#rate", "#div", "#days"].forEach((id) => $(id).addEventListener("input", render));
    $("#btnAtm").addEventListener("click", () => { $("#strike").value = $("#spot").value; render(); });

    render();
  }

  init();
})();
