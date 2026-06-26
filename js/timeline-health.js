/*
 * timeline-health.js
 * A 20-year health timeline at Pratyantar (3-level) granularity, scoring each
 * period independently under BOTH Parashara and KP, considering the 22nd
 * Drekkana and 64th Navamsa (maraka) lords. Produces table rows and the
 * vitality series for the graph.
 *
 * Method: a per-planet "disease weight" is precomputed once from the natal
 * charts (the PROMISE). A period's severity = level-weighted sum of its
 * Maha/Antar/Pratyantar lords' disease weights (the TRIGGER acting on the
 * promise). Higher disease weight running at multiple levels => higher severity.
 *
 * Works in browser (window.AHS.healthTimeline) and Node.
 */
(function (root) {
  "use strict";

  var R = (typeof require !== "undefined");
  var core = R ? require("./astro-core.js") : root.AHS.core;
  var data = R ? require("./data.js") : root.AHS.data;
  var parashara = R ? require("./parashara.js") : root.AHS.parashara;
  var kp = R ? require("./kp.js") : root.AHS.kp;
  var dasha = R ? require("./dasha.js") : root.AHS.dasha;

  var GRAHAS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
  var ABBR = { Sun: "Sun", Moon: "Moon", Mars: "Mars", Mercury: "Merc", Jupiter: "Jup", Venus: "Ven", Saturn: "Sat", Rahu: "Rahu", Ketu: "Ketu" };
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmt(ms) { var d = new Date(ms); return pad(d.getUTCDate()) + "/" + pad(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear(); }

  function band(score) {
    if (score >= 19) return { label: "Fatal", klass: "fatal" };
    if (score >= 13) return { label: "Adverse", klass: "adverse" };
    if (score >= 8) return { label: "High", klass: "high" };
    if (score >= 4) return { label: "Moderate", klass: "moderate" };
    return { label: "Low", klass: "low" };
  }

  /*
   * analyze(chart, opts)
   *   opts = { timeline, maraka:{d22Lord,n64Lord}, neechaCancelled, accidentProne, nowMs, years }
   */
  function analyze(chart, opts) {
    opts = opts || {};
    var maraka = opts.maraka || {};
    var cancelled = opts.neechaCancelled || [];
    var hl = parashara.houseLords(chart.lagnaSignIndex);
    var owns = {};
    for (var h = 1; h <= 12; h++) { var L = hl.houseToLord[h]; (owns[L] = owns[L] || []).push(h); }

    // ---- precompute per-planet disease weights (the natal PROMISE) ----
    var pW = {}, kW = {};
    GRAHAS.forEach(function (p) {
      var pl = chart.planets[p];
      var hp = pl.wholeSignHouse;
      // Parashara
      var pw = 0;
      if (hp === 8) pw += 2.5; else if (hp === 6) pw += 2.0; else if (hp === 12) pw += 1.5;
      (owns[p] || []).forEach(function (hh) {
        if (hh === 6) pw += 1.5; else if (hh === 8) pw += 1.5; else if (hh === 12) pw += 1.0;
        else if (hh === 2 || hh === 7) pw += 1.2;
      });
      var dig = parashara.dignityOf(p, pl.signIndex);
      if (dig === "debilitated" && cancelled.indexOf(p) < 0) pw += 1.5;
      if (data.NATURE[p] === "malefic") {
        pw += 0.5;
        if (hp === 1 || parashara.aspectsFrom(p, hp).indexOf(1) >= 0) pw += 0.8;
      }
      if (p === maraka.d22Lord) pw += 1.5;
      if (p === maraka.n64Lord) pw += 1.5;
      pW[p] = pw;
      // KP -- use PRIMARY (star-lord) significations as the strong signal,
      // with secondary (occupation/ownership) significations counting less.
      var sig = kp.planetSignifications(chart, p);
      var strong = sig.strong, all = sig.all;
      var kw = 0;
      if (strong.indexOf(6) >= 0) kw += 2.5; else if (all.indexOf(6) >= 0) kw += 1.0;
      if (strong.indexOf(8) >= 0) kw += 1.8; else if (all.indexOf(8) >= 0) kw += 0.6;
      if (strong.indexOf(12) >= 0) kw += 1.2; else if (all.indexOf(12) >= 0) kw += 0.4;
      if (strong.indexOf(1) >= 0 || strong.indexOf(5) >= 0 || strong.indexOf(11) >= 0) kw -= 1.0;
      if (p === maraka.d22Lord) kw += 1.5;
      if (p === maraka.n64Lord) kw += 1.5;
      kW[p] = Math.max(0, kw);
    });

    // maraka lords gate "Fatal": only periods whose MD or AD lord is a maraka
    // (2nd/7th/8th lord or a Khara point) may reach the Fatal band.
    var marakaLords = uniq([maraka.d22Lord, maraka.n64Lord, hl.houseToLord[2], hl.houseToLord[7], hl.houseToLord[8]]);
    function gated(b, md, ad) {
      if (b.label === "Fatal" && marakaLords.indexOf(md) < 0 && marakaLords.indexOf(ad) < 0)
        return { label: "Adverse", klass: "adverse" };
      return b;
    }

    function sev(W, md, ad, pd) { return 3 * (W[md] || 0) + 2 * (W[ad] || 0) + 1 * (W[pd] || 0); }

    function areaOf(md, ad, pd) {
      var parts = (data.PLANET_BODY[md] || []).slice(0, 2)
        .concat((data.PLANET_BODY[ad] || []).slice(0, 1));
      parts = uniq(parts).slice(0, 3);
      var tags = [];
      if (opts.accidentProne && [md, ad, pd].some(function (l) { return ["Mars", "Rahu", "Ketu"].indexOf(l) >= 0; }))
        tags.push("accident risk");
      if ([md, ad].some(function (l) { return l === "Moon" || l === "Mercury"; }))
        tags.push("mind/emotions");
      return parts.join(", ") + (tags.length ? " [" + tags.join(", ") + "]" : "");
    }

    // ---- build Pratyantar rows over the window (raw scores first) ----
    var now = opts.nowMs || Date.now();
    var years = opts.years || 20;
    var endWin = now + years * 365.25 * 86400000;
    var rows = [];
    (opts.timeline.ads || []).forEach(function (ad) {
      if (ad.endMs <= now || ad.startMs >= endWin) return;
      dasha.subPeriods(ad.lord, ad.startMs, ad.endMs - ad.startMs).forEach(function (pd) {
        if (pd.endMs <= now || pd.startMs >= endWin) return;
        var md = ad.mdLord, adl = ad.lord, pdl = pd.lord;
        rows.push({
          md: md, ad: adl, pd: pdl,
          label: ABBR[md] + " - " + ABBR[adl] + " - " + ABBR[pdl],
          startMs: pd.startMs, endMs: pd.endMs,
          range: fmt(Math.max(pd.startMs, now)) + " - " + fmt(pd.endMs),
          area: areaOf(md, adl, pdl),
          parScore: Math.round(sev(pW, md, adl, pdl) * 10) / 10,
          kpScore: Math.round(sev(kW, md, adl, pdl) * 10) / 10,
          midMs: (Math.max(pd.startMs, now) + pd.endMs) / 2,
          current: now >= pd.startMs && now < pd.endMs
        });
      });
    });
    rows.sort(function (a, b) { return a.startMs - b.startMs; });

    // ---- normalise per chart (relative severity within the 20-year window) ----
    var maxPar = 0.001, maxKp = 0.001;
    rows.forEach(function (r) { if (r.parScore > maxPar) maxPar = r.parScore; if (r.kpScore > maxKp) maxKp = r.kpScore; });
    function bandPct(pct) {
      if (pct >= 0.85) return { label: "Fatal", klass: "fatal" };
      if (pct >= 0.68) return { label: "Adverse", klass: "adverse" };
      if (pct >= 0.50) return { label: "High", klass: "high" };
      if (pct >= 0.30) return { label: "Moderate", klass: "moderate" };
      return { label: "Low", klass: "low" };
    }
    rows.forEach(function (r) {
      var pp = r.parScore / maxPar, kpp = r.kpScore / maxKp;
      r.par = gated(bandPct(pp), r.md, r.ad);
      r.kp = gated(bandPct(kpp), r.md, r.ad);
      r.parVit = clamp(Math.round(100 - pp * 92), 6, 100);
      r.kpVit = clamp(Math.round(100 - kpp * 92), 6, 100);
    });

    return { rows: rows, startMs: now, endMs: endWin, years: years };
  }

  var api = { analyze: analyze, fmt: fmt };
  root.AHS = root.AHS || {};
  root.AHS.healthTimeline = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
