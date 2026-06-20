/*
 * kp-dasha.js
 * KP (Krishnamurti Paddhati) analysis of the Vimshottari dasha for HEALTH.
 *
 * KP principle: a dasha/bhukti lord gives the results of the houses it
 * SIGNIFIES -- primarily the houses signified by its star (nakshatra) lord,
 * then by its own occupation/ownership. For health:
 *   - signifying 6 / 8 / 12  -> disease, chronic/surgery, hospitalisation (adverse)
 *   - signifying 1 / 5 / 11  -> vitality, recovery, cure (supportive; 11 = cure)
 * A period turns health-sensitive when the running MD, AD (and PD) lords are
 * joint significators of 6/8/12; relief comes when 11/5/1 are also signified.
 *
 * House -> body region uses the Kalapurusha order (1st = head ... 12th = feet).
 * Works in browser (window.AHS.kpdasha) and Node.
 */
(function (root) {
  "use strict";

  var R = (typeof require !== "undefined");
  var core = R ? require("./astro-core.js") : root.AHS.core;
  var data = R ? require("./data.js") : root.AHS.data;
  var kp = R ? require("./kp.js") : root.AHS.kp;

  var DISEASE = [6, 8, 12];
  var RECOVERY = [1, 5, 11];
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  function inter(a, b) { return a.filter(function (x) { return b.indexOf(x) >= 0; }); }

  // Kalapurusha body region for a house number (natural-zodiac body map).
  function houseBody(h) { return data.SIGN_BODY[(h - 1) % 12] || []; }

  function levelReport(chart, levelName, lord, period) {
    var pl = chart.planets[lord];
    var starLord = pl.nakshatraLord;
    var sig = kp.planetSignifications(chart, lord);
    var all = sig.all.slice().sort(function (a, b) { return a - b; });
    var disease = inter(all, DISEASE);
    var recovery = inter(all, RECOVERY);

    var verdict, klass;
    if (disease.length && !recovery.length) { verdict = "Adverse for health \u2014 the lord signifies disease house(s) " + disease.join(", ") + " with no link to recovery houses."; klass = "high"; }
    else if (disease.length && recovery.length) { verdict = "Mixed \u2014 signifies disease house(s) " + disease.join(", ") + " but also recovery house(s) " + recovery.join(", ") + " (illness with capacity to recover)."; klass = "moderate"; }
    else if (recovery.length) { verdict = "Supportive \u2014 signifies house(s) " + recovery.join(", ") + " (vitality / cure), no disease-house link."; klass = "low"; }
    else { verdict = "Neutral for health \u2014 no strong link to disease or recovery houses."; klass = "low"; }

    // body regions implicated = disease-house bodies + the lord's karaka organs
    var body = [];
    disease.forEach(function (h) { body = body.concat(houseBody(h).slice(0, 2)); });
    body = body.concat((data.PLANET_BODY[lord] || []).slice(0, 2));

    return {
      level: levelName, lord: lord, starLord: starLord, period: period,
      signifies: all, primary: sig.strong.slice().sort(function (a, b) { return a - b; }),
      disease: disease, recovery: recovery,
      verdict: verdict, klass: klass,
      bodyParts: uniq(body)
    };
  }

  /*
   * analyze(chart, dasha)
   *   dasha = AHS.dasha.compute(...) output (md/ad/pd)
   */
  function analyze(chart, dasha) {
    var levels = [
      levelReport(chart, "Maha Dasha", dasha.md.lord, dasha.md),
      levelReport(chart, "Antar Dasha", dasha.ad.lord, dasha.ad),
      levelReport(chart, "Pratyantar Dasha", dasha.pd.lord, dasha.pd)
    ];

    var diseaseLevels = levels.filter(function (l) { return l.disease.length; });
    var recoveryLevels = levels.filter(function (l) { return l.recovery.length; });

    // KP joint verdict: how many of MD/AD/PD link to disease houses
    var n = diseaseLevels.length;
    var jointClass, jointVerdict;
    if (n >= 2 && recoveryLevels.length === 0) {
      jointClass = "high";
      jointVerdict = "Health-sensitive period: " + n + " of the 3 running dasha lords are KP significators of the disease houses (6/8/12) with no recovery-house link. KP reads this as a window where ill-health can fructify.";
    } else if (n >= 2) {
      jointClass = "moderate";
      jointVerdict = "Guarded period: " + n + " of the 3 dasha lords touch disease houses, but recovery houses (1/5/11) are also signified \u2014 problems may arise yet remain manageable/curable.";
    } else if (n === 1) {
      jointClass = "moderate";
      jointVerdict = "Mostly stable: one running dasha lord links to a disease house; isolated or minor health matters are possible.";
    } else {
      jointClass = "low";
      jointVerdict = "Favourable: the running dasha lords are not strongly tied to the disease houses in KP, indicating a comparatively healthy phase.";
    }

    // weighted body regions (MD heaviest)
    var votes = {};
    var weights = { "Maha Dasha": 3, "Antar Dasha": 2, "Pratyantar Dasha": 1.5 };
    diseaseLevels.forEach(function (l) {
      l.bodyParts.forEach(function (b) { votes[b] = (votes[b] || 0) + weights[l.level]; });
    });
    var bodyParts = Object.keys(votes).map(function (k) { return { name: k, score: votes[k] }; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 4);

    var summary = "KP dasha-health reading for the running " + dasha.md.lord + " / " + dasha.ad.lord +
      " / " + dasha.pd.lord + " period. In KP, each lord delivers the houses it signifies (chiefly via its star lord); " +
      "the verdicts below weigh disease houses (6/8/12) against recovery houses (1/5/11).";

    return {
      method: "KP Vimshottari Dasha",
      levels: levels,
      jointVerdict: jointVerdict,
      jointClass: jointClass,
      bodyParts: bodyParts,
      summary: summary
    };
  }

  var api = { analyze: analyze };
  root.AHS = root.AHS || {};
  root.AHS.kpdasha = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
