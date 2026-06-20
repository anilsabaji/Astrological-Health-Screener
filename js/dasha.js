/*
 * dasha.js
 * Vimshottari Dasha calculation:
 *   - Maha Dasha (MD), Antar Dasha (AD / bhukti), Pratyantar Dasha (PD)
 *   - Starting dasha and balance from the Moon's nakshatra
 *   - Current running MD / AD / PD as of a target date (default: now)
 *
 * Uses a 365.25-day year (standard in most Vedic software).
 * Works in browser (window.AHS.dasha) and Node.
 */
(function (root) {
  "use strict";

  var core = (typeof require !== "undefined") ? require("./astro-core.js") : root.AHS.core;
  var VIM_ORDER = core.VIM_ORDER;
  var VIM_YEARS = core.VIM_YEARS;
  var NAKSHATRAS = core.NAKSHATRAS;

  var DAY_MS = 86400000;
  var YEAR_DAYS = 365.25;
  function rev(x) { x = x % 360; return x < 0 ? x + 360 : x; }
  function jdToMs(jd) { return (jd - 2440587.5) * DAY_MS; }

  // Build the nine sub-periods within a parent period (proportional Vimshottari).
  function subPeriods(parentLord, parentStartMs, parentLenMs) {
    var idx = VIM_ORDER.indexOf(parentLord);
    var out = [];
    var t = parentStartMs;
    for (var i = 0; i < 9; i++) {
      var lord = VIM_ORDER[(idx + i) % 9];
      var len = parentLenMs * VIM_YEARS[lord] / 120;
      out.push({ lord: lord, startMs: t, endMs: t + len });
      t += len;
    }
    return out;
  }

  function find(periods, targetMs) {
    for (var i = 0; i < periods.length; i++) {
      if (targetMs >= periods[i].startMs && targetMs < periods[i].endMs) return periods[i];
    }
    return periods[periods.length - 1];
  }

  /*
   * Compute current MD/AD/PD.
   *   jdBirth  : Julian Day (UT) of birth
   *   moonLon  : sidereal longitude of the Moon at birth (deg)
   *   targetMs : ms-epoch of the moment to evaluate (default Date.now())
   */
  function compute(jdBirth, moonLon, targetMs) {
    if (targetMs === undefined) targetMs = Date.now();
    var span = 360 / 27;
    var nakIdx = Math.floor(rev(moonLon) / span);
    var startLord = NAKSHATRAS[nakIdx][1];
    var posInNak = rev(moonLon) - nakIdx * span;
    var frac = posInNak / span;            // fraction of nakshatra already traversed
    var startIdx = VIM_ORDER.indexOf(startLord);

    var birthMs = jdToMs(jdBirth);
    var elapsedYears = frac * VIM_YEARS[startLord];
    var firstMdStart = birthMs - elapsedYears * YEAR_DAYS * DAY_MS; // virtual MD start

    // Build MDs spanning >120 years to safely contain the target.
    var mds = [];
    var t = firstMdStart;
    for (var i = 0; i < 11; i++) {
      var ml = VIM_ORDER[(startIdx + i) % 9];
      var len = VIM_YEARS[ml] * YEAR_DAYS * DAY_MS;
      mds.push({ lord: ml, startMs: t, endMs: t + len });
      t += len;
    }

    var md = find(mds, targetMs);
    var ads = subPeriods(md.lord, md.startMs, md.endMs - md.startMs);
    var ad = find(ads, targetMs);
    var pds = subPeriods(ad.lord, ad.startMs, ad.endMs - ad.startMs);
    var pd = find(pds, targetMs);

    // Balance of the starting dasha at birth (informational)
    var balanceYears = (1 - frac) * VIM_YEARS[startLord];

    return {
      startLord: startLord,
      startNakshatra: NAKSHATRAS[nakIdx][0],
      balanceYears: balanceYears,
      birthMs: birthMs,
      targetMs: targetMs,
      md: md, ad: ad, pd: pd,
      mdSequence: mds,
      adSequence: ads,
      pdSequence: pds
    };
  }

  function fmtDate(ms) {
    var d = new Date(ms);
    var mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return d.getUTCDate() + " " + mo[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }

  var api = { compute: compute, subPeriods: subPeriods, fmtDate: fmtDate };
  root.AHS = root.AHS || {};
  root.AHS.dasha = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
