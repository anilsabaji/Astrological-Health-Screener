/*
 * shadbala.js
 * Shadbala (six-fold planetary strength) for the seven classical planets, plus
 * motion speed, direction (retrograde/direct), combustion and declination --
 * used to judge how capable each planet is of protecting/harming the body parts
 * and houses it governs.
 *
 * The six balas (values in Virupas; 60 Virupas = 1 Rupa):
 *   1. Sthana  : Uchcha + Saptavargaja + Ojayugma + Kendradi + Drekkana
 *   2. Dig     : directional strength (distance from the powerless point)
 *   3. Kala    : Nathonnatha + Paksha + Ayana (declination)
 *   4. Cheshta : motional strength (Sun=Ayana, Moon=Paksha, others from speed)
 *   5. Naisargika : fixed natural strength
 *   6. Drik    : aspectual strength (benefic vs malefic graha drishti)
 *
 * NOTE: some Kala sub-balas (Tribhaga, year/month/day/hour lords, Yuddha) and the
 * full 7-varga Saptavargaja are approximated for a browser-only, no-ephemeris-file
 * implementation. Declination assumes ~0 ecliptic latitude. Results are reliable
 * for STRONG/WEAK classification, which is what health judgement needs.
 *
 * Works in browser (window.AHS.shadbala) and Node.
 */
(function (root) {
  "use strict";

  var R = (typeof require !== "undefined");
  var eph = R ? require("./ephemeris.js") : root.AHS.ephemeris;
  var core = R ? require("./astro-core.js") : root.AHS.core;
  var data = R ? require("./data.js") : root.AHS.data;
  var varga = R ? require("./varga.js") : root.AHS.varga;
  var parashara = R ? require("./parashara.js") : root.AHS.parashara;

  var DEG = Math.PI / 180;
  function rev(x) { x = x % 360; return x < 0 ? x + 360 : x; }
  function sind(x) { return Math.sin(x * DEG); }
  function cosd(x) { return Math.cos(x * DEG); }
  function atan2d(y, x) { return Math.atan2(y, x) / DEG; }
  function asind(x) { return Math.asin(Math.max(-1, Math.min(1, x))) / DEG; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function angSep(a, b) { var d = Math.abs(rev(a) - rev(b)); return d > 180 ? 360 - d : d; }

  var PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  var NAISARGIKA = { Sun: 60, Moon: 51.43, Venus: 42.86, Jupiter: 34.29, Mercury: 25.71, Mars: 17.14, Saturn: 8.57 };
  // deep exaltation longitude (sidereal degrees)
  var EXALT = { Sun: 10, Moon: 33, Mars: 298, Mercury: 165, Jupiter: 95, Venus: 357, Saturn: 200 };
  var MEAN_SPEED = { Sun: 0.9856, Moon: 13.1764, Mars: 0.5240, Mercury: 1.3833, Jupiter: 0.0831, Venus: 1.6021, Saturn: 0.0335 };
  var REQUIRED = { Sun: 5, Moon: 6, Mars: 5, Mercury: 7, Jupiter: 6.5, Venus: 5.5, Saturn: 5 }; // Rupas
  var COMBUST = { Moon: 12, Mars: 17, Mercury: 12, Jupiter: 11, Venus: 9, Saturn: 15 };
  // natural friendship
  var FRIENDS = {
    Sun: { f: ["Moon", "Mars", "Jupiter"], e: ["Venus", "Saturn"] },
    Moon: { f: ["Sun", "Mercury"], e: [] },
    Mars: { f: ["Sun", "Moon", "Jupiter"], e: ["Mercury"] },
    Mercury: { f: ["Sun", "Venus"], e: ["Moon"] },
    Jupiter: { f: ["Sun", "Moon", "Mars"], e: ["Mercury", "Venus"] },
    Venus: { f: ["Mercury", "Saturn"], e: ["Sun", "Moon"] },
    Saturn: { f: ["Mercury", "Venus"], e: ["Sun", "Moon", "Mars"] }
  };
  var DIG_STRONG_HOUSE = { Sun: 10, Mars: 10, Jupiter: 1, Mercury: 1, Saturn: 7, Moon: 4, Venus: 4 };
  var ODD_PREF = ["Sun", "Mars", "Jupiter", "Mercury", "Saturn"]; // prefer odd signs
  var DREK_PREF = { Sun: 0, Mars: 0, Jupiter: 0, Mercury: 1, Saturn: 1, Moon: 2, Venus: 2 };
  var DAY_STRONG = ["Sun", "Jupiter", "Venus"]; // nathonnatha
  var AYANA_NORTH = ["Sun", "Mars", "Jupiter", "Venus", "Mercury"]; // gain with +declination

  function exaltSign(p) { return Math.floor(EXALT[p] / 30); }

  function dignityPoints(p, signIndex) {
    var lord = core.SIGN_LORD[signIndex];
    if (signIndex === exaltSign(p)) return 30;
    if (lord === p) return 30;                       // own
    if (FRIENDS[p].f.indexOf(lord) >= 0) return 15;  // friend
    if (FRIENDS[p].e.indexOf(lord) >= 0) return 5;   // enemy
    return 10;                                       // neutral
  }

  function speedsAndDecl(jd) {
    var d = jd - 2451543.5;
    var eps = eph.obliquity(d);
    var a = eph.tropicalLongitudes(d - 0.5);
    var b = eph.tropicalLongitudes(d + 0.5);
    var mid = eph.tropicalLongitudes(d);
    var sp = {}, dec = {}, trop = {};
    PLANETS.forEach(function (p) {
      var s = rev(b[p] - a[p]); if (s > 180) s -= 360;
      sp[p] = s;                                   // deg/day (signed)
      dec[p] = asind(sind(eps) * sind(mid[p]));    // declination (lat~0)
      trop[p] = mid[p];
    });
    return { speed: sp, decl: dec, trop: trop, eps: eps };
  }

  /*
   * compute(chart, opts)
   *   opts = { jd, latDeg }  (lon already baked into chart.ramc)
   */
  function compute(chart, opts) {
    var jd = opts.jd;
    var sd = speedsAndDecl(jd);
    var ayan = chart.ayanamsa;

    // day/night birth: Sun above horizon if in Placidus houses 7..12
    var sunHouse = chart.planets.Sun.placidusHouse;
    var isDay = sunHouse >= 7 && sunHouse <= 12;

    // Sun hour-angle for Nathonnatha
    var raSun = rev(atan2d(sind(sd.trop.Sun) * cosd(sd.eps), cosd(sd.trop.Sun)));
    var ha = rev(chart.ramc - raSun); var hh = ha > 180 ? 360 - ha : ha; // 0..180

    var sunLon = chart.planets.Sun.lon, moonLon = chart.planets.Moon.lon;
    var elong = angSep(moonLon, sunLon);

    var out = {};
    PLANETS.forEach(function (p) {
      var pl = chart.planets[p];
      var sidLon = pl.lon, signIndex = pl.signIndex;

      // ---- Sthana ----
      var uchcha = angSep(sidLon, rev(EXALT[p] + 180)) / 3;            // 0..60
      var d9 = varga.navamsaSign(sidLon);
      var d3 = varga.drekkanaSign(signIndex, pl.degInSign);
      var sapta = dignityPoints(p, signIndex) + dignityPoints(p, d3) + dignityPoints(p, d9); // 3-varga approx
      var oddSign = (signIndex % 2 === 0);
      var prefOdd = ODD_PREF.indexOf(p) >= 0;
      var oja = ((oddSign === prefOdd) ? 15 : 0) + (((d9 % 2 === 0) === prefOdd) ? 15 : 0);
      var h = pl.wholeSignHouse;
      var kendradi = ([1, 4, 7, 10].indexOf(h) >= 0) ? 60 : ([2, 5, 8, 11].indexOf(h) >= 0) ? 30 : 15;
      var drekN = Math.floor(pl.degInSign / 10);
      var drek = (drekN === DREK_PREF[p]) ? 15 : 0;
      var sthana = uchcha + sapta + oja + kendradi + drek;

      // ---- Dig ----
      var strongHouse = DIG_STRONG_HOUSE[p];
      var weakCusp = chart.cuspsSidereal[(strongHouse + 5) % 12]; // opposite-house cusp
      var dig = angSep(sidLon, weakCusp) / 3;

      // ---- Kala ----
      var nath = (p === "Mercury") ? 60 : (DAY_STRONG.indexOf(p) >= 0 ? (180 - hh) / 180 * 60 : hh / 180 * 60);
      var benefic = data.NATURE[p] === "benefic";
      var paksha = benefic ? elong / 3 : (180 - elong) / 3;
      if (p === "Moon") paksha = Math.min(60, paksha * 2);
      var sgn = AYANA_NORTH.indexOf(p) >= 0 ? 1 : -1;
      var ayana = clamp(60 * (24 + sgn * sd.decl[p]) / 48, 0, 60);
      var kala = nath + paksha + ayana;

      // ---- Cheshta ----
      var cheshta;
      if (p === "Sun") cheshta = ayana;
      else if (p === "Moon") cheshta = paksha;
      else {
        var ratio = (MEAN_SPEED[p] - sd.speed[p]) / (2 * MEAN_SPEED[p]); // retro -> >0.5, fast -> <0
        cheshta = clamp(ratio * 60, 0, 60);
      }

      // ---- Naisargika ----
      var naisargika = NAISARGIKA[p];

      // ---- Drik (aspectual, simplified) ----
      var drik = 0;
      PLANETS.concat(["Rahu", "Ketu"]).forEach(function (q) {
        if (q === p || !chart.planets[q]) return;
        var qh = chart.planets[q].wholeSignHouse;
        if (parashara.aspectsFrom(q, qh).indexOf(h) >= 0) {
          drik += (data.NATURE[q] === "benefic") ? 10 : -10;
        }
      });
      drik = clamp(drik, -30, 30);

      var totalVir = sthana + dig + kala + cheshta + naisargika + drik;
      var rupas = totalVir / 60;
      var required = REQUIRED[p];

      // motion / direction / combustion
      var retro = (p !== "Sun" && p !== "Moon") && sd.speed[p] < 0;
      var combust = (p !== "Sun") && COMBUST[p] && angSep(sidLon, sunLon) < COMBUST[p];
      var speedAbs = Math.abs(sd.speed[p]);
      var motion = retro ? "retrograde" : (speedAbs < MEAN_SPEED[p] * 0.5 ? "slow" : speedAbs > MEAN_SPEED[p] * 1.2 ? "fast" : "average");

      out[p] = {
        components: {
          sthana: Math.round(sthana), dig: Math.round(dig), kala: Math.round(kala),
          cheshta: Math.round(cheshta), naisargika: Math.round(naisargika), drik: Math.round(drik)
        },
        totalVirupa: Math.round(totalVir),
        rupas: Math.round(rupas * 100) / 100,
        required: required,
        ratio: Math.round((rupas / required) * 100) / 100,
        status: rupas >= required ? "strong" : (rupas >= required * 0.8 ? "moderate" : "weak"),
        speed: Math.round(sd.speed[p] * 1000) / 1000,
        declination: Math.round(sd.decl[p] * 100) / 100,
        retrograde: retro,
        combust: combust,
        motion: motion
      };
    });

    return { isDay: isDay, planets: out };
  }

  // Health interpretation from Shadbala + motion/combustion.
  function healthAnalysis(sb) {
    var findings = [];
    var weakest = null, strongest = null;
    PLANETS.forEach(function (p) {
      var s = sb.planets[p];
      if (!weakest || s.ratio < weakest.ratio) weakest = { planet: p, ratio: s.ratio };
      if (!strongest || s.ratio > strongest.ratio) strongest = { planet: p, ratio: s.ratio };
    });

    PLANETS.forEach(function (p) {
      var s = sb.planets[p];
      var notes = [];
      if (s.status === "weak") notes.push("weak in Shadbala (" + s.rupas + " of " + s.required + " Rupas)");
      if (s.combust) notes.push("combust (too close to the Sun)");
      if (s.retrograde) notes.push("retrograde");
      if (s.motion === "slow") notes.push("moving slowly");
      if (notes.length && (s.status !== "strong")) {
        findings.push({
          area: p + " \u2014 reduced functional strength",
          severity: s.status === "weak" ? (s.combust ? "high" : "moderate") : "low",
          basis: p + " is " + notes.join(", ") + ". In health terms the organs/functions it governs may lack vitality or behave erratically, and it is less able to protect its houses.",
          bodyParts: (data.PLANET_BODY[p] || []).slice(0, 3)
        });
      }
    });

    var summary = "Shadbala strength assessment: " +
      "strongest planet is " + strongest.planet + " (" + sb.planets[strongest.planet].rupas + " Rupas), " +
      "weakest is " + weakest.planet + " (" + sb.planets[weakest.planet].rupas + " Rupas). " +
      "Weak, combust, retrograde or slow planets are the ones whose body systems most need support.";

    return { summary: summary, findings: findings, weakest: weakest, strongest: strongest };
  }

  // Compact map for the forecast engine.
  function statusMap(sb) {
    var m = {};
    PLANETS.forEach(function (p) {
      var s = sb.planets[p];
      m[p] = { weak: s.status === "weak", strong: s.status === "strong", combust: s.combust, retro: s.retrograde, rupas: s.rupas };
    });
    return m;
  }

  var api = { compute: compute, healthAnalysis: healthAnalysis, statusMap: statusMap, PLANETS: PLANETS };
  root.AHS = root.AHS || {};
  root.AHS.shadbala = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
