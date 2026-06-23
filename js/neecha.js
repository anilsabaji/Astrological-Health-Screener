/*
 * neecha.js
 * Debilitation (Neecha) detection in the D1 Rasi chart and Neecha Bhanga
 * (cancellation of debilitation) using the classical conditions:
 *   1. The lord of the debilitation sign (dispositor) is in a kendra (1/4/7/10)
 *      from the Lagna or from the Moon.
 *   2. The planet that is EXALTED in the debilitation sign is in a kendra from
 *      the Lagna or the Moon.
 *   3. The debilitated planet is conjunct or aspected by its dispositor.
 *   4. The debilitated planet is conjunct or aspected by the planet exalted there.
 *   5. The dispositor or that exalted planet is itself exalted.
 *   6. The debilitated planet attains exaltation in the Navamsa (D9).
 *
 * A debilitated planet WITHOUT cancellation is a health weakness for the organs
 * it governs; WITH cancellation the weakness is mitigated (and can become a
 * source of strength -- Neecha Bhanga Raja Yoga).
 *
 * Works in browser (window.AHS.neecha) and Node.
 */
(function (root) {
  "use strict";

  var R = (typeof require !== "undefined");
  var core = R ? require("./astro-core.js") : root.AHS.core;
  var data = R ? require("./data.js") : root.AHS.data;
  var parashara = R ? require("./parashara.js") : root.AHS.parashara;

  var PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  var EXALT_SIGN = { Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6 };
  var KENDRA = [1, 4, 7, 10];

  function exaltedInSign(signIndex) {
    for (var p in EXALT_SIGN) if (EXALT_SIGN[p] === signIndex) return p;
    return null;
  }

  function analyze(chart, d9) {
    var moonSign = chart.planets.Moon.signIndex;
    function houseFromLagna(pl) { return chart.planets[pl].wholeSignHouse; }
    function houseFromMoon(pl) { return ((chart.planets[pl].signIndex - moonSign + 12) % 12) + 1; }
    function aspectsTarget(src, targetHouse) {
      return parashara.aspectsFrom(src, chart.planets[src].wholeSignHouse).indexOf(targetHouse) >= 0;
    }

    var results = [];
    PLANETS.forEach(function (p) {
      if (parashara.dignityOf(p, chart.planets[p].signIndex) !== "debilitated") return;
      var debilSign = chart.planets[p].signIndex;
      var dispositor = core.SIGN_LORD[debilSign];
      var exaltLord = exaltedInSign(debilSign);
      var pHouse = chart.planets[p].wholeSignHouse;
      var reasons = [];

      if (KENDRA.indexOf(houseFromLagna(dispositor)) >= 0)
        reasons.push("dispositor " + dispositor + " is in a kendra from the Lagna");
      if (KENDRA.indexOf(houseFromMoon(dispositor)) >= 0)
        reasons.push("dispositor " + dispositor + " is in a kendra from the Moon");

      if (exaltLord) {
        if (KENDRA.indexOf(houseFromLagna(exaltLord)) >= 0)
          reasons.push(exaltLord + " (exalted in " + core.SIGNS[debilSign] + ") is in a kendra from the Lagna");
        else if (KENDRA.indexOf(houseFromMoon(exaltLord)) >= 0)
          reasons.push(exaltLord + " (exalted in " + core.SIGNS[debilSign] + ") is in a kendra from the Moon");
      }

      if (chart.planets[dispositor].wholeSignHouse === pHouse && dispositor !== p)
        reasons.push("conjunct its dispositor " + dispositor);
      else if (aspectsTarget(dispositor, pHouse))
        reasons.push("aspected by its dispositor " + dispositor);

      if (exaltLord && exaltLord !== p) {
        if (chart.planets[exaltLord].wholeSignHouse === pHouse)
          reasons.push("conjunct " + exaltLord + " (exalted in this sign)");
        else if (aspectsTarget(exaltLord, pHouse))
          reasons.push("aspected by " + exaltLord + " (exalted in this sign)");
      }

      if (parashara.dignityOf(dispositor, chart.planets[dispositor].signIndex) === "exalted")
        reasons.push("dispositor " + dispositor + " is itself exalted");
      if (exaltLord && parashara.dignityOf(exaltLord, chart.planets[exaltLord].signIndex) === "exalted")
        reasons.push(exaltLord + " is exalted");

      // ---- Navamsa (D9) based cancellation ----
      var d9sign = d9 ? d9.planets[p].signIndex : null;
      var d9dig = d9 ? parashara.dignityOf(p, d9sign) : "n/a";
      if (d9) {
        if (d9dig === "exalted") reasons.push("attains exaltation in the Navamsa (D9)");
        else if (d9dig === "own sign") reasons.push("occupies its own sign in the Navamsa (D9)");
        if (d9sign === chart.planets[p].signIndex)
          reasons.push("is Vargottama (same sign in D1 & D9) \u2014 a strengthening factor");
        var dispD9 = parashara.dignityOf(dispositor, d9.planets[dispositor].signIndex);
        if (dispD9 === "exalted" || dispD9 === "own sign")
          reasons.push("dispositor " + dispositor + " is " + dispD9 + " in the Navamsa");
      }

      results.push({
        planet: p,
        debilSign: core.SIGNS[debilSign],
        dispositor: dispositor,
        exaltLord: exaltLord,
        navamsaSign: d9 ? core.SIGNS[d9sign] : null,
        navamsaDignity: d9dig,
        cancelled: reasons.length > 0,
        reasons: reasons,
        bodyParts: (data.PLANET_BODY[p] || []).slice(0, 3)
      });
    });
    return results;
  }

  // names of planets whose debilitation is cancelled (for the forecast engine)
  function cancelledSet(results) {
    return results.filter(function (r) { return r.cancelled; }).map(function (r) { return r.planet; });
  }

  var api = { analyze: analyze, cancelledSet: cancelledSet };
  root.AHS = root.AHS || {};
  root.AHS.neecha = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
