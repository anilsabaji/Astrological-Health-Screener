/*
 * accident.js
 * Health risk from ACCIDENTS, INJURIES and SUDDEN events.
 *
 * Natal "promise" of accidents (classical indicators):
 *   - Mars linked (conjunction/aspect) with Rahu, Ketu or Saturn (accident yogas)
 *   - Mars / Rahu / Ketu / Saturn afflicting the Ascendant, its lord, and houses
 *     1 (body), 4 (vehicles), 6 (injuries), 8 (sudden harm / surgery)
 *   - Malefics in the 8th / 6th; 8th lord in a dusthana
 *   - D6 (health chart) Mars / Rahu / Ketu in houses 1 / 6 / 8
 *   - KP: the 8th cuspal sub-lord (a malefic) signifying disease houses
 *
 * Timing (triggers): dasha periods and transits of Mars / Rahu / Ketu / Saturn
 * (and the 6th/8th lords). Severity rises when a trigger activates the promise.
 *
 * Works in browser (window.AHS.accident) and Node.
 */
(function (root) {
  "use strict";

  var R = (typeof require !== "undefined");
  var core = R ? require("./astro-core.js") : root.AHS.core;
  var data = R ? require("./data.js") : root.AHS.data;
  var parashara = R ? require("./parashara.js") : root.AHS.parashara;
  var kp = R ? require("./kp.js") : root.AHS.kp;
  var dasha = R ? require("./dasha.js") : root.AHS.dasha;

  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  function inter(a, b) { return a.filter(function (x) { return b.indexOf(x) >= 0; }); }

  /*
   * analyze(chart, opts)
   *   opts = { d6, timeline, transit, maraka, nowMs }
   */
  function analyze(chart, opts) {
    opts = opts || {};
    var hl = parashara.houseLords(chart.lagnaSignIndex);
    function H(p) { return chart.planets[p].wholeSignHouse; }
    function aspects(a, b) { return parashara.aspectsFrom(a, H(a)).indexOf(H(b)) >= 0; }
    function aspectsHouse(a, houseNum) { return parashara.aspectsFrom(a, H(a)).indexOf(houseNum) >= 0; }
    function linked(a, b) { return H(a) === H(b) || aspects(a, b) || aspects(b, a); }

    var malefics = ["Mars", "Saturn", "Rahu", "Ketu", "Sun"];
    var score = 0, factors = [], vehicular = false;
    function add(w, text) { score += w; factors.push(text); }

    // Mars-Rahu / Mars-Ketu / Mars-Saturn accident yogas
    if (linked("Mars", "Rahu")) add(2.5, "Mars linked with Rahu \u2014 sudden accidents, explosions, electrical/vehicular injury");
    if (linked("Mars", "Ketu")) add(2.5, "Mars linked with Ketu \u2014 cuts, wounds, sudden injuries, surgery");
    if (linked("Mars", "Saturn")) add(2.2, "Mars linked with Saturn \u2014 falls, fractures, crushing injuries");

    // Mars in a dusthana
    if ([6, 8, 12].indexOf(H("Mars")) >= 0) add(1.5, "Mars in dusthana house " + H("Mars") + " (injury-prone)");

    // Rahu / Ketu in body/vehicle/sudden houses
    [["Rahu", H("Rahu")], ["Ketu", H("Ketu")]].forEach(function (x) {
      if ([1, 4, 8].indexOf(x[1]) >= 0) add(1.2, x[0] + " in house " + x[1] + " (sudden/violent events)");
      if (x[1] === 4) vehicular = true;
    });

    // 8th house (sudden harm / surgery)
    var occ8 = malefics.filter(function (p) { return H(p) === 8; });
    if (occ8.length) add(occ8.length * 1.0, "8th house occupied by malefic(s) " + occ8.join(", ") + " (accidents/surgery)");
    // 6th house (injuries)
    var occ6 = malefics.filter(function (p) { return H(p) === 6; });
    if (occ6.length) add(occ6.length * 0.8, "6th house occupied by malefic(s) " + occ6.join(", ") + " (injuries)");

    // Ascendant & Lagna lord afflicted
    var lagnaLord = hl.houseToLord[1];
    ["Mars", "Saturn", "Rahu", "Ketu"].forEach(function (m) {
      if (H(m) === 1 || aspectsHouse(m, 1)) add(0.8, m + " afflicts the Ascendant (the body)");
      if (m !== lagnaLord && linked(m, lagnaLord)) add(0.7, m + " afflicts the Lagna lord " + lagnaLord);
    });

    // 4th house (vehicles)
    var mal4 = malefics.filter(function (p) { return H(p) === 4; });
    if (mal4.length) { add(mal4.length * 0.8, "4th house (vehicles) afflicted by " + mal4.join(", ") + " \u2014 vehicular risk"); vehicular = true; }

    // 8th lord in dusthana
    var l8 = hl.houseToLord[8];
    if ([6, 8, 12].indexOf(H(l8)) >= 0) add(0.8, "8th lord " + l8 + " in dusthana house " + H(l8));

    // D6 health chart
    if (opts.d6) {
      ["Mars", "Rahu", "Ketu"].forEach(function (p) {
        var h = opts.d6.planets[p].house;
        if ([1, 6, 8].indexOf(h) >= 0) add(0.7, p + " in D6 house " + h + " (health chart)");
      });
    }

    // KP 8th cuspal sub-lord
    var sub8 = chart.cusps[7].subLord;
    if (["Mars", "Rahu", "Ketu", "Saturn"].indexOf(sub8) >= 0) {
      var sig = kp.planetSignifications(chart, sub8);
      if (inter(sig.all, [6, 8, 12]).length) add(1.0, "8th cuspal sub-lord " + sub8 + " signifies disease houses (KP)");
    }

    // ---- level ----
    var level, levelClass;
    if (score >= 7) { level = "High"; levelClass = "high"; }
    else if (score >= 4.5) { level = "Elevated"; levelClass = "high"; }
    else if (score >= 2.5) { level = "Moderate"; levelClass = "moderate"; }
    else { level = "Low"; levelClass = "low"; }

    // ---- likely nature ----
    var types = [];
    if (linked("Mars", "Saturn") || H("Saturn") === 1 || H("Saturn") === 8) types.push("falls / fractures / crush injuries");
    if (linked("Mars", "Rahu") || linked("Mars", "Ketu")) types.push("cuts, burns, sudden trauma, surgery");
    if (vehicular) types.push("vehicular / road accidents");
    if (H("Rahu") === 8 || H("Ketu") === 8) types.push("poisoning / electrical / mysterious harm");
    if (!types.length) types.push("minor injuries / strains");

    // ---- body areas ----
    var body = ["head & brain", "blood", "bones & joints", "muscles"];
    var lagnaBody = data.SIGN_BODY[chart.lagnaSignIndex] || [];
    var eighthSign = (chart.lagnaSignIndex + 7) % 12;
    body = uniq(body.concat(lagnaBody.slice(0, 1)).concat((data.SIGN_BODY[eighthSign] || []).slice(0, 1)));

    // ---- timing (accident-prone dasha windows) ----
    var triggerSet = uniq(["Mars", "Rahu", "Ketu", "Saturn", l8, hl.houseToLord[6]]);
    var windows = [];
    var now = opts.nowMs || Date.now();
    if (opts.timeline) {
      var horizon = now + 40 * 365.25 * 86400000;
      windows = opts.timeline.ads.filter(function (a) {
        return a.endMs > now && a.startMs < horizon &&
          triggerSet.indexOf(a.mdLord) >= 0 && triggerSet.indexOf(a.lord) >= 0;
      }).slice(0, 6).map(function (a) {
        return { mdLord: a.mdLord, lord: a.lord, startMs: a.startMs, endMs: a.endMs, current: now >= a.startMs && now < a.endMs };
      });
    }

    // ---- current transit triggers ----
    var transitNotes = [];
    if (opts.transit && opts.transit.planets) {
      var lagna = chart.lagnaSignIndex;
      ["Mars", "Saturn", "Rahu", "Ketu"].forEach(function (tp) {
        var ts = opts.transit.planets[tp]; if (!ts) return;
        var gh = ((ts.signIndex - lagna + 12) % 12) + 1;
        if ([1, 4, 6, 8].indexOf(gh) >= 0) transitNotes.push(tp + " transiting natal " + gh + "th");
      });
    }

    var active = windows.some(function (w) { return w.current; }) || transitNotes.length > 0;
    var summary = "Accident / injury proneness reads as " + level + " (index " + (Math.round(score * 10) / 10) +
      "). " + (score >= 2.5
        ? "Likely nature: " + types.join("; ") + ". "
        : "No strong accident yoga is present. ") +
      (active ? "Current dasha/transit triggers are active \u2014 extra caution advised in the windows below."
        : "No major accident-trigger period is running right now.");

    return {
      score: Math.round(score * 10) / 10,
      level: level, levelClass: levelClass,
      factors: factors, types: types, bodyParts: body,
      windows: windows, transitNotes: transitNotes, summary: summary
    };
  }

  var api = { analyze: analyze };
  root.AHS = root.AHS || {};
  root.AHS.accident = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
