/*
 * astro-core.js
 * Core Vedic/KP astrology computations built on top of ephemeris.js:
 *   - Julian Day from local date/time + timezone
 *   - Lahiri (Chitrapaksha) ayanamsa and tropical->sidereal conversion
 *   - Nakshatra + pada
 *   - KP sub-lord (Vimshottari 249 sub-division)
 *   - Sidereal Ascendant (Lagna)
 *   - Placidus house cusps (used by KP)
 *   - Whole-sign house assignment (used by Parashara)
 *
 * Works in the browser (window.AHS) and Node (module.exports).
 */
(function (root) {
  "use strict";

  var eph = (typeof require !== "undefined")
    ? require("./ephemeris.js")
    : root.AHS.ephemeris;

  var DEG = Math.PI / 180, RAD = 180 / Math.PI;
  function rev(x) { x = x % 360; return x < 0 ? x + 360 : x; }
  function sind(x) { return Math.sin(x * DEG); }
  function cosd(x) { return Math.cos(x * DEG); }
  function tand(x) { return Math.tan(x * DEG); }
  function atan2d(y, x) { return Math.atan2(y, x) * RAD; }
  function asind(x) { return Math.asin(Math.max(-1, Math.min(1, x))) * RAD; }
  function acosd(x) { return Math.acos(Math.max(-1, Math.min(1, x))) * RAD; }

  var SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];

  // Sign lords (rulers) -- traditional (no outer planets)
  var SIGN_LORD = ["Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury",
    "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter"];

  // 27 Nakshatras with their Vimshottari lords
  var NAKSHATRAS = [
    ["Ashwini", "Ketu"], ["Bharani", "Venus"], ["Krittika", "Sun"],
    ["Rohini", "Moon"], ["Mrigashira", "Mars"], ["Ardra", "Rahu"],
    ["Punarvasu", "Jupiter"], ["Pushya", "Saturn"], ["Ashlesha", "Mercury"],
    ["Magha", "Ketu"], ["Purva Phalguni", "Venus"], ["Uttara Phalguni", "Sun"],
    ["Hasta", "Moon"], ["Chitra", "Mars"], ["Swati", "Rahu"],
    ["Vishakha", "Jupiter"], ["Anuradha", "Saturn"], ["Jyeshtha", "Mercury"],
    ["Mula", "Ketu"], ["Purva Ashadha", "Venus"], ["Uttara Ashadha", "Sun"],
    ["Shravana", "Moon"], ["Dhanishta", "Mars"], ["Shatabhisha", "Rahu"],
    ["Purva Bhadrapada", "Jupiter"], ["Uttara Bhadrapada", "Saturn"], ["Revati", "Mercury"]
  ];

  // Vimshottari dasha order and years (sum 120)
  var VIM_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
  var VIM_YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };

  /* ---------- Time ---------- */
  // Gregorian date/time (UT) -> Julian Day
  function julianDayUT(y, mo, d, hour, min, sec) {
    hour = hour || 0; min = min || 0; sec = sec || 0;
    var a = Math.floor((14 - mo) / 12);
    var yy = y + 4800 - a;
    var mm = mo + 12 * a - 3;
    var jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy +
      Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
    var frac = (hour - 12) / 24 + min / 1440 + sec / 86400;
    return jdn + frac;
  }

  // Local civil date/time + timezone offset (hours, east +) -> JD (UT)
  function julianDayLocal(y, mo, d, hour, min, tzOffsetHours) {
    var jdLocalNoonRef = julianDayUT(y, mo, d, hour, min, 0);
    return jdLocalNoonRef - tzOffsetHours / 24;
  }

  /* ---------- Ayanamsa (Lahiri / Chitrapaksha) ---------- */
  // J2000.0 value 23deg51'11" with precession ~50.29"/yr.
  function lahiriAyanamsa(jd) {
    var T = (jd - 2451545.0) / 36525.0; // Julian centuries from J2000
    return 23.85234 + 1.396971 * T + 0.0003086 * T * T;
  }

  function toSidereal(tropLon, ayan) {
    return rev(tropLon - ayan);
  }

  /* ---------- Sign / Nakshatra / Sub-lord ---------- */
  function signInfo(siderealLon) {
    var idx = Math.floor(rev(siderealLon) / 30);
    return {
      index: idx,
      name: SIGNS[idx],
      lord: SIGN_LORD[idx],
      degInSign: rev(siderealLon) - idx * 30
    };
  }

  function nakshatraInfo(siderealLon) {
    var lon = rev(siderealLon);
    var span = 360 / 27; // 13.3333
    var idx = Math.floor(lon / span);
    var pada = Math.floor((lon - idx * span) / (span / 4)) + 1;
    return {
      index: idx,
      name: NAKSHATRAS[idx][0],
      lord: NAKSHATRAS[idx][1],
      pada: pada
    };
  }

  /*
   * KP sub-lord: subdivide the nakshatra (13deg20') into 9 unequal parts in
   * Vimshottari proportion, starting from the nakshatra (star) lord.
   */
  function subLord(siderealLon) {
    var lon = rev(siderealLon);
    var span = 360 / 27;
    var nakIdx = Math.floor(lon / span);
    var posInNak = lon - nakIdx * span; // 0..13.3333
    var starLord = NAKSHATRAS[nakIdx][1];
    var startPos = VIM_ORDER.indexOf(starLord);
    var acc = 0;
    for (var k = 0; k < 9; k++) {
      var lord = VIM_ORDER[(startPos + k) % 9];
      var subSpan = (VIM_YEARS[lord] / 120) * span;
      if (posInNak < acc + subSpan || k === 8) {
        return { lord: lord, starLord: starLord };
      }
      acc += subSpan;
    }
    return { lord: starLord, starLord: starLord };
  }

  // Full placement descriptor for a sidereal longitude
  function describe(siderealLon) {
    var s = signInfo(siderealLon);
    var n = nakshatraInfo(siderealLon);
    var sub = subLord(siderealLon);
    return {
      lon: rev(siderealLon),
      sign: s.name, signIndex: s.index, signLord: s.lord, degInSign: s.degInSign,
      nakshatra: n.name, nakshatraLord: n.lord, pada: n.pada,
      subLord: sub.lord
    };
  }

  /* ---------- Ascendant & Houses ---------- */
  // Greenwich Mean Sidereal Time in degrees
  function gmstDeg(jd) {
    return rev(280.46061837 + 360.98564736629 * (jd - 2451545.0));
  }

  // Local Sidereal Time (= RAMC) in degrees; lonEast positive
  function ramcDeg(jd, lonEast) {
    return rev(gmstDeg(jd) + lonEast);
  }

  // TROPICAL ascendant longitude (deg)
  function tropicalAscendant(ramc, latDeg, eps) {
    var asc = rev(atan2d(
      cosd(ramc),
      -(sind(ramc) * cosd(eps) + tand(latDeg) * sind(eps))
    ));
    // The ascendant must lie on the eastern horizon, i.e. between the MC and
    // the IC going eastward: rev(Asc - MC) must be in (0,180).
    var mc = rev(atan2d(sind(ramc), cosd(ramc) * cosd(eps)));
    if (Math.abs(wrap180(mc - ramc)) > 90) mc = rev(mc + 180);
    if (rev(asc - mc) >= 180) asc = rev(asc + 180);
    return asc;
  }

  // RA from ecliptic longitude (point on ecliptic, lat=0)
  function raFromLon(lon, eps) { return rev(atan2d(sind(lon) * cosd(eps), cosd(lon))); }
  // declination from ecliptic longitude
  function decFromLon(lon, eps) { return asind(sind(eps) * sind(lon)); }
  function wrap180(x) { x = rev(x); return x > 180 ? x - 360 : x; }

  /*
   * Placidus intermediate cusps (11, 12, 2, 3) via semi-arc trisection.
   * Returns tropical ecliptic longitude for the requested house number.
   */
  function placidusCusp(houseNo, ramc, latDeg, eps) {
    // target hour-angle as a function of the point's own semi-diurnal arc (SDA)
    function targetHA(sda) {
      switch (houseNo) {
        case 11: return -sda / 3;
        case 12: return -2 * sda / 3;
        case 2: return -(2 * sda / 3 + 60);
        case 3: return -(sda / 3 + 120);
      }
    }
    var offset = { 11: 30, 12: 60, 2: 120, 3: 150 }[houseNo];
    var lon = rev(ramc + offset); // initial guess
    for (var iter = 0; iter < 50; iter++) {
      var dec = decFromLon(lon, eps);
      var x = -tand(latDeg) * tand(dec);
      var sda = (x <= -1) ? 180 : (x >= 1) ? 0 : acosd(x);
      var raTarget = rev(ramc - targetHA(sda));
      var lonNew = atan2d(sind(raTarget), cosd(raTarget) * cosd(eps));
      lonNew = rev(lonNew);
      // keep on same side as raTarget
      if (Math.abs(wrap180(lonNew - raTarget)) > 90) lonNew = rev(lonNew + 180);
      if (Math.abs(wrap180(lonNew - lon)) < 1e-7) { lon = lonNew; break; }
      lon = lonNew;
    }
    return rev(lon);
  }

  /*
   * Full set of 12 Placidus cusps (tropical). Returns array of 12 longitudes,
   * cusps[0] = 1st house cusp (Ascendant), cusps[9] = 10th (MC).
   */
  function placidusCusps(ramc, latDeg, eps) {
    var asc = tropicalAscendant(ramc, latDeg, eps);
    var mc = rev(atan2d(sind(ramc), cosd(ramc) * cosd(eps)));
    // MC should be near RAMC region
    if (Math.abs(wrap180(mc - ramc)) > 90) mc = rev(mc + 180);

    var c = new Array(12);
    c[0] = asc;            // 1
    c[9] = mc;             // 10
    c[10] = placidusCusp(11, ramc, latDeg, eps);
    c[11] = placidusCusp(12, ramc, latDeg, eps);
    c[1] = placidusCusp(2, ramc, latDeg, eps);
    c[2] = placidusCusp(3, ramc, latDeg, eps);
    // opposite cusps are 180 apart
    c[3] = rev(c[9] + 180);  // 4 = IC
    c[4] = rev(c[10] + 180); // 5
    c[5] = rev(c[11] + 180); // 6
    c[6] = rev(c[0] + 180);  // 7
    c[7] = rev(c[1] + 180);  // 8
    c[8] = rev(c[2] + 180);  // 9
    return c;
  }

  // Assign a body to a house given cusp longitudes (KP/Placidus, sidereal in & cusps).
  function houseOf(lon, cusps) {
    lon = rev(lon);
    for (var i = 0; i < 12; i++) {
      var start = cusps[i];
      var end = cusps[(i + 1) % 12];
      var span = rev(end - start);
      var rel = rev(lon - start);
      if (rel < span) return i + 1;
    }
    return 1;
  }

  // Whole-sign house number for Parashara: house = sign offset from lagna sign + 1
  function wholeSignHouse(signIndex, lagnaSignIndex) {
    return ((signIndex - lagnaSignIndex + 12) % 12) + 1;
  }

  /* ---------- Top-level chart builder ---------- */
  var BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu"];

  /*
   * Build a complete chart.
   *   opts: { jd, latDeg, lonEast }
   * Returns { jd, ayanamsa, ascendant, planets:{name:desc}, cusps[], ... }
   */
  function buildChart(opts) {
    var jd = opts.jd;
    var d = jd - 2451543.5;
    var ayan = lahiriAyanamsa(jd);
    var eps = eph.obliquity(d);
    var trop = eph.tropicalLongitudes(d);

    var planets = {};
    for (var i = 0; i < BODIES.length; i++) {
      var nm = BODIES[i];
      var sid = toSidereal(trop[nm], ayan);
      planets[nm] = describe(sid);
    }

    var ramc = ramcDeg(jd, opts.lonEast);
    var ascTrop = tropicalAscendant(ramc, opts.latDeg, eps);
    var ascSid = toSidereal(ascTrop, ayan);
    var ascDesc = describe(ascSid);

    // Placidus cusps (sidereal) for KP
    var cuspsTrop = placidusCusps(ramc, opts.latDeg, eps);
    var cuspsSid = cuspsTrop.map(function (c) { return toSidereal(c, ayan); });
    var cuspDesc = cuspsSid.map(function (c) { return describe(c); });

    var lagnaSignIndex = ascDesc.signIndex;

    // Assign houses
    for (var b in planets) {
      planets[b].wholeSignHouse = wholeSignHouse(planets[b].signIndex, lagnaSignIndex);
      planets[b].placidusHouse = houseOf(planets[b].lon, cuspsSid);
    }

    return {
      jd: jd,
      ayanamsa: ayan,
      obliquity: eps,
      ramc: ramc,
      ascendant: ascDesc,
      lagnaSignIndex: lagnaSignIndex,
      planets: planets,
      cuspsSidereal: cuspsSid,
      cusps: cuspDesc
    };
  }

  var api = {
    SIGNS: SIGNS, SIGN_LORD: SIGN_LORD, NAKSHATRAS: NAKSHATRAS,
    VIM_ORDER: VIM_ORDER, VIM_YEARS: VIM_YEARS, BODIES: BODIES,
    rev: rev,
    julianDayUT: julianDayUT,
    julianDayLocal: julianDayLocal,
    lahiriAyanamsa: lahiriAyanamsa,
    toSidereal: toSidereal,
    signInfo: signInfo,
    nakshatraInfo: nakshatraInfo,
    subLord: subLord,
    describe: describe,
    gmstDeg: gmstDeg,
    ramcDeg: ramcDeg,
    tropicalAscendant: tropicalAscendant,
    placidusCusps: placidusCusps,
    houseOf: houseOf,
    wholeSignHouse: wholeSignHouse,
    buildChart: buildChart
  };

  root.AHS = root.AHS || {};
  root.AHS.core = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
