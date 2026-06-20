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

  function add(map, key, w) { map[key] = (map[key] || 0) + w; }
  function topN(map, n) {
    return Object.keys(map).map(function (k) { return { name: k, score: map[k] }; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, n);
  }

  /*
   * chart   : core.buildChart output
   * dasha   : dasha.compute output (md/ad/pd)
   * maraka  : { d22Lord, n64Lord }
   */
  function forecast(chart, dasha, maraka) {
    var dusthana = [6, 8, 12];

    // Contributing planets with base weights by role.
    var roles = [
      { planet: dasha.md.lord, role: "Maha Dasha lord", weight: 3.0 },
      { planet: dasha.ad.lord, role: "Antar Dasha lord", weight: 2.2 },
      { planet: dasha.pd.lord, role: "Pratyantar Dasha lord", weight: 1.6 },
      { planet: maraka.n64Lord, role: "64th Navamsa lord (maraka)", weight: 2.0 },
      { planet: maraka.d22Lord, role: "22nd Drekkana lord (maraka)", weight: 2.0 }
    ];

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

  var api = { forecast: forecast };
  root.AHS = root.AHS || {};
  root.AHS.predict = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
