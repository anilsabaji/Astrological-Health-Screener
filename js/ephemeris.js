/*
 * ephemeris.js
 * Geocentric ecliptic longitudes (TROPICAL) for Sun, Moon, Mercury..Saturn and
 * the lunar nodes (Rahu/Ketu), using Paul Schlyter's compact orbital-element
 * method with the major perturbation terms for the Moon, Jupiter and Saturn.
 *
 * Accuracy: ~1-2 arc minutes for Sun/Moon and inner planets, a few arc minutes
 * for Jupiter/Saturn -- more than enough to determine rasi (sign), nakshatra and
 * KP sub-divisions reliably.
 *
 * Reference method: Paul Schlyter, "Computing planetary positions"
 * (https://stjarnhimlen.se/comp/ppcomp.html). Algorithm re-implemented here;
 * no source text reproduced.
 *
 * Works in the browser (attaches to window.AHS) and in Node (module.exports).
 */
(function (root) {
  "use strict";

  var DEG = Math.PI / 180;
  var RAD = 180 / Math.PI;

  function rev(x) { // normalize to 0..360
    x = x % 360;
    return x < 0 ? x + 360 : x;
  }
  function sind(x) { return Math.sin(x * DEG); }
  function cosd(x) { return Math.cos(x * DEG); }
  function tand(x) { return Math.tan(x * DEG); }
  function asind(x) { return Math.asin(x) * RAD; }
  function atan2d(y, x) { return Math.atan2(y, x) * RAD; }

  // Solve Kepler's equation, returns eccentric anomaly E (deg)
  function kepler(M, e) {
    M = rev(M);
    var E = M + e * RAD * sind(M) * (1 + e * cosd(M));
    var delta;
    var i = 0;
    do {
      var E0 = E;
      delta = (E0 - e * RAD * sind(E0) - M) / (1 - e * cosd(E0));
      E = E0 - delta;
      i++;
    } while (Math.abs(delta) > 1e-7 && i < 100);
    return E;
  }

  /*
   * Orbital elements as a function of d = days since 2000 Jan 0.0 TT
   * (i.e. d = JD - 2451543.5).
   */
  function elements(d) {
    return {
      Sun: {
        N: 0.0, i: 0.0,
        w: 282.9404 + 4.70935e-5 * d,
        a: 1.0,
        e: 0.016709 - 1.151e-9 * d,
        M: 356.0470 + 0.9856002585 * d
      },
      Moon: {
        N: 125.1228 - 0.0529538083 * d, i: 5.1454,
        w: 318.0634 + 0.1643573223 * d,
        a: 60.2666, // Earth radii
        e: 0.054900,
        M: 115.3654 + 13.0649929509 * d
      },
      Mercury: {
        N: 48.3313 + 3.24587e-5 * d, i: 7.0047 + 5.00e-8 * d,
        w: 29.1241 + 1.01444e-5 * d,
        a: 0.387098,
        e: 0.205635 + 5.59e-10 * d,
        M: 168.6562 + 4.0923344368 * d
      },
      Venus: {
        N: 76.6799 + 2.46590e-5 * d, i: 3.3946 + 2.75e-8 * d,
        w: 54.8910 + 1.38374e-5 * d,
        a: 0.723330,
        e: 0.006773 - 1.302e-9 * d,
        M: 48.0052 + 1.6021302244 * d
      },
      Mars: {
        N: 49.5574 + 2.11081e-5 * d, i: 1.8497 - 1.78e-8 * d,
        w: 286.5016 + 2.92961e-5 * d,
        a: 1.523688,
        e: 0.093405 + 2.516e-9 * d,
        M: 18.6021 + 0.5240207766 * d
      },
      Jupiter: {
        N: 100.4542 + 2.76854e-5 * d, i: 1.3030 - 1.557e-7 * d,
        w: 273.8777 + 1.64505e-5 * d,
        a: 5.20256,
        e: 0.048498 + 4.469e-9 * d,
        M: 19.8950 + 0.0830853001 * d
      },
      Saturn: {
        N: 113.6634 + 2.38980e-5 * d, i: 2.4886 - 1.081e-7 * d,
        w: 339.3939 + 2.97661e-5 * d,
        a: 9.55475,
        e: 0.055546 - 9.499e-9 * d,
        M: 316.9670 + 0.0334442282 * d
      }
    };
  }

  // Heliocentric rectangular ecliptic coords for a planet element set.
  function helioRect(el) {
    var E = kepler(el.M, el.e);
    var xv = el.a * (cosd(E) - el.e);
    var yv = el.a * Math.sqrt(1 - el.e * el.e) * sind(E);
    var v = atan2d(yv, xv);
    var r = Math.sqrt(xv * xv + yv * yv);
    var vw = v + el.w;
    var xh = r * (cosd(el.N) * cosd(vw) - sind(el.N) * sind(vw) * cosd(el.i));
    var yh = r * (sind(el.N) * cosd(vw) + cosd(el.N) * sind(vw) * cosd(el.i));
    var zh = r * (sind(vw) * sind(el.i));
    return { x: xh, y: yh, z: zh, r: r, v: v };
  }

  /*
   * Returns an object keyed by planet name with TROPICAL geocentric ecliptic
   * longitude in degrees [0,360), plus Rahu/Ketu (mean lunar nodes).
   *   d : days since 2000 Jan 0.0 = JD - 2451543.5
   */
  function tropicalLongitudes(d) {
    var el = elements(d);
    var out = {};

    // --- Sun (geocentric == its own orbit longitude) ---
    var sun = helioRect(el.Sun);
    var lonsun = rev(sun.v + el.Sun.w);
    var rs = sun.r;
    out.Sun = rev(lonsun);
    var xs = rs * cosd(lonsun);
    var ys = rs * sind(lonsun);

    // --- Moon (geocentric) with main perturbations ---
    var moon = helioRect(el.Moon);
    var mlon = atan2d(moon.y, moon.x);
    var mlat = atan2d(moon.z, Math.sqrt(moon.x * moon.x + moon.y * moon.y));

    var Ms = el.Sun.M, Mm = el.Moon.M;
    var Ls = rev(Ms + el.Sun.w);            // Sun mean longitude
    var Lm = rev(Mm + el.Moon.w + el.Moon.N); // Moon mean longitude
    var D = rev(Lm - Ls);                    // mean elongation
    var F = rev(Lm - el.Moon.N);             // argument of latitude

    var dLon =
      -1.274 * sind(Mm - 2 * D) +
      0.658 * sind(2 * D) +
      -0.186 * sind(Ms) +
      -0.059 * sind(2 * Mm - 2 * D) +
      -0.057 * sind(Mm - 2 * D + Ms) +
      0.053 * sind(Mm + 2 * D) +
      0.046 * sind(2 * D - Ms) +
      0.041 * sind(Mm - Ms) +
      -0.035 * sind(D) +
      -0.031 * sind(Mm + Ms) +
      -0.015 * sind(2 * F - 2 * D) +
      0.011 * sind(Mm - 4 * D);
    mlon = rev(mlon + dLon);
    out.Moon = mlon;

    // --- Planets: heliocentric -> geocentric ---
    var planets = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
    var rect = {};
    for (var p = 0; p < planets.length; p++) {
      rect[planets[p]] = helioRect(el[planets[p]]);
    }

    // Perturbations for Jupiter & Saturn (mutual), using mean anomalies.
    var Mj = el.Jupiter.M, Msa = el.Saturn.M;
    var pertJ =
      -0.332 * sind(2 * Mj - 5 * Msa - 67.6) +
      -0.056 * sind(2 * Mj - 2 * Msa + 21) +
      0.042 * sind(3 * Mj - 5 * Msa + 21) +
      -0.036 * sind(Mj - 2 * Msa) +
      0.022 * cosd(Mj - Msa) +
      0.023 * sind(2 * Mj - 3 * Msa + 52) +
      -0.016 * sind(Mj - 5 * Msa - 69);
    var pertS =
      0.812 * sind(2 * Mj - 5 * Msa - 67.6) +
      -0.229 * cosd(2 * Mj - 4 * Msa - 2) +
      0.119 * sind(Mj - 2 * Msa - 3) +
      0.046 * sind(2 * Mj - 6 * Msa - 69) +
      0.014 * sind(Mj - 3 * Msa + 32);

    for (var k = 0; k < planets.length; k++) {
      var name = planets[k];
      var rc = rect[name];
      var xg = rc.x + xs;
      var yg = rc.y + ys;
      var zg = rc.z;
      var lon = rev(atan2d(yg, xg));
      if (name === "Jupiter") lon = rev(lon + pertJ);
      if (name === "Saturn") lon = rev(lon + pertS);
      out[name] = lon;
    }

    // --- Lunar nodes (mean) ---
    var rahu = rev(el.Moon.N); // mean ascending node longitude
    out.Rahu = rahu;
    out.Ketu = rev(rahu + 180);

    return out;
  }

  // Obliquity of the ecliptic (deg) for days since 2000 Jan 0.0
  function obliquity(d) {
    return 23.4393 - 3.563e-7 * d;
  }

  var api = {
    tropicalLongitudes: tropicalLongitudes,
    obliquity: obliquity,
    rev: rev,
    _kepler: kepler,
    _elements: elements
  };

  root.AHS = root.AHS || {};
  root.AHS.ephemeris = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
