/*
 * app.js -- UI wiring for the Astrological Health Screener.
 * Depends on (loaded first): AHS.ephemeris, AHS.core, AHS.data, AHS.parashara, AHS.kp
 */
(function () {
  "use strict";

  var core = window.AHS.core;
  var data = window.AHS.data;
  var parashara = window.AHS.parashara;
  var kp = window.AHS.kp;

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function fmtDeg(d) {
    var deg = Math.floor(d);
    var m = Math.round((d - deg) * 60);
    if (m === 60) { deg += 1; m = 0; }
    return deg + "\u00b0" + (m < 10 ? "0" : "") + m + "'";
  }

  /* ----------------- City geocoding (Open-Meteo, no key) ----------------- */
  function searchCity() {
    var q = $("city").value.trim();
    var list = $("city-results");
    if (!q) return;
    list.hidden = false;
    list.innerHTML = "<li>Searching\u2026</li>";
    fetch("https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&format=json&name=" + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        list.innerHTML = "";
        if (!j.results || !j.results.length) {
          list.innerHTML = "<li>No matches. Enter latitude/longitude manually.</li>";
          return;
        }
        j.results.forEach(function (place) {
          var label = [place.name, place.admin1, place.country].filter(Boolean).join(", ");
          var li = el("li", null, label + " <span class='hint'>(" + place.latitude.toFixed(2) + ", " + place.longitude.toFixed(2) + ")</span>");
          li.addEventListener("click", function () { selectPlace(place, label); list.hidden = true; });
          list.appendChild(li);
        });
      })
      .catch(function () {
        list.innerHTML = "<li>Lookup failed (offline?). Enter latitude/longitude manually.</li>";
      });
  }

  function selectPlace(place, label) {
    $("lat").value = place.latitude.toFixed(4);
    $("lon").value = place.longitude.toFixed(4);
    var tz = guessOffsetForZone(place.timezone, getDateFromForm());
    if (tz !== null) $("tz").value = tz;
    $("place-resolved").textContent = "Selected: " + label +
      (place.timezone ? " \u00b7 " + place.timezone : "") +
      (tz !== null ? " (UTC" + (tz >= 0 ? "+" : "") + tz + ")" : "");
  }

  // Estimate a zone's UTC offset (hours) for a given local date using Intl.
  function guessOffsetForZone(timeZone, date) {
    if (!timeZone || typeof Intl === "undefined") return null;
    try {
      var dtf = new Intl.DateTimeFormat("en-US", { timeZone: timeZone, timeZoneName: "longOffset" });
      var parts = dtf.formatToParts(date || new Date());
      var name = parts.find(function (p) { return p.type === "timeZoneName"; });
      if (!name) return null;
      var m = name.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (!m) return 0;
      var sign = m[1] === "-" ? -1 : 1;
      var h = parseInt(m[2], 10);
      var min = m[3] ? parseInt(m[3], 10) : 0;
      return sign * (h + min / 60);
    } catch (e) { return null; }
  }

  function getDateFromForm() {
    var dob = $("dob").value;
    if (!dob) return new Date();
    var parts = dob.split("-");
    return new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2], 12, 0, 0));
  }

  /* ----------------- Chart building ----------------- */
  function parseForm() {
    var dob = $("dob").value;
    var tob = $("unknown-time").checked ? "12:00" : $("tob").value;
    if (!dob || !tob) throw new Error("Please enter date and time of birth.");
    var dp = dob.split("-").map(Number);
    var tp = tob.split(":").map(Number);
    var lat = parseFloat($("lat").value);
    var lon = parseFloat($("lon").value);
    var tz = parseFloat($("tz").value);
    if (isNaN(lat) || isNaN(lon)) throw new Error("Please enter a valid latitude and longitude (or pick a city).");
    if (isNaN(tz)) throw new Error("Please enter the UTC offset in hours (e.g. 5.5 for India).");
    return {
      name: $("name").value.trim(),
      y: dp[0], mo: dp[1], d: dp[2], h: tp[0], mi: tp[1],
      lat: lat, lon: lon, tz: tz,
      unknownTime: $("unknown-time").checked
    };
  }

  function buildNatal(f) {
    var jd = core.julianDayLocal(f.y, f.mo, f.d, f.h, f.mi, f.tz);
    return core.buildChart({ jd: jd, latDeg: f.lat, lonEast: f.lon });
  }

  function buildTransit(natal) {
    // Current moment, same location (location only matters for transit ascendant; we
    // report planetary transits and their gochara through natal whole-sign houses).
    var now = new Date();
    var jd = core.julianDayUT(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(),
      now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
    var d = jd - 2451543.5;
    var ayan = core.lahiriAyanamsa(jd);
    var eph = window.AHS.ephemeris;
    var trop = eph.tropicalLongitudes(d);
    var out = {};
    core.BODIES.forEach(function (p) {
      out[p] = core.describe(core.toSidereal(trop[p], ayan));
    });
    return { when: now, planets: out, lagnaSignIndex: natal.lagnaSignIndex };
  }

  /* ----------------- Rendering ----------------- */
  function dignityBadge(planet, signIndex) {
    var dg = parashara.dignityOf(planet, signIndex);
    var cls = dg === "exalted" ? "exalted" : dg === "debilitated" ? "debilitated" :
      dg === "own sign" ? "own" : "neutral";
    return "<span class='badge " + cls + "'>" + dg + "</span>";
  }

  function renderNatalTable(chart, f) {
    var tbody = $("natal-table").querySelector("tbody");
    tbody.innerHTML = "";
    // Ascendant row
    if (!f.unknownTime) {
      var a = chart.ascendant;
      var ar = el("tr", null,
        "<td><strong>Ascendant</strong></td><td>" + a.sign + "</td><td>" + fmtDeg(a.degInSign) +
        "</td><td>" + a.nakshatra + "</td><td>" + a.pada + "</td><td>" + a.subLord +
        "</td><td>1</td><td>1</td><td>&mdash;</td>");
      tbody.appendChild(ar);
    }
    core.BODIES.forEach(function (p) {
      var d = chart.planets[p];
      var tr = el("tr", null,
        "<td>" + p + "</td><td>" + d.sign + "</td><td>" + fmtDeg(d.degInSign) +
        "</td><td>" + d.nakshatra + "</td><td>" + d.pada + "</td><td>" + d.subLord +
        "</td><td>" + (f.unknownTime ? "&mdash;" : d.placidusHouse) +
        "</td><td>" + (f.unknownTime ? "&mdash;" : d.wholeSignHouse) +
        "</td><td>" + dignityBadge(p, d.signIndex) + "</td>");
      tbody.appendChild(tr);
    });
    $("chart-asc").textContent = f.unknownTime ? "(birth time unknown \u2014 houses omitted)" :
      "Ascendant: " + chart.ascendant.sign + " " + fmtDeg(chart.ascendant.degInSign);
  }

  function renderTransits(transit, natal, f) {
    var tbody = $("transit-table").querySelector("tbody");
    tbody.innerHTML = "";
    var flags = [];
    core.BODIES.forEach(function (p) {
      var d = transit.planets[p];
      var gh = core.wholeSignHouse(d.signIndex, natal.lagnaSignIndex);
      var rowCls = ([6, 8, 12].indexOf(gh) >= 0) ? "style='color:var(--amber)'" : "";
      var tr = el("tr", null,
        "<td " + rowCls + ">" + p + "</td><td>" + d.sign + "</td><td>" + fmtDeg(d.degInSign) +
        "</td><td>" + d.nakshatra + "</td><td>" + d.subLord + "</td><td>" + gh + "</td>");
      tbody.appendChild(tr);
      if (["Saturn", "Rahu", "Ketu", "Mars"].indexOf(p) >= 0 && [6, 8, 12, 1].indexOf(gh) >= 0) {
        flags.push(p + " is transiting your natal house " + gh +
          (gh === 1 ? " (Ascendant/body)" : " (a health-sensitive house)") + ".");
      }
      // transit over natal Moon sign (Sade Sati style note for Saturn)
      if (p === "Saturn") {
        var moonSign = natal.planets.Moon.signIndex;
        var diff = ((d.signIndex - moonSign + 12) % 12);
        if (diff === 11 || diff === 0 || diff === 1) {
          flags.push("Saturn is transiting around your natal Moon sign (Sade Sati phase) \u2014 a classically demanding period for stamina and stress.");
        }
      }
    });
    $("transit-time").textContent = "as of " + transit.when.toLocaleString();
    var fc = $("transit-flags");
    fc.innerHTML = flags.length ? "<h4>Transit highlights</h4>" : "";
    flags.forEach(function (t) { fc.appendChild(el("span", "flag", t)); });
  }

  function renderFinding(f) {
    var div = el("div", "finding " + f.severity);
    div.appendChild(el("h4", null, f.area + " <span class='sev-tag " + f.severity + "'>" + f.severity + "</span>"));
    div.appendChild(el("p", null, f.basis));
    if (f.bodyParts && f.bodyParts.length) {
      var bp = el("div", "bodyparts");
      bp.appendChild(el("span", null, "<strong>Areas indicated:</strong> "));
      f.bodyParts.forEach(function (b) { bp.appendChild(el("span", "chip", b)); });
      div.appendChild(bp);
    }
    return div;
  }

  function renderParashara(r) {
    var c = $("parashara-out");
    c.innerHTML = "<h3>Parashara Health Analysis</h3>";
    c.appendChild(el("div", "summary-box", r.summary));
    if (r.findings.length) {
      c.appendChild(el("h4", null, "Areas to monitor"));
      r.findings.forEach(function (f) { c.appendChild(renderFinding(f)); });
    }
    if (r.supportive.length) {
      var sup = el("div", "finding supportive");
      sup.appendChild(el("h4", null, "Supportive factors"));
      var ul = el("ul");
      r.supportive.forEach(function (s) { ul.appendChild(el("li", null, s)); });
      sup.appendChild(ul);
      c.appendChild(sup);
    }
  }

  function renderKP(r) {
    var c = $("kp-out");
    c.innerHTML = "<h3>KP (Krishnamurti Paddhati) Health Analysis</h3>";
    c.appendChild(el("div", "summary-box", r.summary));

    c.appendChild(el("h4", null, "Cuspal sub-lord verdicts"));
    r.cuspReports.forEach(function (cr) {
      var div = el("div", "finding " + cr.severity);
      div.appendChild(el("h4", null, cr.label + " <span class='sev-tag " + cr.severity + "'>" + cr.severity + "</span>"));
      div.appendChild(el("p", null, "Sub-lord: <strong>" + cr.subLord + "</strong> &middot; signifies houses [" +
        cr.signifies.join(", ") + "]<br>" + cr.verdict + "."));
      c.appendChild(div);
    });

    if (r.findings.length) {
      c.appendChild(el("h4", null, "Significators of disease houses (6 / 8 / 12)"));
      r.findings.forEach(function (f) { c.appendChild(renderFinding(f)); });
    }
  }

  /* ----------------- Orchestration ----------------- */
  function run(e) {
    if (e) e.preventDefault();
    var err = $("form-error");
    err.hidden = true;
    try {
      var f = parseForm();
      var natal = buildNatal(f);
      var transit = buildTransit(natal);
      var parRes = parashara.analyze(natal);
      var kpRes = kp.analyze(natal);

      $("overview-meta").textContent =
        (f.name ? f.name + " \u2014 " : "") +
        f.d + "/" + f.mo + "/" + f.y + " at " + pad(f.h) + ":" + pad(f.mi) +
        " (UTC" + (f.tz >= 0 ? "+" : "") + f.tz + ") \u00b7 " +
        f.lat.toFixed(2) + "\u00b0, " + f.lon.toFixed(2) + "\u00b0 \u00b7 Ayanamsa " + natal.ayanamsa.toFixed(3) + "\u00b0";
      $("par-score").textContent = f.unknownTime ? "n/a*" : parRes.score;
      $("kp-score").textContent = f.unknownTime ? "n/a*" : kpRes.score;

      renderNatalTable(natal, f);
      renderTransits(transit, natal, f);

      if (f.unknownTime) {
        $("parashara-out").innerHTML = "<h3>Parashara Health Analysis</h3><p class='hint'>House-based analysis needs a birth time. Enter the time of birth to enable the full Parashara &amp; KP screening. Planetary sign/nakshatra placements above are still valid.</p>";
        $("kp-out").innerHTML = "<h3>KP Health Analysis</h3><p class='hint'>KP relies on house cusps, which require an accurate birth time.</p>";
      } else {
        renderParashara(parRes);
        renderKP(kpRes);
      }

      $("results").hidden = false;
      $("results").scrollIntoView({ behavior: "smooth" });
    } catch (ex) {
      err.textContent = ex.message || String(ex);
      err.hidden = false;
    }
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function loadSample() {
    $("name").value = "Sample Native";
    $("dob").value = "1990-08-15";
    $("tob").value = "14:30";
    $("unknown-time").checked = false;
    $("lat").value = "18.9600";
    $("lon").value = "72.8200";
    $("tz").value = "5.5";
    $("place-resolved").textContent = "Selected: Mumbai, Maharashtra, India \u00b7 Asia/Kolkata (UTC+5.5)";
  }

  function initTabs() {
    document.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () {
        document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("active"); });
        document.querySelectorAll(".tab-panel").forEach(function (x) { x.classList.remove("active"); });
        t.classList.add("active");
        $("tab-" + t.dataset.tab).classList.add("active");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("birth-form").addEventListener("submit", run);
    $("city-btn").addEventListener("click", searchCity);
    $("city").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); searchCity(); } });
    $("sample-btn").addEventListener("click", loadSample);
    $("unknown-time").addEventListener("change", function () {
      $("tob").disabled = this.checked;
    });
    initTabs();
  });
})();
