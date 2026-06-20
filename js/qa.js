/*
 * qa.js
 * Natural-language health question engine.
 * Classifies a question into a health topic, scores the astrological
 * predisposition, pinpoints the most likely organ/area, and times the most
 * sensitive period using Vimshottari dasha (+ a transit check).
 *
 * IMPORTANT: output is framed as astrological INDICATION and risk-sensitive
 * timing, never as a medical diagnosis or a deterministic event.
 *
 * Works in browser (window.AHS.qa) and Node.
 */
(function (root) {
  "use strict";

  var R = (typeof require !== "undefined");
  var core = R ? require("./astro-core.js") : root.AHS.core;
  var data = R ? require("./data.js") : root.AHS.data;
  var kp = R ? require("./kp.js") : root.AHS.kp;
  var parashara = R ? require("./parashara.js") : root.AHS.parashara;
  var dasha = R ? require("./dasha.js") : root.AHS.dasha;
  var topics = R ? require("./health-topics.js") : root.AHS.topics;

  var DIS = [6, 8, 12];
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  function isMalefic(p) { return data.NATURE[p] === "malefic"; }
  function inter(a, b) { return a.filter(function (x) { return b.indexOf(x) >= 0; }); }
  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  // weighted contribution of signifying disease houses (6 dominates; 12 light)
  function diseaseHouseWeight(housesSignified) {
    var w = 0;
    if (housesSignified.indexOf(6) >= 0) w += 1.5;
    if (housesSignified.indexOf(8) >= 0) w += 0.8;
    if (housesSignified.indexOf(12) >= 0) w += 0.4;
    return Math.min(w, 2.0);
  }

  // --- how afflicted is a single planet? returns {score, reasons[]} ---
  function planetAffliction(ctx, p) {
    var chart = ctx.chart, d6 = ctx.d6, score = 0, reasons = [];
    var pl = chart.planets[p];
    if (!pl) return { score: 0, reasons: [] };
    var s = pl.signIndex;

    var dig = parashara.dignityOf(p, s);
    if (dig === "debilitated") { score += 1.5; reasons.push(p + " is debilitated in " + core.SIGNS[s]); }
    else if (dig === "exalted" || dig === "own sign") { score -= 0.8; }

    if (DIS.indexOf(pl.wholeSignHouse) >= 0) { score += 1.2; reasons.push(p + " sits in dusthana house " + pl.wholeSignHouse); }

    var sig = kp.planetSignifications(chart, p);
    var d = inter(sig.all, DIS);
    if (d.length) {
      var w = diseaseHouseWeight(d);
      score += w;
      if (w >= 1.0) reasons.push(p + " (KP) signifies disease house(s) " + d.join(", "));
    }

    // malefic conjunction / aspect (whole-sign)
    var conj = 0;
    ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"].forEach(function (q) {
      if (q === p || !isMalefic(q)) return;
      var qh = chart.planets[q].wholeSignHouse;
      if (qh === pl.wholeSignHouse && conj < 1.0) { score += 0.5; conj += 0.5; reasons.push(p + " is conjunct malefic " + q); }
      else if (parashara.aspectsFrom(q, qh).indexOf(pl.wholeSignHouse) >= 0) { score += 0.3; }
    });

    if (d6) {
      var h6 = d6.planets[p].house;
      if (h6 === 6) { score += 1.2; reasons.push(p + " falls in D6 6th (disease) house"); }
      else if (h6 === 8) { score += 0.8; reasons.push(p + " falls in D6 8th house"); }
    }
    if (p === ctx.n64Lord) { score += 1.2; reasons.push(p + " is the 64th-Navamsa (maraka) lord"); }
    if (p === ctx.d22Lord) { score += 1.0; reasons.push(p + " is the 22nd-Drekkana (maraka) lord"); }

    return { score: score, reasons: reasons };
  }

  function houseAffliction(ctx, h) {
    var chart = ctx.chart, score = 0, reasons = [];
    var occ = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"]
      .filter(function (p) { return chart.planets[p].wholeSignHouse === h; });
    var mal = occ.filter(isMalefic);
    if (mal.length) { score += Math.min(mal.length * 0.8, 1.6); reasons.push("house " + h + " holds malefic(s) " + mal.join(", ")); }
    var subLord = chart.cusps[h - 1].subLord;
    var sig = kp.planetSignifications(chart, subLord);
    var d = inter(sig.all, DIS);
    if (d.length) {
      var w = diseaseHouseWeight(d) * 0.6;
      score += w;
      if (w >= 0.8) reasons.push("the " + ordinal(h) + " cuspal sub-lord (" + subLord + ") signifies disease houses");
    }
    return { score: score, reasons: reasons, occupants: occ };
  }

  // planets relevant to a topic, for TIMING (tighter: karakas, topic malefics,
  // and strong significators of the topic's own houses)
  function relevantPlanets(ctx, topic) {
    var set = topic.karakas.concat(topic.malefics || []);
    topic.houses.forEach(function (h) {
      kp.houseSignificators(ctx.chart, h).forEach(function (s) {
        if (s.level <= 2) set.push(s.planet);
      });
    });
    return uniq(set);
  }

  // pinpoint affected organ/body part from afflicted karakas + afflicted houses
  function pinpointOrgan(ctx, topic, afflictedKarakas) {
    var votes = {};
    function add(b, w) { votes[b] = (votes[b] || 0) + w; }

    // For topics that name a specific organ, lead with it; for open-ended
    // topics (cancer / general health) derive the organ from the afflictions.
    if (topic.bodyParts && topic.bodyParts.length && !topic.organSearch) {
      topic.bodyParts.forEach(function (b, i) { add(b, 5 - i * 0.5); });
    }

    afflictedKarakas.forEach(function (k) {
      (data.PLANET_BODY[k.planet] || []).slice(0, 3).forEach(function (b, i) { add(b, k.score * (i === 0 ? 1.3 : 1)); });
      var s = ctx.chart.planets[k.planet] ? ctx.chart.planets[k.planet].signIndex : null;
      if (s !== null) (data.SIGN_BODY[s] || []).slice(0, 2).forEach(function (b) { add(b, k.score * 0.5); });
    });
    // most afflicted relevant house -> its sign body
    topic.houses.concat([6, 8]).forEach(function (h) {
      var ha = houseAffliction(ctx, h);
      if (ha.score > 0) {
        var signIndex = (ctx.chart.lagnaSignIndex + h - 1) % 12;
        (data.SIGN_BODY[signIndex] || []).slice(0, 2).forEach(function (b) { add(b, ha.score * 0.6); });
      }
    });
    return Object.keys(votes).map(function (k) { return { name: k, score: votes[k] }; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 3);
  }

  // time the most sensitive window using the dasha timeline
  function timeWindows(ctx, topic, relevant) {
    var tl = ctx.timeline;
    var now = ctx.nowMs;
    var horizon = now + 45 * 365.25 * 86400000;
    var malefRelevant = relevant.filter(function (p) { return isMalefic(p) || topic.malefics.indexOf(p) >= 0; });

    var scored = tl.ads.filter(function (a) { return a.endMs > now && a.startMs < horizon; })
      .map(function (a) {
        var s = 0;
        if (relevant.indexOf(a.mdLord) >= 0) s += 1.5;
        if (relevant.indexOf(a.lord) >= 0) s += 1.5;
        if (malefRelevant.indexOf(a.mdLord) >= 0) s += 0.8;
        if (malefRelevant.indexOf(a.lord) >= 0) s += 1.0;
        if (topic.karakas.indexOf(a.lord) >= 0) s += 0.8;
        return { mdLord: a.mdLord, lord: a.lord, startMs: a.startMs, endMs: a.endMs, score: s };
      })
      .filter(function (a) { return a.score >= 2.5; });

    // chronological, take earliest strong windows
    scored.sort(function (a, b) { return a.startMs - b.startMs; });
    var top = scored.slice(0, 3);

    // refine the earliest strong window to a pratyantar sub-window
    if (top.length) {
      var w = top[0];
      var pds = dasha.subPeriods(w.lord, w.startMs, w.endMs - w.startMs);
      var best = null;
      pds.forEach(function (pd) {
        if (pd.endMs < now) return;
        var rs = (relevant.indexOf(pd.lord) >= 0 ? 1 : 0) + (malefRelevant.indexOf(pd.lord) >= 0 ? 1 : 0);
        if (!best || rs > best.rs) best = { pd: pd, rs: rs };
      });
      if (best && best.rs > 0) w.refine = best.pd;
    }
    return top;
  }

  /*
   * analyze(ctx, questionText)
   *   ctx = { chart, d6, d22Lord, n64Lord, timeline, nowMs }
   */
  function analyze(ctx, questionText) {
    var cl = topics.classify(questionText);
    var topic = cl.topic;
    var relevant = relevantPlanets(ctx, topic);

    // karaka affliction
    var karakaAffl = topic.karakas.map(function (p) {
      var a = planetAffliction(ctx, p);
      return { planet: p, score: a.score, reasons: a.reasons };
    });
    var afflictedKarakas = karakaAffl.filter(function (k) { return k.score > 0.5; });

    // house affliction
    var houseAffl = uniq(topic.houses.concat([6, 8])).map(function (h) { return houseAffliction(ctx, h); });

    var totalScore = 0, reasons = [];
    karakaAffl.forEach(function (k) { totalScore += Math.max(0, k.score); k.reasons.forEach(function (r) { reasons.push(r); }); });
    houseAffl.forEach(function (h) { totalScore += Math.max(0, h.score) * 0.8; h.reasons.forEach(function (r) { reasons.push(r); }); });

    // likelihood band
    var likelihood, klass;
    if (totalScore >= 10) { likelihood = "High predisposition"; klass = "high"; }
    else if (totalScore >= 7) { likelihood = "Elevated tendency"; klass = "high"; }
    else if (totalScore >= 4.5) { likelihood = "Moderate tendency"; klass = "moderate"; }
    else if (totalScore >= 2.5) { likelihood = "Mild indication"; klass = "moderate"; }
    else { likelihood = "Low / not strongly indicated"; klass = "low"; }

    var positive = totalScore >= 4.5;
    var organs = positive ? pinpointOrgan(ctx, topic, afflictedKarakas.length ? afflictedKarakas : karakaAffl) : [];
    var windows = positive ? timeWindows(ctx, topic, relevant) : [];

    // verdict text
    var art = /^[aeiou]/i.test(likelihood) ? "an" : "a";
    var verdict;
    if (!positive) {
      verdict = "Astrologically, the chart does <strong>not show a strong predisposition</strong> to " +
        topic.label + " at this level of analysis. Indicators are " + likelihood.toLowerCase() + ". " +
        "This is reassuring astrologically but is not a clinical clearance.";
    } else {
      verdict = "The chart shows " + art + " <strong>" + likelihood.toLowerCase() + "</strong> toward " + topic.label +
        ". This is an astrological inclination, <strong>not a certainty or a diagnosis</strong>." +
        (organs.length ? " The area most implicated is the <strong>" + organs[0].name + "</strong>" +
          (organs[1] ? " (also " + organs[1].name + ")" : "") + "." : "") +
        (windows.length ? " The most sensitive period indicated is " + windowText(windows[0]) + "." : "");
    }

    return {
      question: questionText,
      topic: topic,
      matched: cl.matched,
      score: Math.round(totalScore * 10) / 10,
      likelihood: likelihood,
      likelihoodClass: klass,
      positive: positive,
      organs: organs,
      windows: windows,
      reasons: uniq(reasons),
      verdict: verdict
    };
  }

  function windowText(w) {
    var base = w.mdLord + "\u2013" + w.lord + " dasha (" + dasha.fmtDate(w.startMs) + " \u2013 " + dasha.fmtDate(w.endMs) + ")";
    if (w.refine) base += ", peaking around the " + w.refine.lord + " sub-period (" +
      dasha.fmtDate(w.refine.startMs) + " \u2013 " + dasha.fmtDate(w.refine.endMs) + ")";
    return base;
  }

  var api = { analyze: analyze, windowText: windowText };
  root.AHS = root.AHS || {};
  root.AHS.qa = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
