/*
 * predict.js
 * Synthesises every layer of the analysis into a single forecast for the
 * CURRENT Vimshottari period, then pinpoints the most vulnerable body part(s)
 * and the most probable health issue(s).
 *
 * Inputs combined:
 *   - Current Maha / Antar / Pratyantar dasha lords (timing & trigger)
 *   - 64th Navamsa lord and 22nd Drekkana lord (Khara / maraka indicators)
 *   - Natal placement, dignity and dusthana (6/8/12) involvement of each lord
 *   - KP significator status for the disease houses (6/8/12)
 *   - Karaka body parts (planet) + Kalapurusha body parts (sign occupied)
 *
 * Works in browser (window.AHS.predict) and Node.
 */
(function (root) {
  "use strict";

  var core = (typeof require !== "undefined") ? require("./astro-core.js") : root.AHS.core;
  var data = (typeof require !== "undefined") ? require("./data.js") : root.AHS.data;
  var kp = (typeof require !== "undefined") ? require("./kp.js") : root.AHS.kp;
  var parashara = (typeof require !== "undefined") ? require("./parashara.js") : root.AHS.parashara;
  var dasha = (typeof require !== "undefined") ? require("./dasha.js") : root.AHS.dasha;

  function add(map, key, w) { map[key] = (map[key] || 0) + w; }
  function topN(map, n) {
    return Object.keys(map).map(function (k) { return { name: k, score: map[k] }; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, n);
  }

  /*
   * chart   : core.buildChart output
   * dasha   : dasha.compute output (md/ad/pd)
   * maraka  : { d22Lord, n64Lord }
   * extra   : optional { d6 } -- varga.buildD6 output, to fold in D6 disease houses
   */
  function forecast(chart, dasha, maraka, extra) {
    var dusthana = [6, 8, 12];

    // Contributing planets with base weights by role.
    var roles = [
      { planet: dasha.md.lord, role: "Maha Dasha lord", weight: 3.0 },
      { planet: dasha.ad.lord, role: "Antar Dasha lord", weight: 2.2 },
      { planet: dasha.pd.lord, role: "Pratyantar Dasha lord", weight: 1.6 },
      { planet: maraka.n64Lord, role: "64th Navamsa lord (maraka)", weight: 2.0 },
      { planet: maraka.d22Lord, role: "22nd Drekkana lord (maraka)", weight: 2.0 }
    ];

    // Fold in D6 (health-chart) disease-house occupants, if provided.
    if (extra && extra.d6) {
      ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"].forEach(function (p) {
        var h = extra.d6.planets[p].house;
        if (h === 6) roles.push({ planet: p, role: "in D6 6th (disease)", weight: 1.3 });
        else if (h === 8) roles.push({ planet: p, role: "in D6 8th (crisis)", weight: 1.1 });
      });
    }

    // Merge duplicate planets, summing weights and collecting roles.
    var byPlanet = {};
    roles.forEach(function (r) {
      if (!byPlanet[r.planet]) byPlanet[r.planet] = { planet: r.planet, weight: 0, roles: [], notes: [] };
      byPlanet[r.planet].weight += r.weight;
      byPlanet[r.planet].roles.push(r.role);
    });

    var bodyVotes = {};
    var ailmentVotes = {};
    var reasoning = [];
    var riskScore = 0;

    Object.keys(byPlanet).forEach(function (pname) {
      var c = byPlanet[pname];
      if (pname === "Rahu" || pname === "Ketu") {
        // nodes have no body of their own sign-rulership; still carry ailments
      }
      var pl = chart.planets[pname];
      var signIndex = pl ? pl.signIndex : null;
      var w = c.weight;

      // --- amplifiers ---
      var amp = 1.0;
      // KP: significator of disease houses 6/8/12?
      var sig = kp.planetSignifications(chart, pname);
      var disHouses = dusthana.filter(function (h) { return sig.all.indexOf(h) >= 0; });
      if (disHouses.length) {
        amp += 0.5;
        c.notes.push("KP significator of disease house(s) " + disHouses.join(", "));
        riskScore += 1.2 * c.roles.length;
      }
      // whole-sign dusthana placement
      if (pl && dusthana.indexOf(pl.wholeSignHouse) >= 0) {
        amp += 0.4;
        c.notes.push("placed in dusthana house " + pl.wholeSignHouse);
        riskScore += 1.0;
      }
      // dignity
      var dig = pl ? parashara.dignityOf(pname, signIndex) : "neutral";
      if (dig === "debilitated") { amp += 0.4; c.notes.push("debilitated in " + core.SIGNS[signIndex]); riskScore += 1.0; }
      else if (dig === "exalted" || dig === "own sign") { amp -= 0.15; c.notes.push("dignified (" + dig + "), partly protective"); }
      // maraka convergence (lord serves a dasha role AND a maraka role)
      var isDashaRole = c.roles.some(function (r) { return /Dasha/.test(r); });
      var isMarakaRole = c.roles.some(function (r) { return /maraka/.test(r); });
      if (isDashaRole && isMarakaRole) {
        amp += 0.6;
        c.notes.push("running-period lord coincides with a maraka point \u2014 heightened sensitivity");
        riskScore += 2.0;
      }

      // Shadbala: a weak/combust period lord is less able to protect; strong is resilient
      if (extra && extra.shadbala && extra.shadbala[pname]) {
        var sbp = extra.shadbala[pname];
        if (sbp.weak) { amp += 0.4; c.notes.push("weak in Shadbala (" + sbp.rupas + " Rupas)"); riskScore += 1.0; }
        else if (sbp.strong) { amp -= 0.2; c.notes.push("strong in Shadbala \u2014 resilient"); }
        if (sbp.combust) { amp += 0.3; c.notes.push("combust"); riskScore += 0.5; }
        if (sbp.retro) c.notes.push("retrograde");
      }

      c.effectiveWeight = w * amp;
      // --- distribute to body parts & ailments ---
      // Planetary karaka body parts lead (organ-specific); the occupied sign's
      // Kalapurusha parts are secondary (general bodily region).
      var parts = (data.PLANET_BODY[pname] || []);
      parts.forEach(function (b, i) {
        var f = i === 0 ? 1.4 : i < 3 ? 1.0 : 0.5;
        add(bodyVotes, b, c.effectiveWeight * f);
      });
      if (signIndex !== null) {
        (data.SIGN_BODY[signIndex] || []).forEach(function (b) { add(bodyVotes, b, c.effectiveWeight * 0.5); });
      }
      (data.PLANET_AILMENTS[pname] || []).forEach(function (a, i) { add(ailmentVotes, a, c.effectiveWeight * (i < 3 ? 1 : 0.5)); });
    });

    // Build contributor list (sorted by effective weight)
    var contributors = Object.keys(byPlanet).map(function (k) { return byPlanet[k]; })
      .sort(function (a, b) { return b.effectiveWeight - a.effectiveWeight; });

    var weakestParts = topN(bodyVotes, 4);
    var probableIssues = topN(ailmentVotes, 4);

    // Risk band
    var riskLevel, riskClass;
    if (riskScore >= 6) { riskLevel = "Elevated"; riskClass = "high"; }
    else if (riskScore >= 3) { riskLevel = "Moderate"; riskClass = "moderate"; }
    else { riskLevel = "Lower"; riskClass = "low"; }

    // Reasoning narrative
    reasoning.push("Current period: " + dasha.md.lord + " Maha Dasha \u2192 " +
      dasha.ad.lord + " Antar Dasha \u2192 " + dasha.pd.lord + " Pratyantar Dasha.");
    contributors.slice(0, 3).forEach(function (c) {
      var pl = chart.planets[c.planet];
      reasoning.push(c.planet + " (" + c.roles.join("; ") + ")" +
        (pl ? " in " + pl.sign + ", house " + pl.wholeSignHouse : "") +
        (c.notes.length ? " \u2014 " + c.notes.join("; ") : "") + ".");
    });

    var primary = weakestParts[0] ? weakestParts[0].name : "general vitality";
    var primaryIssue = probableIssues[0] ? probableIssues[0].name : "general low energy";

    var verdict = "During the current " + dasha.md.lord + "\u2013" + dasha.ad.lord + "\u2013" +
      dasha.pd.lord + " period, the body area most likely to need attention is the " +
      "<strong>" + primary + "</strong>" +
      (weakestParts[1] ? " (also: " + weakestParts[1].name + ")" : "") +
      ", with the most probable concern being <strong>" + primaryIssue + "</strong>. " +
      "Overall health risk for this period reads as <strong>" + riskLevel + "</strong>.";

    return {
      period: {
        md: dasha.md, ad: dasha.ad, pd: dasha.pd,
        label: dasha.md.lord + " / " + dasha.ad.lord + " / " + dasha.pd.lord
      },
      riskLevel: riskLevel,
      riskClass: riskClass,
      riskScore: Math.round(riskScore * 10) / 10,
      weakestParts: weakestParts,
      probableIssues: probableIssues,
      contributors: contributors,
      reasoning: reasoning,
      verdict: verdict
    };
  }

  // ---- Forward-looking Parashara dasha schedule (upcoming MD/AD/PD) ----
  function lordHealth(chart, lord, maraka) {
    var hl = parashara.houseLords(chart.lagnaSignIndex);
    var owns = hl.lordToHouses[lord] || [];
    var occ = chart.planets[lord].wholeSignHouse;
    var dig = parashara.dignityOf(lord, chart.planets[lord].signIndex);
    var dus = [6, 8, 12], adv = 0, sup = 0, notes = [];
    if (dus.indexOf(occ) >= 0) { adv += 2; notes.push("placed in " + occ + "th"); }
    var ownDus = owns.filter(function (h) { return dus.indexOf(h) >= 0; });
    if (ownDus.length) { adv += ownDus.length; notes.push("lord of " + ownDus.join("/")); }
    if (lord === maraka.d22Lord) { adv += 2; notes.push("22nd-Drekkana maraka"); }
    if (lord === maraka.n64Lord) { adv += 2; notes.push("64th-Navamsa maraka"); }
    var ownMar = owns.filter(function (h) { return h === 2 || h === 7; });
    if (ownMar.length) { adv += 1; notes.push("maraka-house (" + ownMar.join("/") + ") lord"); }
    if (dig === "debilitated") { adv += 1; notes.push("debilitated"); }
    var good = [1, 4, 5, 9, 10];
    if (good.indexOf(occ) >= 0) sup += 1;
    if (owns.filter(function (h) { return [1, 5, 9].indexOf(h) >= 0; }).length) sup += 1;
    if (dig === "exalted" || dig === "own sign") { sup += 1; notes.push(dig); }
    if (data.NATURE[lord] === "benefic") sup += 0.5;

    var klass, label;
    if (adv >= 3 && adv > sup) { klass = "high"; label = "Adverse"; }
    else if (adv >= 1.5 && adv >= sup) { klass = "moderate"; label = "Caution"; }
    else if (sup > adv) { klass = "low"; label = "Supportive"; }
    else { klass = "low"; label = "Neutral"; }
    return { owns: owns, occ: occ, adv: adv, sup: sup, klass: klass, label: label, basis: notes.join("; ") || ("in " + occ + "th") };
  }

  function jointHealth(chart, lords, maraka) {
    var a = 0, s = 0, notes = [], seen = {};
    lords.forEach(function (l) {
      var h = lordHealth(chart, l, maraka); a += h.adv; s += h.sup;
      if (h.basis && !seen[l]) { notes.push(l + ": " + h.basis); seen[l] = 1; }
    });
    var klass, label;
    if (a >= 4 && a > s) { klass = "high"; label = "Adverse"; }
    else if (a >= 2 && a >= s) { klass = "moderate"; label = "Caution"; }
    else if (s > a) { klass = "low"; label = "Supportive"; }
    else { klass = "low"; label = "Neutral"; }
    return { klass: klass, label: label, basis: notes.join(" \u00b7 ") };
  }

  /*
   * schedule(chart, timeline, maraka, nowMs)
   * Parashara health classification of upcoming MD / AD / PD periods.
   */
  function schedule(chart, timeline, maraka, nowMs) {
    if (nowMs === undefined) nowMs = Date.now();
    var YEAR = 365.25 * 86400000;

    var mds = timeline.mds.filter(function (m) { return m.endMs > nowMs; }).map(function (m) {
      var h = lordHealth(chart, m.lord, maraka);
      return { lord: m.lord, startMs: m.startMs, endMs: m.endMs, basis: h.basis, klass: h.klass, label: h.label, current: nowMs >= m.startMs && nowMs < m.endMs };
    });

    var ads = timeline.ads.filter(function (a) { return a.endMs > nowMs && a.startMs < nowMs + 40 * YEAR; }).map(function (a) {
      var j = jointHealth(chart, [a.mdLord, a.lord], maraka);
      return { mdLord: a.mdLord, lord: a.lord, startMs: a.startMs, endMs: a.endMs, basis: j.basis, klass: j.klass, label: j.label, current: nowMs >= a.startMs && nowMs < a.endMs };
    });

    var sorted = timeline.ads.slice().sort(function (x, y) { return x.startMs - y.startMs; });
    var idx = 0;
    for (var i = 0; i < sorted.length; i++) { if (nowMs >= sorted[i].startMs && nowMs < sorted[i].endMs) { idx = i; break; } }
    var pds = [];
    [idx, idx + 1].forEach(function (k) {
      var ad = sorted[k]; if (!ad) return;
      dasha.subPeriods(ad.lord, ad.startMs, ad.endMs - ad.startMs).forEach(function (pd) {
        if (pd.endMs < nowMs) return;
        var j = jointHealth(chart, [ad.mdLord, ad.lord, pd.lord], maraka);
        pds.push({ mdLord: ad.mdLord, adLord: ad.lord, lord: pd.lord, startMs: pd.startMs, endMs: pd.endMs, klass: j.klass, label: j.label, current: nowMs >= pd.startMs && nowMs < pd.endMs });
      });
    });

    var sensitive = ads.filter(function (a) { return a.klass === "high" && a.startMs < nowMs + 30 * YEAR; }).slice(0, 8);
    return { mds: mds, ads: ads, pds: pds, sensitive: sensitive };
  }

  var api = { forecast: forecast, schedule: schedule };
  root.AHS = root.AHS || {};
  root.AHS.predict = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
