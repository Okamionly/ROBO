// Tests du moteur du Labo Options : node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../options_engine.js");

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} attendu ${b}, obtenu ${a}`);

test("Black-Scholes : valeurs de référence (Hull)", () => {
  // S=42, K=40, r=10 %, sigma=20 %, T=0,5 an → call 4,76, put 0,81
  close(E.bsPrice("call", 42, 40, 0.5, 0.2, 0.1), 4.76, 0.01, "call");
  close(E.bsPrice("put", 42, 40, 0.5, 0.2, 0.1), 0.81, 0.01, "put");
});

test("parité call-put", () => {
  const S = 306.38, K = 305, T = 32 / 365, v = 0.264, r = 0.04;
  const lhs = E.bsPrice("call", S, K, T, v, r) - E.bsPrice("put", S, K, T, v, r);
  close(lhs, S - K * Math.exp(-r * T), 1e-6, "C − P");
});

test("à l'échéance, une option vaut sa valeur intrinsèque", () => {
  assert.equal(E.bsPrice("call", 110, 100, 0, 0.3, 0.04), 10);
  assert.equal(E.bsPrice("put", 110, 100, 0, 0.3, 0.04), 0);
});

test("Grecques : delta d'un call ATM proche de 0,5 et theta négatif", () => {
  const g = E.bsGreeks("call", 100, 100, 30 / 365, 0.3, 0.04);
  assert.ok(g.delta > 0.5 && g.delta < 0.6);
  assert.ok(g.theta < 0);
  assert.ok(g.vega > 0 && g.gamma > 0);
  const p = E.bsGreeks("put", 100, 100, 30 / 365, 0.3, 0.04);
  close(g.delta - p.delta, 1, 1e-9, "delta call − delta put");
});

test("volatilité implicite : retrouve la vol d'origine", () => {
  const price = E.bsPrice("put", 95, 100, 0.25, 0.37, 0.03);
  close(E.impliedVol("put", price, 95, 100, 0.25, 0.03).iv, 0.37, 1e-6, "VI");
});

test("exemple de la capture : AAPL long call 305 à 32 jours", () => {
  const mkt = { spot: 306.38, iv: 0.264, rate: 0.04 };
  const legs = [{ kind: "call", side: 1, qty: 1, strike: 305, dte: 32, premium: 10.825 }];
  const a = E.analyzePosition(E.priceLegs(legs, mkt), mkt);
  close(a.cost, 1082.5, 1e-9, "débit net");
  close(a.maxLoss, -1082.5, 1e-6, "perte max");
  assert.equal(a.maxProfit, Infinity);
  assert.equal(a.breakevens.length, 1);
  close(a.breakevens[0], 315.825, 1e-6, "point mort");
  assert.equal(Math.round(a.pop * 100), 35);
});

const mkt = { spot: 100, iv: 0.3, rate: 0.04 };
function analyze(key) {
  const legs = E.buildStrategy(key, E.strategyContext(mkt.spot, mkt.iv, 30)).map((l) =>
    Object.assign(l, { dte: l.kind === "stock" ? 0 : l.exp === "far" ? 60 : 30 })
  );
  return { legs, a: E.analyzePosition(E.priceLegs(legs, mkt), mkt) };
}

test("bull call spread : gain + perte = largeur × 100", () => {
  const { legs, a } = analyze("bull-call-spread");
  const width = legs[1].strike - legs[0].strike;
  close(a.maxProfit - a.maxLoss, width * 100, 1e-6, "largeur");
  close(-a.maxLoss, a.cost, 1e-6, "perte max = débit");
});

test("iron condor : crédit, risque défini, deux points morts", () => {
  const { a } = analyze("iron-condor");
  assert.ok(a.cost < 0);
  assert.ok(isFinite(a.maxLoss) && isFinite(a.maxProfit));
  close(a.maxProfit, -a.cost, 1e-6, "gain max = crédit");
  assert.equal(a.breakevens.length, 2);
  assert.equal(a.profitZones.length, 1);
});

test("risques illimités détectés", () => {
  assert.equal(analyze("short-call").a.maxLoss, -Infinity);
  assert.equal(analyze("short-straddle").a.maxLoss, -Infinity);
  assert.equal(analyze("long-straddle").a.maxProfit, Infinity);
  assert.ok(isFinite(analyze("short-put").a.maxLoss));
});

test("covered call et vente de put de même strike : même profil à l'échéance", () => {
  const legsCC = [
    { kind: "stock", side: 1, qty: 100, strike: 0, dte: 0 },
    { kind: "call", side: -1, qty: 1, strike: 105, dte: 30 },
  ];
  const legsSP = [{ kind: "put", side: -1, qty: 1, strike: 105, dte: 30 }];
  const cc = E.priceLegs(legsCC, mkt);
  const sp = E.priceLegs(legsSP, mkt);
  const diff = (S) => E.positionPL(cc, S, 30, 1, mkt.rate) - E.positionPL(sp, S, 30, 1, mkt.rate);
  // L'écart est constant (intérêts sur le strike), le profil est identique
  close(diff(80), diff(120), 1e-6, "écart constant");
});

test("toutes les stratégies du catalogue se construisent et s'analysent", () => {
  E.STRATEGIES.forEach((s) => {
    const { legs, a } = analyze(s.key);
    assert.ok(legs.length > 0, s.key);
    assert.ok(a.pop >= 0 && a.pop <= 1, s.key);
    assert.ok(a.breakevens.every((b) => b > 0), s.key);
  });
});

test("symbole OCC", () => {
  assert.equal(E.occSymbol("AAPL", new Date(2026, 8, 4), "call", 305), "AAPL  260904C00305000");
  assert.equal(E.occSymbol("spy", new Date(2027, 0, 15), "put", 512.5), "SPY   270115P00512500");
});
