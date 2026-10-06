/*
 * options_engine.js — Moteur de calcul du Labo Options.
 * Black-Scholes (sans dividende), Grecques, volatilité implicite,
 * positions multi-jambes (calls, puts, actions) et catalogue de stratégies.
 * Utilisable dans le navigateur (window.OptionsEngine) et sous Node (require).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.OptionsEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DAYS_PER_YEAR = 365;
  const CONTRACT_SIZE = 100;
  const SQRT_2PI = Math.sqrt(2 * Math.PI);

  // ---------- Loi normale ----------
  function normPdf(x) {
    return Math.exp(-0.5 * x * x) / SQRT_2PI;
  }
  // Abramowitz & Stegun 26.2.17 (erreur absolue < 7.5e-8)
  function normCdf(x) {
    if (x === Infinity) return 1;
    if (x === -Infinity) return 0;
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const poly = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    const p = 1 - normPdf(x) * poly;
    return x >= 0 ? p : 1 - p;
  }

  // ---------- Black-Scholes ----------
  function intrinsic(kind, S, K) {
    return kind === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
  }

  function bsPrice(kind, S, K, T, sigma, r) {
    if (T <= 0) return intrinsic(kind, S, K);
    const df = Math.exp(-r * T);
    if (S <= 0) return kind === "call" ? 0 : K * df;
    if (sigma <= 0) return kind === "call" ? Math.max(S - K * df, 0) : Math.max(K * df - S, 0);
    const vs = sigma * Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / vs;
    const d2 = d1 - vs;
    return kind === "call"
      ? S * normCdf(d1) - K * df * normCdf(d2)
      : K * df * normCdf(-d2) - S * normCdf(-d1);
  }

  // theta par jour calendaire, vega et rho pour 1 point (%)
  function bsGreeks(kind, S, K, T, sigma, r) {
    const price = bsPrice(kind, S, K, T, sigma, r);
    if (T <= 0 || sigma <= 0 || S <= 0) {
      let delta = 0;
      if (kind === "call") delta = S > K ? 1 : 0;
      else delta = S < K ? -1 : 0;
      return { price, delta, gamma: 0, theta: 0, vega: 0, rho: 0 };
    }
    const sqT = Math.sqrt(T);
    const vs = sigma * sqT;
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / vs;
    const d2 = d1 - vs;
    const df = Math.exp(-r * T);
    const pdf = normPdf(d1);
    const gamma = pdf / (S * vs);
    const vega = (S * pdf * sqT) / 100;
    const decay = -(S * pdf * sigma) / (2 * sqT);
    if (kind === "call") {
      return {
        price,
        delta: normCdf(d1),
        gamma,
        theta: (decay - r * K * df * normCdf(d2)) / DAYS_PER_YEAR,
        vega,
        rho: (K * T * df * normCdf(d2)) / 100,
      };
    }
    return {
      price,
      delta: normCdf(d1) - 1,
      gamma,
      theta: (decay + r * K * df * normCdf(-d2)) / DAYS_PER_YEAR,
      vega,
      rho: (-K * T * df * normCdf(-d2)) / 100,
    };
  }

  // Volatilité implicite par dichotomie. `clamped` signale une prime hors bornes.
  function impliedVol(kind, price, S, K, T, r) {
    const lo0 = 0.001;
    const hi0 = 5;
    if (T <= 0) return { iv: null, clamped: true };
    const pLo = bsPrice(kind, S, K, T, lo0, r);
    const pHi = bsPrice(kind, S, K, T, hi0, r);
    if (price <= pLo) return { iv: lo0, clamped: true };
    if (price >= pHi) return { iv: hi0, clamped: true };
    let lo = lo0;
    let hi = hi0;
    for (let i = 0; i < 80; i++) {
      const mid = 0.5 * (lo + hi);
      if (bsPrice(kind, S, K, T, mid, r) > price) hi = mid;
      else lo = mid;
    }
    return { iv: 0.5 * (lo + hi), clamped: false };
  }

  // ---------- Strikes ----------
  function strikeStep(spot) {
    if (spot < 10) return 0.5;
    if (spot < 50) return 1;
    if (spot < 150) return 2.5;
    if (spot < 600) return 5;
    if (spot < 1500) return 10;
    return 25;
  }
  function roundToStep(x, step) {
    return +(Math.round(x / step) * step).toFixed(4);
  }

  // ---------- Positions ----------
  // leg : { kind: 'call'|'put'|'stock', side: 1|-1, qty, strike, dte, premium (null = théorique) }
  // mkt : { spot, iv (décimal), rate (décimal) }
  function legSize(leg) {
    return leg.kind === "stock" ? leg.qty : leg.qty * CONTRACT_SIZE;
  }

  function priceLegs(legs, mkt) {
    return legs.map((leg) => {
      if (leg.kind === "stock") {
        return Object.assign({}, leg, { entry: mkt.spot, iv: 0, theo: mkt.spot, ivClamped: false });
      }
      const T = leg.dte / DAYS_PER_YEAR;
      const theo = bsPrice(leg.kind, mkt.spot, leg.strike, T, mkt.iv, mkt.rate);
      if (leg.premium != null && isFinite(leg.premium) && leg.premium >= 0) {
        const res = impliedVol(leg.kind, leg.premium, mkt.spot, leg.strike, T, mkt.rate);
        return Object.assign({}, leg, {
          entry: leg.premium,
          iv: res.iv == null ? mkt.iv : res.iv,
          theo,
          ivClamped: res.clamped,
        });
      }
      return Object.assign({}, leg, { entry: theo, iv: mkt.iv, theo, ivClamped: false });
    });
  }

  // Montant payé (> 0 = débit) ou encaissé (< 0 = crédit) à l'ouverture
  function positionCost(priced) {
    return priced.reduce((s, l) => s + l.side * legSize(l) * l.entry, 0);
  }

  function legValue(leg, S, days, ivMult, rate) {
    if (leg.kind === "stock") return S;
    const T = Math.max(leg.dte - days, 0) / DAYS_PER_YEAR;
    return bsPrice(leg.kind, S, leg.strike, T, leg.iv * ivMult, rate);
  }

  // Valeur de liquidation de la position
  function positionValue(priced, S, days, ivMult, rate) {
    return priced.reduce((s, l) => s + l.side * legSize(l) * legValue(l, S, days, ivMult, rate), 0);
  }

  function positionPL(priced, S, days, ivMult, rate) {
    return priced.reduce(
      (s, l) => s + l.side * legSize(l) * (legValue(l, S, days, ivMult, rate) - l.entry),
      0
    );
  }

  function positionGreeks(priced, S, days, ivMult, rate) {
    const g = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
    priced.forEach((l) => {
      const n = l.side * legSize(l);
      if (l.kind === "stock") {
        g.delta += n;
        return;
      }
      const T = Math.max(l.dte - days, 0) / DAYS_PER_YEAR;
      const lg = bsGreeks(l.kind, S, l.strike, T, l.iv * ivMult, rate);
      g.delta += n * lg.delta;
      g.gamma += n * lg.gamma;
      g.theta += n * lg.theta;
      g.vega += n * lg.vega;
      g.rho += n * lg.rho;
    });
    return g;
  }

  // Première échéance : c'est l'horizon des statistiques (perte max, point mort...)
  function horizonDays(priced) {
    const opts = priced.filter((l) => l.kind !== "stock");
    return opts.length ? Math.min.apply(null, opts.map((l) => l.dte)) : 0;
  }

  // ---------- Distribution log-normale du sous-jacent ----------
  function probBelow(x, S0, T, sigma, r) {
    if (x <= 0) return 0;
    if (x === Infinity) return 1;
    if (T <= 0 || sigma <= 0) return x >= S0 ? 1 : 0;
    const z = (Math.log(x / S0) - (r - 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    return normCdf(z);
  }
  function lognormalPdf(x, S0, T, sigma, r) {
    if (x <= 0 || T <= 0 || sigma <= 0) return 0;
    const vs = sigma * Math.sqrt(T);
    const z = (Math.log(x / S0) - (r - 0.5 * sigma * sigma) * T) / vs;
    return normPdf(z) / (x * vs);
  }

  function bisect(f, a, b) {
    let fa = f(a);
    for (let i = 0; i < 70; i++) {
      const m = 0.5 * (a + b);
      const fm = f(m);
      if (fm === 0) return m;
      if (Math.sign(fm) === Math.sign(fa)) {
        a = m;
        fa = fm;
      } else b = m;
    }
    return 0.5 * (a + b);
  }

  // Décrit où un extrême est atteint : sous x, au-dessus de x, à x, entre a et b, hors de [a, b]
  function describeRegion(xs, vs, target, tol) {
    const runs = [];
    let cur = null;
    xs.forEach((x, i) => {
      if (Math.abs(vs[i] - target) <= tol) {
        if (!cur) cur = { a: x, b: x, startIdx: i, endIdx: i };
        cur.b = x;
        cur.endIdx = i;
      } else if (cur) {
        runs.push(cur);
        cur = null;
      }
    });
    if (cur) runs.push(cur);
    if (!runs.length) return null;
    const last = xs.length - 1;
    const first = runs[0];
    const end = runs[runs.length - 1];
    if (runs.length >= 2 && first.startIdx === 0 && end.endIdx === last) return { type: "outside", a: first.b, b: end.a };
    if (first.startIdx === 0) return { type: "below", x: first.b };
    if (first.endIdx === last) return { type: "above", x: first.a };
    if (first.a === first.b) return { type: "at", x: first.a };
    return { type: "between", a: first.a, b: first.b };
  }

  // fallbackHorizon : horizon (jours) utilisé quand la position ne contient que des actions
  function analyzePosition(priced, mkt, fallbackHorizon) {
    const hasOptions = priced.some((l) => l.kind !== "stock");
    const horizon = hasOptions ? horizonDays(priced) : fallbackHorizon || 0;
    const rate = mkt.rate;
    const f = (S) => positionPL(priced, S, horizon, 1, rate);
    const strikes = priced.filter((l) => l.kind !== "stock").map((l) => l.strike);
    const top = Math.max.apply(null, [mkt.spot].concat(strikes));
    const hi = top * 4;
    const N = 800;
    const pts = new Set([0, hi]);
    for (let i = 1; i < N; i++) pts.add(+((hi * i) / N).toFixed(6));
    strikes.forEach((k) => pts.add(k));
    const xs = Array.from(pts).sort((a, b) => a - b);
    const vs = xs.map(f);

    let maxProfit = Math.max.apply(null, vs);
    let maxLoss = Math.min.apply(null, vs);
    const far = top * 40;
    const slope = (f(far * 1.01) - f(far)) / (far * 0.01);
    const unlimitedProfit = slope > 0.01;
    const unlimitedLoss = slope < -0.01;
    const tolP = Math.max(0.5, Math.abs(maxProfit) * 1e-4);
    const tolL = Math.max(0.5, Math.abs(maxLoss) * 1e-4);
    const maxProfitRegion = unlimitedProfit ? null : describeRegion(xs, vs, maxProfit, tolP);
    const maxLossRegion = unlimitedLoss ? null : describeRegion(xs, vs, maxLoss, tolL);
    if (unlimitedProfit) maxProfit = Infinity;
    if (unlimitedLoss) maxLoss = -Infinity;

    // Points morts : changements de signe du P/L à l'horizon
    const scanX = xs.concat([far]);
    const scanV = vs.concat([f(far)]);
    const eps = 1e-7;
    const breakevens = [];
    let prevX = null;
    let prevV = null;
    let zeroX = null;
    for (let i = 0; i < scanX.length; i++) {
      const x = scanX[i];
      const v = scanV[i];
      if (Math.abs(v) < eps) {
        if (zeroX === null) zeroX = x;
        continue;
      }
      if (prevV !== null && Math.sign(v) !== Math.sign(prevV)) {
        breakevens.push(zeroX !== null ? zeroX : bisect(f, prevX, x));
      }
      prevX = x;
      prevV = v;
      zeroX = null;
    }

    // Zones de profit et probabilité de profit (loi log-normale, VI de marché)
    const T = horizon / DAYS_PER_YEAR;
    const bounds = [0].concat(breakevens, [Infinity]);
    const profitZones = [];
    let pop = 0;
    for (let i = 0; i < bounds.length - 1; i++) {
      const a = bounds[i];
      const b = bounds[i + 1];
      const mid = b === Infinity ? Math.max(a * 1.25, mkt.spot * 1.5, a + 1) : 0.5 * (a + b);
      if (f(mid) > eps) {
        profitZones.push([a, b]);
        pop += probBelow(b, mkt.spot, T, mkt.iv, rate) - probBelow(a, mkt.spot, T, mkt.iv, rate);
      }
    }

    return {
      horizon,
      cost: positionCost(priced),
      maxProfit,
      maxLoss,
      maxProfitRegion,
      maxLossRegion,
      breakevens,
      profitZones,
      pop: Math.min(Math.max(pop, 0), 1),
      expectedMove: mkt.spot * mkt.iv * Math.sqrt(T),
    };
  }

  // ---------- Symbole OCC (ex. AAPL  261120C00305000) ----------
  function occSymbol(ticker, date, kind, strike) {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const cp = kind === "call" ? "C" : "P";
    const k = String(Math.round(strike * 1000)).padStart(8, "0");
    return (ticker || "XYZ").toUpperCase().slice(0, 6).padEnd(6, " ") + yy + mm + dd + cp + k;
  }

  // ---------- Catalogue de stratégies ----------
  // ctx : { atm, step, move } ; up(m)/dn(m) = strike à m écarts-types de l'ATM (au moins 1 pas)
  function strikeHelpers(ctx) {
    const n = (m) => Math.max(1, Math.round((m * ctx.move) / ctx.step));
    return {
      atm: ctx.atm,
      up: (m, minSteps) => ctx.atm + Math.max(n(m), minSteps || 1) * ctx.step,
      dn: (m, minSteps) => Math.max(ctx.step, ctx.atm - Math.max(n(m), minSteps || 1) * ctx.step),
      n,
    };
  }
  const C = (side, strike, qty, exp) => ({ kind: "call", side, qty: qty || 1, strike, exp: exp || "near" });
  const P = (side, strike, qty, exp) => ({ kind: "put", side, qty: qty || 1, strike, exp: exp || "near" });
  const STOCK = (qty) => ({ kind: "stock", side: 1, qty: qty || 100, strike: 0, exp: "near" });

  const STRATEGIES = [
    {
      key: "long-call",
      name: "Long Call",
      fr: "Achat de call",
      outlook: "haussier",
      build: (h) => [C(1, h.atm)],
      idea: "Vous payez une prime pour le droit d'acheter l'action au strike. Gain illimité si le cours monte, perte limitée à la prime.",
      when: "Anticipation de hausse franche avant l'échéance, de préférence quand la volatilité implicite est basse.",
    },
    {
      key: "long-put",
      name: "Long Put",
      fr: "Achat de put",
      outlook: "baissier",
      build: (h) => [P(1, h.atm)],
      idea: "Vous payez une prime pour le droit de vendre l'action au strike. Vous gagnez si le cours chute sous le point mort.",
      when: "Anticipation de baisse, ou assurance d'un portefeuille. Perte limitée à la prime.",
    },
    {
      key: "short-put",
      name: "Cash-Secured Put",
      fr: "Vente de put",
      outlook: "haussier",
      build: (h) => [P(-1, h.dn(0.35))],
      idea: "Vous encaissez la prime en échange de l'obligation d'acheter l'action au strike si on vous l'assigne.",
      when: "Vision neutre à haussière, ou envie d'acheter l'action moins cher. Le risque reste important si l'action s'effondre.",
    },
    {
      key: "short-call",
      name: "Short Call",
      fr: "Vente de call nue",
      outlook: "baissier",
      build: (h) => [C(-1, h.up(0.35))],
      idea: "Vous encaissez la prime mais devez livrer l'action au strike si elle monte. Risque théoriquement illimité.",
      when: "Réservé aux comptes avancés : vision neutre à baissière. On lui préfère souvent le bear call spread.",
    },
    {
      key: "bull-call-spread",
      name: "Bull Call Spread",
      fr: "Spread haussier en calls",
      outlook: "haussier",
      build: (h) => [C(1, h.atm), C(-1, h.up(0.6))],
      idea: "Achat d'un call et vente d'un call de strike plus élevé. La vente réduit le coût mais plafonne le gain.",
      when: "Hausse modérée attendue jusqu'au strike vendu. Risque et gain définis à l'avance.",
    },
    {
      key: "bull-put-spread",
      name: "Bull Put Spread",
      fr: "Spread haussier en puts",
      outlook: "haussier",
      build: (h) => [P(-1, h.dn(0.3)), P(1, h.dn(0.9, h.n(0.3) + 1))],
      idea: "Vente d'un put et achat d'un put plus bas en protection. Vous encaissez un crédit et gagnez si le cours reste au-dessus du strike vendu.",
      when: "Vision neutre à haussière. Le temps joue pour vous (theta positif).",
    },
    {
      key: "bear-put-spread",
      name: "Bear Put Spread",
      fr: "Spread baissier en puts",
      outlook: "baissier",
      build: (h) => [P(1, h.atm), P(-1, h.dn(0.6))],
      idea: "Achat d'un put et vente d'un put de strike plus bas. Moins cher qu'un put seul, gain plafonné.",
      when: "Baisse modérée attendue jusqu'au strike vendu.",
    },
    {
      key: "bear-call-spread",
      name: "Bear Call Spread",
      fr: "Spread baissier en calls",
      outlook: "baissier",
      build: (h) => [C(-1, h.up(0.3)), C(1, h.up(0.9, h.n(0.3) + 1))],
      idea: "Vente d'un call et achat d'un call plus haut en protection. Crédit encaissé, gagnant si le cours reste sous le strike vendu.",
      when: "Vision neutre à baissière, avec un risque défini.",
    },
    {
      key: "long-straddle",
      name: "Long Straddle",
      fr: "Achat de straddle",
      outlook: "volatilite",
      build: (h) => [C(1, h.atm), P(1, h.atm)],
      idea: "Achat d'un call et d'un put au même strike. Vous gagnez si le cours bouge fortement, dans un sens ou dans l'autre.",
      when: "Avant un événement (résultats, banque centrale) quand vous attendez un grand mouvement sans en connaître le sens.",
    },
    {
      key: "long-strangle",
      name: "Long Strangle",
      fr: "Achat de strangle",
      outlook: "volatilite",
      build: (h) => [P(1, h.dn(0.5)), C(1, h.up(0.5))],
      idea: "Achat d'un put et d'un call hors de la monnaie. Moins cher que le straddle, mais il faut un mouvement plus grand.",
      when: "Pari sur une forte hausse de volatilité réalisée.",
    },
    {
      key: "short-straddle",
      name: "Short Straddle",
      fr: "Vente de straddle",
      outlook: "neutre",
      build: (h) => [C(-1, h.atm), P(-1, h.atm)],
      idea: "Vente d'un call et d'un put au même strike. Gain maximal si le cours termine pile au strike. Risque illimité.",
      when: "Vision très neutre et volatilité implicite élevée. Stratégie avancée.",
    },
    {
      key: "short-strangle",
      name: "Short Strangle",
      fr: "Vente de strangle",
      outlook: "neutre",
      build: (h) => [P(-1, h.dn(0.6)), C(-1, h.up(0.6))],
      idea: "Vente d'un put et d'un call hors de la monnaie. Zone de profit large, mais risque illimité au-delà.",
      when: "Marché en range avec une VI élevée. Stratégie avancée.",
    },
    {
      key: "iron-condor",
      name: "Iron Condor",
      fr: "Iron condor",
      outlook: "neutre",
      build: (h) => [
        P(1, h.dn(1.2, h.n(0.6) + 1)),
        P(-1, h.dn(0.6)),
        C(-1, h.up(0.6)),
        C(1, h.up(1.2, h.n(0.6) + 1)),
      ],
      idea: "Un bull put spread et un bear call spread combinés. Crédit encaissé, gain si le cours reste entre les deux strikes vendus.",
      when: "Range attendu, VI élevée. Risque défini des deux côtés.",
    },
    {
      key: "iron-butterfly",
      name: "Iron Butterfly",
      fr: "Iron butterfly",
      outlook: "neutre",
      build: (h) => [P(1, h.dn(0.9)), P(-1, h.atm), C(-1, h.atm), C(1, h.up(0.9))],
      idea: "Short straddle protégé par l'achat d'ailes. Crédit plus important que l'iron condor, zone de profit plus étroite.",
      when: "Vous visez une immobilité du cours autour du strike central.",
    },
    {
      key: "long-call-butterfly",
      name: "Long Call Butterfly",
      fr: "Papillon en calls",
      outlook: "neutre",
      build: (h) => [C(1, h.dn(0.6)), C(-1, h.atm, 2), C(1, h.up(0.6))],
      idea: "Achat d'un call bas, vente de deux calls au centre, achat d'un call haut. Petit débit, gain maximal au strike central.",
      when: "Vous avez une cible de prix précise pour l'échéance.",
    },
    {
      key: "call-calendar",
      name: "Calendar Spread",
      fr: "Calendaire en calls",
      outlook: "neutre",
      build: (h) => [C(-1, h.atm, 1, "near"), C(1, h.atm, 1, "far")],
      idea: "Vente d'un call proche et achat du même call sur une échéance lointaine. Vous profitez de l'érosion plus rapide de l'option courte.",
      when: "Cours stable à court terme. La jambe lointaine garde de la valeur temps à la première échéance (P/L estimé par le modèle).",
    },
    {
      key: "covered-call",
      name: "Covered Call",
      fr: "Call couvert",
      outlook: "actions",
      build: (h) => [STOCK(100), C(-1, h.up(0.5))],
      idea: "Vous détenez 100 actions et vendez un call. La prime est un revenu, mais le gain est plafonné au strike.",
      when: "Vision neutre à légèrement haussière sur une action que vous possédez déjà.",
    },
    {
      key: "protective-put",
      name: "Protective Put",
      fr: "Put de protection",
      outlook: "actions",
      build: (h) => [STOCK(100), P(1, h.dn(0.5))],
      idea: "Vous détenez 100 actions et achetez un put : c'est une assurance qui plafonne votre perte.",
      when: "Vous voulez garder l'action tout en vous protégeant d'une forte baisse.",
    },
    {
      key: "collar",
      name: "Collar",
      fr: "Tunnel (collar)",
      outlook: "actions",
      build: (h) => [STOCK(100), P(1, h.dn(0.6)), C(-1, h.up(0.6))],
      idea: "Actions + put acheté + call vendu. La prime du call finance l'assurance du put : perte et gain sont encadrés.",
      when: "Protéger une plus-value à faible coût en renonçant à une partie de la hausse.",
    },
  ];

  function getStrategy(key) {
    return STRATEGIES.find((s) => s.key === key) || null;
  }

  // Renvoie les jambes (avec exp 'near'/'far') d'une stratégie pour un marché donné
  function buildStrategy(key, ctx) {
    const s = getStrategy(key);
    if (!s) return [];
    const legs = s.build(strikeHelpers(ctx));
    return legs.map((l) => Object.assign({ premium: null }, l));
  }

  function strategyContext(spot, iv, dte) {
    const step = strikeStep(spot);
    return {
      step,
      atm: Math.max(step, roundToStep(spot, step)),
      move: spot * iv * Math.sqrt(Math.max(dte, 1) / DAYS_PER_YEAR),
    };
  }

  return {
    DAYS_PER_YEAR,
    CONTRACT_SIZE,
    normPdf,
    normCdf,
    intrinsic,
    bsPrice,
    bsGreeks,
    impliedVol,
    strikeStep,
    roundToStep,
    legSize,
    priceLegs,
    positionCost,
    positionValue,
    positionPL,
    positionGreeks,
    horizonDays,
    probBelow,
    lognormalPdf,
    analyzePosition,
    occSymbol,
    STRATEGIES,
    getStrategy,
    buildStrategy,
    strategyContext,
  };
});
