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
   * forecast(chart, dasha, maraka, extra)
   *
   * Model: the PROMISE of disease in the natal charts (D1 + KP + D6) is primary
   * and carries the most weight; it also determines the KIND of disease (body
   * parts / ailments). Dasha and transits are TRIGGERS (timing) and carry less
   * weight on their own. When a trigger activates a planet/area that is already
   * PROMISED, that is a CONFLUENCE and severity is escalated.
   *
   *   extra : { d6, shadbala, neechaCancelled, transit }
   */
  function forecast(chart, dasha, maraka, extra) {
    extra = extra || {};
    var GRAHAS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
    var dusthana = [6, 8, 12];
    var hl = parashara.houseLords(chart.lagnaSignIndex);

    // ---------------- 1. PROMISE (natal disease potential: D1 + KP + D6) -------
    var promise = {}; // planet -> { score, reasons:[] }
    function addP(planet, w, reason) {
      if (!promise[planet]) promise[planet] = { score: 0, reasons: [] };
      promise[planet].score += w;
      if (reason) promise[planet].reasons.push(reason);
    }
    GRAHAS.forEach(function (planet) {
      var pl = chart.planets[planet]; if (!pl) return;
      // KP (chart promise): significator of disease houses 6/8/12
      var sig = kp.planetSignifications(chart, planet);
      var dh = dusthana.filter(function (h) { return sig.all.indexOf(h) >= 0; });
      if (dh.length) addP(planet, dh.indexOf(6) >= 0 ? 2.0 : 1.3, "KP significator of disease house(s) " + dh.join(", "));
      // D1 Parashara promise: placed in a dusthana
      if (dusthana.indexOf(pl.wholeSignHouse) >= 0) addP(planet, 1.2, "placed in dusthana " + pl.wholeSignHouse + " (D1)");
      // D1 debilitation (only if NOT cancelled by Neecha Bhanga)
      var dig = parashara.dignityOf(planet, pl.signIndex);
      if (dig === "debilitated" && !(extra.neechaCancelled && extra.neechaCancelled.indexOf(planet) >= 0))
        addP(planet, 1.2, "debilitated, uncancelled (D1)");
      // D6 promise: in the health-chart disease houses
      if (extra.d6) {
        var h6 = extra.d6.planets[planet].house;
        if (h6 === 6) addP(planet, 1.3, "in D6 6th (disease)");
        else if (h6 === 8) addP(planet, 0.9, "in D6 8th (crisis)");
      }
      // maraka points (chart-level affliction promise)
      if (planet === maraka.d22Lord) addP(planet, 1.0, "22nd-Drekkana (maraka) lord");
      if (planet === maraka.n64Lord) addP(planet, 1.0, "64th-Navamsa (maraka) lord");
      // weak organ (Shadbala) deepens the promised vulnerability
      if (extra.shadbala && extra.shadbala[planet] && extra.shadbala[planet].weak)
        addP(planet, 0.6, "weak in Shadbala");
    });
    // Dusthana lordship (6th/8th lords promise their matters)
    addP(hl.houseToLord[6], 1.2, "lord of the 6th (disease)");
    addP(hl.houseToLord[8], 1.0, "lord of the 8th (chronic)");

    // ---------------- 2. TRIGGERS (timing: dasha + transit) --------------------
    var triggers = {}; // planet -> { weight, roles:[] }
    function addT(planet, w, role) {
      if (!triggers[planet]) triggers[planet] = { weight: 0, roles: [] };
      triggers[planet].weight += w; triggers[planet].roles.push(role);
    }
    addT(dasha.md.lord, 1.0, "Maha Dasha lord");
    addT(dasha.ad.lord, 0.8, "Antar Dasha lord");
    addT(dasha.pd.lord, 0.5, "Pratyantar Dasha lord");

    var transitNotes = [];
    if (extra.transit && extra.transit.planets) {
      var lagna = chart.lagnaSignIndex;
      ["Saturn", "Mars", "Rahu", "Ketu"].forEach(function (tp) {
        var ts = extra.transit.planets[tp]; if (!ts) return;
        var gh = ((ts.signIndex - lagna + 12) % 12) + 1;
        if ([1, 6, 8, 12].indexOf(gh) >= 0) { addT(tp, 0.5, "transiting natal " + gh + "th"); transitNotes.push(tp + " transiting natal " + gh + "th house"); }
      });
      var msign = chart.planets.Moon.signIndex, st = extra.transit.planets.Saturn;
      if (st) { var d = ((st.signIndex - msign + 12) % 12); if (d === 11 || d === 0 || d === 1) { addT("Saturn", 0.5, "Sade Sati"); transitNotes.push("Saturn in Sade Sati over the natal Moon"); } }
    }

    // ---------------- 3. CONFLUENCE (trigger activates a promise) ---------------
    var confluence = Object.keys(triggers).filter(function (pl) { return promise[pl] && promise[pl].score > 0; });

    // ---------------- 4. KIND OF DISEASE (body parts / ailments) ---------------
    // Dominated by PROMISE (the charts); triggers contribute only a little.
    var PROMISE_W = 1.0, TRIGGER_ONLY_W = 0.4, CONFLUENCE_MULT = 1.6;
    var bodyVotes = {}, ailmentVotes = {};
    function distribute(planet, weight) {
      var pl = chart.planets[planet];
      (data.PLANET_BODY[planet] || []).slice(0, 3).forEach(function (b, i) { add(bodyVotes, b, weight * (i === 0 ? 1.4 : 1)); });
      if (pl) (data.SIGN_BODY[pl.signIndex] || []).slice(0, 2).forEach(function (b) { add(bodyVotes, b, weight * 0.5); });
      (data.PLANET_AILMENTS[planet] || []).slice(0, 3).forEach(function (a) { add(ailmentVotes, a, weight); });
    }
    Object.keys(promise).forEach(function (planet) {
      var ps = promise[planet].score; if (ps <= 0) return;
      var mult = confluence.indexOf(planet) >= 0 ? CONFLUENCE_MULT : 1.0;
      distribute(planet, ps * PROMISE_W * mult);
    });
    Object.keys(triggers).forEach(function (planet) {
      if (promise[planet] && promise[planet].score > 0) return; // counted via promise+confluence
      distribute(planet, triggers[planet].weight * TRIGGER_ONLY_W);
    });

    var weakestParts = topN(bodyVotes, 4);
    var probableIssues = topN(ailmentVotes, 4);

    // ---------------- 5. RISK (promise base, escalated by confluence) ----------
    var promiseMagnitude = 0;
    Object.keys(promise).forEach(function (pl) { promiseMagnitude += promise[pl].score; });
    var confluenceStrength = 0;
    confluence.forEach(function (pl) { confluenceStrength += promise[pl].score * triggers[pl].weight; });
    var triggerOnly = 0;
    Object.keys(triggers).forEach(function (pl) { if (confluence.indexOf(pl) < 0) triggerOnly += triggers[pl].weight; });

    // promise sets the floor; confluence multiplies; bare triggers add little.
    var riskScore = promiseMagnitude * 0.5 + confluenceStrength * 1.8 + triggerOnly * 0.3 + transitNotes.length * 0.4;

    var riskLevel, riskClass;
    if (riskScore >= 9) { riskLevel = "Elevated"; riskClass = "high"; }
    else if (riskScore >= 5) { riskLevel = "Moderate"; riskClass = "moderate"; }
    else { riskLevel = "Lower"; riskClass = "low"; }

    // ---------------- 6. Contributor list (promise + trigger + confluence) -----
    var allPlanets = {};
    Object.keys(promise).forEach(function (p) { allPlanets[p] = true; });
    Object.keys(triggers).forEach(function (p) { allPlanets[p] = true; });
    var contributors = Object.keys(allPlanets).map(function (p) {
      var ps = promise[p] ? promise[p].score : 0;
      var tw = triggers[p] ? triggers[p].weight : 0;
      var isConf = confluence.indexOf(p) >= 0;
      var roles = [];
      if (triggers[p]) roles = roles.concat(triggers[p].roles);
      var notes = (promise[p] ? promise[p].reasons.slice() : []);
      return {
        planet: p,
        promiseScore: Math.round(ps * 10) / 10,
        triggerWeight: Math.round(tw * 10) / 10,
        confluence: isConf,
        roles: roles,
        notes: notes,
        effectiveWeight: ps * (isConf ? CONFLUENCE_MULT : 1) + tw * (promise[p] ? 0 : TRIGGER_ONLY_W)
      };
    }).sort(function (a, b) { return b.effectiveWeight - a.effectiveWeight; });

    // ---------------- 7. Narrative ---------------------------------------------
    var reasoning = [];
    reasoning.push("Promise (natal D1 + KP + D6) carries the primary weight; the running " +
      dasha.md.lord + "\u2013" + dasha.ad.lord + "\u2013" + dasha.pd.lord + " dasha and current transits act as triggers.");
    var promisedTop = contributors.filter(function (c) { return c.promiseScore > 0; }).slice(0, 3);
    promisedTop.forEach(function (c) {
      reasoning.push("PROMISE \u2014 " + c.planet + ": " + c.notes.join("; ") +
        (c.confluence ? " [also a current trigger: " + c.roles.join(", ") + " \u2192 CONFLUENCE, severity raised]" : "") + ".");
    });
    if (transitNotes.length) reasoning.push("Transit triggers: " + transitNotes.join("; ") + ".");
    if (!confluence.length) reasoning.push("The current dasha/transit triggers do not strongly coincide with the promised afflictions, so timing pressure is comparatively low.");

    var primary = weakestParts[0] ? weakestParts[0].name : "general vitality";
    var primaryIssue = probableIssues[0] ? probableIssues[0].name : "general low energy";
    var verdict = "The natal charts (D1 / KP / D6) promise vulnerability chiefly in the <strong>" + primary + "</strong>" +
      (weakestParts[1] ? " (also " + weakestParts[1].name + ")" : "") +
      ", with the most probable concern being <strong>" + primaryIssue + "</strong>. " +
      (confluence.length
        ? "The current " + dasha.md.lord + "\u2013" + dasha.ad.lord + "\u2013" + dasha.pd.lord +
          " period " + (transitNotes.length ? "and transits " : "") + "<strong>act on</strong> this promise (" +
          confluence.join(", ") + "), so severity is heightened."
        : "The current period and transits do not strongly trigger this promise at present.") +
      " Overall risk: <strong>" + riskLevel + "</strong>.";

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
      confluence: confluence,
      transitNotes: transitNotes,
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
