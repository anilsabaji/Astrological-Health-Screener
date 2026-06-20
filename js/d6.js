/*
 * d6.js
 * Health analysis of the D6 Shashthamsa chart -- the divisional chart classically
 * dedicated to health, disease, recuperation, enemies and debts.
 *
 * Method (whole-sign within the D6 chart):
 *   - D6 Lagna & its lord  = constitution / vitality in the health chart
 *   - D6 6th house          = disease (the disease house OF the disease chart)
 *   - D6 8th / 12th         = chronic ailments, hospitalisation
 *   - Malefics on D6 1/6/8  = vulnerability; benefics on 1/6 = recuperation
 *   - Body parts via afflicting planet (karaka) + occupied D6 sign (Kalapurusha)
 *
 * Works in browser (window.AHS.d6) and Node.
 */
(function (root) {
  "use strict";

  var core = (typeof require !== "undefined") ? require("./astro-core.js") : root.AHS.core;
  var data = (typeof require !== "undefined") ? require("./data.js") : root.AHS.data;
  var parashara = (typeof require !== "undefined") ? require("./parashara.js") : root.AHS.parashara;

  var GRAHAS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
  function isMalefic(p) { return data.NATURE[p] === "malefic"; }
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  function bodyParts(planet, signIndex) {
    return uniq((data.PLANET_BODY[planet] || []).slice(0, 3)
      .concat((data.SIGN_BODY[signIndex] || []).slice(0, 2)));
  }

  // house -> planets and planet -> house from a D6 chart
  function maps(d6) {
    var hp = {}, ph = {};
    for (var i = 1; i <= 12; i++) hp[i] = [];
    GRAHAS.forEach(function (p) {
      var h = d6.planets[p].house;
      ph[p] = h; hp[h].push(p);
    });
    return { housePlanets: hp, planetHouse: ph };
  }

  /*
   * analyze(d6, originalChart)
   * d6 = varga.buildD6(chart); originalChart kept for lagna-lord dignity lookups.
   */
  function analyze(d6) {
    var lagna = d6.lagnaSignIndex;
    var hl = parashara.houseLords(lagna); // house->lord from D6 lagna
    var m = maps(d6);
    var findings = [];
    var supportive = [];
    var score = 70;
    var dusthana = [6, 8, 12];

    // ---- D6 Lagna lord ----
    var lord = hl.houseToLord[1];
    var lordHouse = m.planetHouse[lord];
    var lordSign = d6.planets[lord].signIndex;
    var dig = parashara.dignityOf(lord, lordSign);
    var note = "D6 Lagna lord " + lord + " is in D6 house " + lordHouse + " (" + core.SIGNS[lordSign] + "), " + dig + ".";
    if (dusthana.indexOf(lordHouse) >= 0) {
      score -= 10;
      findings.push({
        area: "Constitution in the health chart (D6 Lagna lord)",
        severity: "moderate",
        basis: note + " Its placement in a D6 dusthana weakens baseline disease-resistance.",
        bodyParts: bodyParts(lord, lordSign)
      });
    } else {
      supportive.push(note + (dig === "exalted" || dig === "own sign" ? " A dignified D6 lagna lord aids recovery." : ""));
    }
    if (dig === "debilitated") score -= 6;
    else if (dig === "exalted" || dig === "own sign") score += 5;

    // ---- Malefics / benefics on D6 1, 6, 8, 12 ----
    var watch = [
      { h: 1, label: "D6 Ascendant (body/vitality)" },
      { h: 6, label: "D6 6th house (active disease)" },
      { h: 8, label: "D6 8th house (chronic/acute crises)" },
      { h: 12, label: "D6 12th house (hospitalisation/loss)" }
    ];
    watch.forEach(function (w) {
      var occ = m.housePlanets[w.h];
      if (!occ.length) return;
      var mal = occ.filter(isMalefic);
      var ben = occ.filter(function (p) { return !isMalefic(p); });
      var parts = [];
      occ.forEach(function (p) { parts = parts.concat(bodyParts(p, d6.planets[p].signIndex)); });
      if (mal.length && (w.h === 1 || w.h === 6 || w.h === 8 || w.h === 12)) {
        score -= (w.h === 6 || w.h === 8 ? 6 : 4) * mal.length;
        findings.push({
          area: w.label,
          severity: mal.length >= 2 ? "high" : "moderate",
          basis: "Malefic(s) " + mal.join(", ") + " in " + w.label +
            " emphasise the organs/functions they govern as vulnerable in this health chart.",
          bodyParts: uniq(parts)
        });
      }
      if (ben.length && (w.h === 1 || w.h === 6)) {
        score += 3;
        supportive.push("Benefic(s) " + ben.join(", ") + " in " + w.label + " support resilience/recuperation.");
      }
    });

    score = Math.max(5, Math.min(95, Math.round(score)));
    var band = score >= 75 ? "strong" : score >= 60 ? "reasonably stable" :
      score >= 45 ? "guarded" : "fragile";
    var summary = "D6 (Shashthamsa) health-chart reading: disease-resistance appears " + band +
      " (D6 index " + score + "/100). D6 Ascendant is " + core.SIGNS[lagna] +
      "; the findings reflect afflictions to the health-specific houses (1/6/8/12).";

    return {
      method: "D6 Shashthamsa",
      score: score,
      summary: summary,
      lagnaSign: core.SIGNS[lagna],
      findings: findings,
      supportive: supportive,
      maps: m
    };
  }

  var api = { analyze: analyze };
  root.AHS = root.AHS || {};
  root.AHS.d6 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
