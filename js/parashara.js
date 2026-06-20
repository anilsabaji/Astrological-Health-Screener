/*
 * parashara.js
 * Health analysis using Parashara (Brihat Parashara Hora Shastra) principles:
 *   - Lagna (1st) & Lagna lord = body, constitution, vitality
 *   - 6th house = disease, 8th = chronic/surgery/longevity, 12th = hospitalization
 *   - Malefic afflictions, debilitation, dusthana placements
 *   - Body-part mapping via afflicted planets (karaka) and signs (Kalapurusha)
 *
 * Whole-sign house system (classical Parashara).
 * Works in browser (window.AHS.parashara) and Node.
 */
(function (root) {
  "use strict";

  var core = (typeof require !== "undefined") ? require("./astro-core.js") : root.AHS.core;
  var data = (typeof require !== "undefined") ? require("./data.js") : root.AHS.data;

  var GRAHAS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];

  // Houses ruled by each planet from a given lagna sign (whole-sign).
  function houseLords(lagnaSignIndex) {
    var houseToLord = {};
    var lordToHouses = {};
    for (var h = 1; h <= 12; h++) {
      var signIdx = (lagnaSignIndex + h - 1) % 12;
      var lord = core.SIGN_LORD[signIdx];
      houseToLord[h] = lord;
      (lordToHouses[lord] = lordToHouses[lord] || []).push(h);
    }
    return { houseToLord: houseToLord, lordToHouses: lordToHouses };
  }

  // Whole-sign aspects a planet casts (house numbers it aspects FROM its house).
  function aspectsFrom(planet, house) {
    var asp = [(house + 6 - 1) % 12 + 1]; // 7th aspect (all planets)
    if (planet === "Mars") asp.push((house + 3) % 12 + 1, (house + 7) % 12 + 1); // 4th & 8th
    if (planet === "Jupiter") asp.push((house + 4) % 12 + 1, (house + 8) % 12 + 1); // 5th & 9th
    if (planet === "Saturn") asp.push((house + 2) % 12 + 1, (house + 9) % 12 + 1); // 3rd & 10th
    // normalize
    return asp.map(function (x) { return ((x - 1) % 12) + 1; });
  }

  function dignityOf(planet, signIndex) {
    var d = data.DIGNITY[planet];
    if (!d) return "neutral";
    if (signIndex === d.exalt) return "exalted";
    if (signIndex === d.debil) return "debilitated";
    if (d.own.indexOf(signIndex) >= 0) return "own sign";
    return "neutral";
  }

  function isMalefic(p) { return data.NATURE[p] === "malefic"; }

  // Build planet->house and house->planets maps using whole-sign houses
  function houseMaps(chart) {
    var planetHouse = {}, housePlanets = {};
    for (var i = 1; i <= 12; i++) housePlanets[i] = [];
    GRAHAS.forEach(function (p) {
      var h = chart.planets[p].wholeSignHouse;
      planetHouse[p] = h;
      housePlanets[h].push(p);
    });
    return { planetHouse: planetHouse, housePlanets: housePlanets };
  }

  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }

  function bodyPartsFor(planet, signIndex) {
    var parts = (data.PLANET_BODY[planet] || []).slice(0, 3);
    var signParts = (data.SIGN_BODY[signIndex] || []).slice(0, 2);
    return uniq(parts.concat(signParts));
  }

  /*
   * Main analysis. Returns a structured report.
   *   chart : output of core.buildChart
   */
  function analyze(chart) {
    var lagnaSign = chart.lagnaSignIndex;
    var hl = houseLords(lagnaSign);
    var maps = houseMaps(chart);
    var findings = [];
    var supportive = [];
    var score = 70; // baseline vitality score (0-100), adjusted by factors

    // ---- 1. Lagna lord (constitution / vitality) ----
    var lagnaLord = hl.houseToLord[1];
    var llHouse = maps.planetHouse[lagnaLord];
    var llSign = chart.planets[lagnaLord].signIndex;
    var llDignity = dignityOf(lagnaLord, llSign);
    var dusthana = [6, 8, 12];
    var kendraTrikona = [1, 4, 7, 10, 5, 9];

    var llNote = "Lagna lord " + lagnaLord + " is in house " + llHouse +
      " (" + chart.planets[lagnaLord].sign + "), " + llDignity + ".";
    if (dusthana.indexOf(llHouse) >= 0) {
      score -= 12;
      findings.push({
        area: "Overall constitution",
        severity: "moderate",
        basis: llNote + " Placement in a dusthana (6/8/12) can undermine baseline vitality and resilience.",
        bodyParts: bodyPartsFor(lagnaLord, llSign)
      });
    } else if (kendraTrikona.indexOf(llHouse) >= 0) {
      score += 6;
      supportive.push(llNote + " Placement in a kendra/trikona supports a resilient constitution.");
    } else {
      supportive.push(llNote);
    }
    if (llDignity === "debilitated") { score -= 8; }
    else if (llDignity === "exalted" || llDignity === "own sign") { score += 6; supportive.push("Lagna lord is dignified (" + llDignity + "), strengthening overall health."); }

    // ---- 2. Malefic afflictions to the Ascendant (1st house) ----
    var maleficsInLagna = maps.housePlanets[1].filter(isMalefic);
    var aspectingLagna = [];
    GRAHAS.forEach(function (p) {
      if (!isMalefic(p)) return;
      var h = maps.planetHouse[p];
      if (aspectsFrom(p, h).indexOf(1) >= 0 && h !== 1) aspectingLagna.push(p);
    });
    var lagnaAfflictors = uniq(maleficsInLagna.concat(aspectingLagna));
    if (lagnaAfflictors.length) {
      score -= 4 * lagnaAfflictors.length;
      var parts = [];
      lagnaAfflictors.forEach(function (p) {
        parts = parts.concat(data.PLANET_BODY[p].slice(0, 2));
      });
      parts = parts.concat(data.SIGN_BODY[lagnaSign].slice(0, 2));
      findings.push({
        area: "Ascendant under malefic influence",
        severity: lagnaAfflictors.length >= 2 ? "high" : "moderate",
        basis: "Malefic(s) " + lagnaAfflictors.join(", ") + " influence the Ascendant (" +
          core.SIGNS[lagnaSign] + "), which can stress the body's head/constitution and the parts they govern.",
        bodyParts: uniq(parts)
      });
    }

    // ---- 3. 6th house (disease) ----
    analyzeDuhsthana(6, "Disease & infections (6th house)", chart, maps, hl, findings, function () { score -= 6; });
    // ---- 4. 8th house (chronic / surgery / longevity) ----
    analyzeDuhsthana(8, "Chronic ailments, surgery & longevity (8th house)", chart, maps, hl, findings, function () { score -= 7; });
    // ---- 5. 12th house (hospitalization / sleep / loss) ----
    analyzeDuhsthana(12, "Hospitalization, sleep & recovery (12th house)", chart, maps, hl, findings, function () { score -= 4; });

    // ---- 6. Moon = mind & emotional health ----
    var moonH = maps.planetHouse.Moon;
    var moonAfflictors = [];
    GRAHAS.forEach(function (p) {
      if (p === "Moon" || !isMalefic(p)) return;
      var h = maps.planetHouse[p];
      if (h === moonH) moonAfflictors.push(p + " (conjunct)");
      else if (aspectsFrom(p, h).indexOf(moonH) >= 0) moonAfflictors.push(p + " (aspect)");
    });
    if (moonAfflictors.length || dusthana.indexOf(moonH) >= 0) {
      score -= 5;
      findings.push({
        area: "Mind & emotional well-being (Moon)",
        severity: moonAfflictors.length >= 2 ? "high" : "moderate",
        basis: "The Moon (mind, emotions, body fluids) is " +
          (dusthana.indexOf(moonH) >= 0 ? "placed in dusthana house " + moonH : "in house " + moonH) +
          (moonAfflictors.length ? " and afflicted by " + moonAfflictors.join(", ") : "") +
          ". Watch for stress, sleep, anxiety and fluid/blood balance.",
        bodyParts: bodyPartsFor("Moon", chart.planets.Moon.signIndex)
      });
    } else {
      supportive.push("The Moon is comparatively unafflicted, supporting emotional stability and good fluid balance.");
    }

    // ---- 7. Debilitated planets anywhere -> flag their domains ----
    GRAHAS.forEach(function (p) {
      var s = chart.planets[p].signIndex;
      if (dignityOf(p, s) === "debilitated") {
        score -= 3;
        findings.push({
          area: p + " debilitated (in " + core.SIGNS[s] + ")",
          severity: "low",
          basis: p + " is debilitated, weakening the organs/functions it governs. Keep the related systems monitored.",
          bodyParts: data.PLANET_BODY[p].slice(0, 3)
        });
      }
    });

    score = Math.max(5, Math.min(95, Math.round(score)));

    var summary = buildSummary(score, chart, lagnaLord, llHouse);

    return {
      method: "Parashara",
      score: score,
      summary: summary,
      lagnaSign: core.SIGNS[lagnaSign],
      lagnaLord: lagnaLord,
      houseLords: hl.houseToLord,
      findings: findings,
      supportive: supportive
    };
  }

  function analyzeDuhsthana(houseNum, label, chart, maps, hl, findings, penalize) {
    var occupants = maps.housePlanets[houseNum];
    var lord = hl.houseToLord[houseNum];
    var lordHouse = maps.planetHouse[lord];
    var notes = [];
    var bodyParts = [];

    if (occupants.length) {
      occupants.forEach(function (p) {
        bodyParts = bodyParts.concat(data.PLANET_BODY[p].slice(0, 2));
      });
      notes.push("Occupied by " + occupants.join(", ") + " - their governed organs/functions are emphasised here.");
    }
    // The lord of this house tied to other disease houses increases tendency
    var lordSignParts = data.SIGN_BODY[chart.planets[lord].signIndex] || [];
    if ([6, 8, 12].indexOf(lordHouse) >= 0) {
      notes.push("The " + houseNum + "th lord (" + lord + ") sits in dusthana house " + lordHouse +
        ", reinforcing this area.");
    }
    bodyParts = bodyParts.concat(lordSignParts.slice(0, 1));

    if (notes.length) {
      penalize();
      findings.push({
        area: label,
        severity: occupants.filter(function (p) { return data.NATURE[p] === "malefic"; }).length >= 2 ? "high" : "moderate",
        basis: notes.join(" ") + " " + (data.HOUSE_HEALTH[houseNum] || ""),
        bodyParts: bodyParts.filter(function (v, i) { return bodyParts.indexOf(v) === i; })
      });
    }
  }

  function buildSummary(score, chart, lagnaLord, llHouse) {
    var band = score >= 75 ? "robust" : score >= 60 ? "generally good" :
      score >= 45 ? "moderate, with areas needing attention" : "delicate; several factors warrant care";
    return "Parashara assessment: overall constitution appears " + band +
      " (vitality index " + score + "/100). The Ascendant is " + chart.ascendant.sign +
      " with lagna lord " + lagnaLord + " in house " + llHouse +
      ". The findings below highlight body systems indicated by classical karakas and house placements.";
  }

  var api = { analyze: analyze, houseLords: houseLords, dignityOf: dignityOf, aspectsFrom: aspectsFrom };
  root.AHS = root.AHS || {};
  root.AHS.parashara = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
