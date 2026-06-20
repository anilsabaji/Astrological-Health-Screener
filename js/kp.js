/*
 * kp.js
 * Health analysis using Krishnamurti Paddhati (KP):
 *   - Placidus cuspal sub-lords
 *   - 4-fold significators of houses (occupant's star, occupant, owner's star, owner)
 *   - Health verdict from sub-lords of cusps 1 (body), 6 (disease), 8 (chronic), 12 (hospitalization)
 *   - A planet gives primarily the results of the house(s) signified by its STAR (nakshatra) lord
 *
 * Works in browser (window.AHS.kp) and Node.
 */
(function (root) {
  "use strict";

  var core = (typeof require !== "undefined") ? require("./astro-core.js") : root.AHS.core;
  var data = (typeof require !== "undefined") ? require("./data.js") : root.AHS.data;

  var GRAHAS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];

  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }

  // Houses (1..12) owned by a planet = cusps falling in signs ruled by that planet.
  function ownedHouses(chart, planet) {
    var houses = [];
    for (var h = 0; h < 12; h++) {
      if (chart.cusps[h].signLord === planet) houses.push(h + 1);
    }
    return houses;
  }

  function occupiedHouse(chart, planet) {
    return chart.planets[planet].placidusHouse;
  }

  /*
   * Houses signified by a planet (KP). The planet primarily delivers the
   * houses signified by its STAR lord, then its own occupation/ownership.
   * Returns { strong:[houses via star lord], own:[occupied+owned], all:[...] }
   */
  function planetSignifications(chart, planet) {
    var starLord = chart.planets[planet].nakshatraLord;
    var viaStar = [occupiedHouse(chart, starLord)].concat(ownedHouses(chart, starLord));
    var own = [occupiedHouse(chart, planet)].concat(ownedHouses(chart, planet));

    // Nodes also act for their sign-lord (depositor)
    if (planet === "Rahu" || planet === "Ketu") {
      var dep = chart.planets[planet].signLord;
      own = own.concat([occupiedHouse(chart, dep)]).concat(ownedHouses(chart, dep));
    }
    viaStar = uniq(viaStar);
    own = uniq(own);
    return { strong: viaStar, own: own, all: uniq(viaStar.concat(own)) };
  }

  // 4-fold significators of a house (which planets signify it).
  function houseSignificators(chart, houseNum) {
    var sigs = [];
    // occupants of the house
    var occupants = GRAHAS.filter(function (p) { return occupiedHouse(chart, p) === houseNum; });
    // owner(s) of the house
    var owners = GRAHAS.filter(function (p) { return ownedHouses(chart, p).indexOf(houseNum) >= 0; });

    // Level 1: planets in the star of occupants
    GRAHAS.forEach(function (p) {
      if (occupants.indexOf(chart.planets[p].nakshatraLord) >= 0) sigs.push({ planet: p, level: 1 });
    });
    // Level 2: occupants
    occupants.forEach(function (p) { sigs.push({ planet: p, level: 2 }); });
    // Level 3: planets in the star of owners
    GRAHAS.forEach(function (p) {
      if (owners.indexOf(chart.planets[p].nakshatraLord) >= 0) sigs.push({ planet: p, level: 3 });
    });
    // Level 4: owners
    owners.forEach(function (p) { sigs.push({ planet: p, level: 4 }); });

    // dedupe keeping strongest (lowest level)
    var best = {};
    sigs.forEach(function (s) {
      if (best[s.planet] === undefined || s.level < best[s.planet]) best[s.planet] = s.level;
    });
    return Object.keys(best).map(function (p) { return { planet: p, level: best[p] }; })
      .sort(function (a, b) { return a.level - b.level; });
  }

  function signifiesAny(chart, planet, houseList) {
    var sig = planetSignifications(chart, planet);
    return houseList.some(function (h) { return sig.all.indexOf(h) >= 0; });
  }

  function bodyPartsFor(planet, signIndex) {
    return uniq((data.PLANET_BODY[planet] || []).slice(0, 3)
      .concat((data.SIGN_BODY[signIndex] || []).slice(0, 2)));
  }

  /*
   * Main KP health analysis.
   */
  function analyze(chart) {
    var DIS = data.KP_DISEASE_HOUSES;   // [6,8,12]
    var REC = data.KP_RECOVERY_HOUSES;  // [1,5,11]
    var findings = [];
    var cuspReports = [];
    var score = 70;

    // ---- Cuspal sub-lord verdicts for health-relevant cusps ----
    var healthCusps = [
      { h: 1, label: "Body & general health (1st cusp)" },
      { h: 6, label: "Disease & illness (6th cusp)" },
      { h: 8, label: "Chronic ailments / surgery (8th cusp)" },
      { h: 12, label: "Hospitalization / bed-rest (12th cusp)" }
    ];

    healthCusps.forEach(function (c) {
      var subLord = chart.cusps[c.h - 1].subLord;
      var sig = planetSignifications(chart, subLord);
      var signifiesDisease = DIS.some(function (h) { return sig.all.indexOf(h) >= 0; });
      var signifiesRecovery = REC.some(function (h) { return sig.all.indexOf(h) >= 0; });

      var verdict, sev;
      if (c.h === 1) {
        // 1st cusp sub-lord: good health if it signifies 1/5/11 and NOT 6/8/12
        if (signifiesDisease && !signifiesRecovery) { verdict = "indicates vulnerability to ill-health"; sev = "high"; score -= 10; }
        else if (signifiesDisease && signifiesRecovery) { verdict = "mixed - health challenges with capacity to recover"; sev = "moderate"; score -= 4; }
        else { verdict = "supports good general health"; sev = "low"; score += 6; }
      } else {
        // 6/8/12 cusp sub-lord signifying disease houses => that affliction can manifest
        if (signifiesDisease) {
          verdict = "active - its sub-lord signifies disease houses (6/8/12), so this area can manifest";
          sev = c.h === 8 ? "high" : "moderate";
          score -= (c.h === 8 ? 8 : 5);
        } else if (signifiesRecovery) {
          verdict = "subdued - sub-lord leans toward recovery houses (1/5/11)";
          sev = "low";
          score += 3;
        } else {
          verdict = "neutral";
          sev = "low";
        }
      }

      cuspReports.push({
        cusp: c.h,
        label: c.label,
        subLord: subLord,
        signifies: sig.all.slice().sort(function (a, b) { return a - b; }),
        verdict: verdict,
        severity: sev
      });
    });

    // ---- Planets that are significators of disease houses 6/8/12 ----
    var diseaseSignificators = {};
    DIS.forEach(function (h) {
      houseSignificators(chart, h).forEach(function (s) {
        if (!diseaseSignificators[s.planet] || s.level < diseaseSignificators[s.planet].level) {
          diseaseSignificators[s.planet] = { level: s.level, house: h };
        }
      });
    });

    Object.keys(diseaseSignificators).forEach(function (p) {
      var info = diseaseSignificators[p];
      var signIndex = chart.planets[p].signIndex;
      // strong significator (level 1-2) and the planet itself afflicting => emphasise
      var sev = info.level <= 2 ? "moderate" : "low";
      findings.push({
        area: p + " - significator of disease house " + info.house,
        severity: sev,
        basis: p + " (in " + chart.planets[p].sign + ", star of " + chart.planets[p].nakshatraLord +
          ") is a level-" + info.level + " significator of house " + info.house +
          ". In KP this links its governed organs/functions to that house's matters.",
        bodyParts: bodyPartsFor(p, signIndex)
      });
    });

    score = Math.max(5, Math.min(95, Math.round(score)));

    // ---- Overall verdict ----
    var firstCusp = cuspReports[0];
    var band = score >= 75 ? "favourable" : score >= 60 ? "reasonably stable" :
      score >= 45 ? "guarded - several cuspal links to disease houses" : "fragile - strong cuspal links to 6/8/12";

    var summary = "KP assessment: health outlook appears " + band + " (index " + score + "/100). " +
      "The 1st cuspal sub-lord is " + firstCusp.subLord + ", which " + firstCusp.verdict + ". " +
      "Cuspal sub-lords and the significators of houses 6/8/12 below point to the systems most likely involved.";

    return {
      method: "KP (Krishnamurti Paddhati)",
      score: score,
      summary: summary,
      cuspReports: cuspReports,
      findings: findings,
      ascendant: chart.ascendant.sign
    };
  }

  var api = {
    analyze: analyze,
    planetSignifications: planetSignifications,
    houseSignificators: houseSignificators,
    ownedHouses: ownedHouses
  };
  root.AHS = root.AHS || {};
  root.AHS.kp = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
