/*
 * varga.js
 * Divisional (varga) charts and classical longevity/maraka points used for
 * health timing:
 *   - D3 Drekkana chart (each sign split into three 10 deg parts)
 *   - D9 Navamsa sign helper
 *   - 22nd Drekkana lord (from Lagna)  -> Khara, cause-of-affliction point
 *   - 64th Navamsa lord (from Moon)    -> Khara, cause-of-affliction point
 *
 * Drekkana (D3) mapping (Parashara):
 *   1st drekkana (0-10 deg):  same sign
 *   2nd drekkana (10-20 deg): 5th sign from it
 *   3rd drekkana (20-30 deg): 9th sign from it
 *
 * Works in browser (window.AHS.varga) and Node.
 */
(function (root) {
  "use strict";

  var core = (typeof require !== "undefined") ? require("./astro-core.js") : root.AHS.core;
  var SIGN_LORD = core.SIGN_LORD;
  function rev(x) { x = x % 360; return x < 0 ? x + 360 : x; }

  // D3 sign for a placement given its sign index and degrees within the sign.
  function drekkanaSign(signIndex, degInSign) {
    var o = Math.floor(degInSign / 10); // 0,1,2
    if (o <= 0) return signIndex;
    if (o === 1) return (signIndex + 4) % 12;  // 5th
    return (signIndex + 8) % 12;                // 9th
  }

  // Continuous D9 (navamsa) sign for a sidereal longitude.
  function navamsaSign(lon) {
    return Math.floor(rev(lon) / (30 / 9)) % 12;
  }

  // Position (0-30 deg) within a varga sign, for division D (D3=3, D6=6, D9=9...).
  function vargaDeg(degInSign, D) {
    var span = 30 / D;
    return ((degInSign % span) / span) * 30;
  }

  /*
   * D6 Shashthamsa sign. Each sign is divided into six 5-degree parts.
   * BPHS rule: in ODD signs the parts are reckoned from Aries; in EVEN signs
   * from Libra. The Shashthamsa (D6) is the classical chart for health & disease.
   */
  function shashthamsaSign(signIndex, degInSign) {
    var part = Math.floor(degInSign / 5);            // 0..5
    var oddSign = (signIndex % 2 === 0);             // Aries(0),Gemini(2)... are odd signs
    var start = oddSign ? 0 : 6;                     // Aries or Libra
    return (start + part) % 12;
  }

  /*
   * 22nd Drekkana from the Lagna.
   * The Lagna occupies drekkana ordinal o (0,1,2) of its sign. The 22nd drekkana
   * (counting the Lagna's drekkana as the 1st) advances 21 drekkanas = exactly 7
   * signs, landing on the same ordinal in the 8th sign. Its lord is taken from the
   * Drekkana (D3) sign of that position.
   */
  function drekkana22(ascSignIndex, ascDegInSign) {
    var o = Math.floor(ascDegInSign / 10);
    var rasi = (ascSignIndex + 7) % 12; // 8th sign from lagna
    var d3 = drekkanaSign(rasi, o * 10 + 5); // sample mid-drekkana to get same ordinal mapping
    return { rasiIndex: rasi, drekkanaSignIndex: d3, lord: SIGN_LORD[d3], ordinal: o + 1 };
  }

  /*
   * 64th Navamsa from the Moon.
   * Counting the Moon's navamsa as the 1st, the 64th advances 63 navamsas. Since
   * navamsa signs run continuously, that is +63 = +3 (mod 12) navamsa signs,
   * i.e. the 4th navamsa sign from the Moon's navamsa. Its lord is the maraka/
   * Khara indicator.
   */
  function navamsa64(moonLon) {
    var xm = navamsaSign(moonLon);
    var navSign = (xm + 63) % 12; // == (xm + 3) % 12
    return { moonNavamsaSignIndex: xm, navamsaSignIndex: navSign, lord: SIGN_LORD[navSign] };
  }

  /*
   * Build a D3 Drekkana chart from a rasi chart (core.buildChart output).
   * Returns D3 sign of each body, D3 lagna, and D3 whole-sign house of each body.
   */
  function buildD3(chart) {
    var lagnaD3 = drekkanaSign(chart.ascendant.signIndex, chart.ascendant.degInSign);
    var planets = {};
    core.BODIES.forEach(function (p) {
      var d = chart.planets[p];
      var s = drekkanaSign(d.signIndex, d.degInSign);
      planets[p] = {
        signIndex: s, sign: core.SIGNS[s], degInSign: vargaDeg(d.degInSign, 3),
        house: ((s - lagnaD3 + 12) % 12) + 1
      };
    });
    return {
      lagnaSignIndex: lagnaD3, lagnaSign: core.SIGNS[lagnaD3],
      lagnaDeg: vargaDeg(chart.ascendant.degInSign, 3), planets: planets
    };
  }

  /*
   * Build a D6 Shashthamsa chart (the health/disease divisional) from a rasi chart.
   * Returns D6 sign of each body, D6 lagna, and D6 whole-sign house of each body.
   */
  function buildD6(chart) {
    var lagnaD6 = shashthamsaSign(chart.ascendant.signIndex, chart.ascendant.degInSign);
    var planets = {};
    core.BODIES.forEach(function (p) {
      var d = chart.planets[p];
      var s = shashthamsaSign(d.signIndex, d.degInSign);
      planets[p] = {
        signIndex: s, sign: core.SIGNS[s], degInSign: vargaDeg(d.degInSign, 6),
        house: ((s - lagnaD6 + 12) % 12) + 1
      };
    });
    return {
      lagnaSignIndex: lagnaD6, lagnaSign: core.SIGNS[lagnaD6],
      lagnaDeg: vargaDeg(chart.ascendant.degInSign, 6), planets: planets
    };
  }

  /*
   * Build a D9 Navamsa chart from a rasi chart.
   */
  function buildD9(chart) {
    var lagna = navamsaSign(chart.ascendant.lon);
    var planets = {};
    core.BODIES.forEach(function (p) {
      var s = navamsaSign(chart.planets[p].lon);
      planets[p] = {
        signIndex: s, sign: core.SIGNS[s], degInSign: vargaDeg(chart.planets[p].degInSign, 9),
        house: ((s - lagna + 12) % 12) + 1
      };
    });
    return {
      lagnaSignIndex: lagna, lagnaSign: core.SIGNS[lagna],
      lagnaDeg: vargaDeg(chart.ascendant.degInSign, 9), planets: planets
    };
  }

  var api = {
    drekkanaSign: drekkanaSign,
    navamsaSign: navamsaSign,
    shashthamsaSign: shashthamsaSign,
    drekkana22: drekkana22,
    navamsa64: navamsa64,
    buildD3: buildD3,
    buildD6: buildD6,
    buildD9: buildD9
  };
  root.AHS = root.AHS || {};
  root.AHS.varga = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
