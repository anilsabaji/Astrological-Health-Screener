/*
 * build-manual.js
 * Generates the Technical Manual in two formats from one content source:
 *   - manual.html  (self-contained, themed, with a Print / Save-as-PDF button)
 *   - manual.pdf   (real multi-page PDF via a tiny dependency-free writer)
 *
 * Usage: node scripts/build-manual.js
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..") + "/";

/* ----------------------------------------------------------------------------
 * CONTENT (single source of truth)
 * -------------------------------------------------------------------------- */
function h1(s) { return { t: "h1", s: s }; }
function h2(s) { return { t: "h2", s: s }; }
function h3(s) { return { t: "h3", s: s }; }
function p(s) { return { t: "p", s: s }; }
function li(s) { return { t: "li", s: s }; }
function param(name, detail) { return { t: "param", name: name, detail: detail }; }
function sp(h) { return { t: "space", h: h || 8 }; }

var TITLE = "Astrological Health Screener";
var SUBTITLE = "Technical Manual - parameters and their impact on the assessment";

var BLOCKS = [
  h1("1. Introduction"),
  p("The Astrological Health Screener computes a sidereal (Vedic) birth chart together with current transits, and produces a rule-based health assessment from multiple classical systems: Parashara, Krishnamurti Paddhati (KP), the D6 Shashthamsa divisional, Shadbala strength, Vimshottari dasha timing, and a natural-language question module. This manual documents every parameter the tool uses and exactly how each one influences the assessment, including the numeric weights and thresholds."),
  p("IMPORTANT: This is an educational and self-reflection tool based on classical astrological significations. It is NOT medical advice and does not diagnose, treat, or predict any medical condition. All outputs are astrological indications and risk-sensitive periods only. Always consult a qualified healthcare professional."),

  h1("2. Inputs"),
  param("Name", "Optional label, shown on the report's Native Details page."),
  param("Date of Birth", "Gregorian date. Used to compute the Julian Day."),
  param("Time of Birth", "Local 24h time. Required for houses, Ascendant, Placidus cusps, Shadbala day/night, and all house-based analysis. If unknown, 12:00 is assumed and house-dependent results are skipped."),
  param("Place of Birth", "Latitude (N positive) and Longitude (E positive). Used for the Ascendant, house cusps and Dig Bala. A city search can auto-fill these via a public geocoding lookup."),
  param("UTC offset", "Hours east of UTC (e.g. +5.5 for India). Converts local birth time to Universal Time. Confirm daylight saving for the birth date/region."),

  h1("3. Astronomical engine"),
  p("Planetary positions use a compact analytical ephemeris (Paul Schlyter's method) with the major perturbation terms for the Moon and for Jupiter/Saturn. Accuracy is within a few arc-minutes - sufficient for sign, nakshatra and KP sub-division boundaries."),
  param("Julian Day", "Local civil time minus the UTC offset gives Universal Time, converted to a Julian Day for all calculations."),
  param("Ayanamsa (Lahiri / Chitrapaksha)", "The precessional offset subtracted from tropical longitudes to obtain sidereal (Vedic) longitudes. ~24 degrees in this era, increasing ~50.3 arc-seconds per year."),
  param("Obliquity of the ecliptic", "Used to convert ecliptic longitude to right ascension and declination."),
  param("Ascendant (Lagna)", "The rising sidereal degree on the eastern horizon, from RAMC, latitude and obliquity. Defines the 1st house."),
  param("Placidus cusps", "Twelve house cusps by semi-arc trisection - required for KP cuspal sub-lord analysis. Reduced to equal right-ascension division at the equator and verified monotonic at mid-latitudes."),

  h1("4. Core placements"),
  param("Rasi (sign) and degree", "The sidereal sign (1 of 12) and degrees within it. The basis of dignity, body-part mapping and divisional charts."),
  param("Nakshatra and pada", "1 of 27 lunar mansions (13 deg 20' each) and its quarter (pada). The nakshatra lord drives the Vimshottari dasha and KP significations."),
  param("KP sub-lord", "Each nakshatra is sub-divided into nine unequal Vimshottari-proportion parts starting from the star lord. The sub-lord is the decisive significator in KP."),
  param("Whole-sign houses (Parashara)", "House = sign offset from the Lagna sign + 1. Used by the Parashara engine."),
  param("Placidus houses (KP)", "House determined by which cusp interval a body falls in. Used by the KP engine."),

  h1("5. Dignity, debilitation and Neecha Bhanga"),
  param("Dignity", "Exalted, own sign, debilitated or neutral, from each planet's exaltation/debilitation/own signs. Exalted/own strengthens the organs a planet governs; debilitated weakens them."),
  param("Debilitation (Neecha)", "A planet in its debilitation sign in the D1 Rasi chart is functionally weak for the systems it governs - unless cancelled."),
  h3("Neecha Bhanga (cancellation) conditions - Rasi"),
  li("The dispositor (lord of the debilitation sign) is in a kendra (1/4/7/10) from the Lagna or the Moon."),
  li("The planet exalted in that sign is in a kendra from the Lagna or the Moon."),
  li("The debilitated planet is conjunct or aspected by its dispositor."),
  li("The debilitated planet is conjunct or aspected by the planet exalted there."),
  li("The dispositor or that exalted planet is itself exalted."),
  h3("Neecha Bhanga conditions - Navamsa (D9)"),
  li("The debilitated planet attains exaltation in the Navamsa."),
  li("The debilitated planet occupies its own sign in the Navamsa."),
  li("The debilitated planet is Vargottama (same sign in D1 and D9) - a strengthening factor."),
  li("The dispositor is exalted or in its own sign in the Navamsa."),
  p("Impact: a debilitation WITHOUT cancellation is reported as a vulnerability and adds risk in the forecast; a CANCELLED debilitation is largely neutralised (and may act as a strength), so the forecast does not penalise it."),

  h1("6. Shadbala (six-fold strength)"),
  p("Shadbala measures how capable each of the seven planets is of delivering (and protecting) the matters it governs. Values are in Virupas; 60 Virupas = 1 Rupa. Each planet's total is compared with a classical required minimum."),
  param("Sthana Bala", "Positional strength: Uchcha (distance from debilitation), Saptavargaja (divisional dignity), Ojayugma (odd/even sign), Kendradi (angular 60 / succedent 30 / cadent 15), and Drekkana strength."),
  param("Dig Bala", "Directional strength: distance from the planet's powerless point (Sun/Mars strong in the 10th, Jupiter/Mercury in the 1st, Moon/Venus in the 4th, Saturn in the 7th)."),
  param("Kala Bala", "Temporal strength: Nathonnatha (day/night), Paksha (Moon-Sun elongation), and Ayana (declination-based)."),
  param("Cheshta Bala", "Motional strength. Sun uses its Ayana bala, Moon its Paksha bala; others derive from actual speed vs mean motion (retrograde = strong)."),
  param("Naisargika Bala", "Fixed natural strength: Sun 60, Moon 51.4, Venus 42.9, Jupiter 34.3, Mercury 25.7, Mars 17.1, Saturn 8.6 Virupas."),
  param("Drik Bala", "Aspectual strength: benefic aspects add, malefic aspects subtract."),
  param("Required strength (Rupas)", "Sun 5, Moon 6, Mars 5, Mercury 7, Jupiter 6.5, Venus 5.5, Saturn 5. Below this = weak; within 80-100% = moderate; at/above = strong."),
  h3("Motion, direction and declination"),
  param("Speed and motion", "Daily motion (deg/day). Slow or stationary planets are functionally altered."),
  param("Retrograde", "A planet moving backward (not Sun/Moon). Flagged with the retrograde symbol; intensifies and can make its significations erratic."),
  param("Combustion", "Within the Sun's orb (Moon 12, Mars 17, Mercury 12, Jupiter 11, Venus 9, Saturn 15 degrees). Weakens the planet's significations."),
  param("Declination", "Angular distance from the celestial equator; the basis of Ayana Bala (north strengthens Sun/Mars/Jupiter/Venus/Mercury; south strengthens Moon/Saturn)."),
  p("Impact: a weak, combust, retrograde or slow planet flags the body systems it governs as needing support. In the period forecast, a weak period-lord adds risk (+0.4 weight, combust +0.3), while a strong one is treated as resilient (-0.2)."),

  h1("7. Divisional charts and Khara (maraka) points"),
  param("D1 Rasi", "The main birth chart; everything, including the physical body (1st house)."),
  param("D9 Navamsa", "Inner strength and dignity; central to debilitation-cancellation and Shadbala."),
  param("D3 Drekkana", "Each sign in three 10-degree parts (1st = same sign, 2nd = 5th, 3rd = 9th); constitution/longevity context."),
  param("D6 Shashthamsa", "Each sign in six 5-degree parts (odd signs from Aries, even from Libra). The divisional dedicated to HEALTH and DISEASE."),
  param("22nd Drekkana lord (from Lagna)", "A Khara (cause-of-affliction) point: the drekkana 21 places ahead of the Lagna's, landing in the 8th sign at the same ordinal."),
  param("64th Navamsa lord (from the Moon)", "Another Khara/maraka point: the navamsa sign 63 places ahead of the Moon's navamsa (i.e. the 4th navamsa sign onward)."),
  p("Impact: when a dasha period-lord coincides with a maraka lord, the forecast raises the period's sensitivity."),

  h1("8. Health significations (reference data)"),
  param("Planet -> body parts", "Karaka organs/systems, e.g. Sun: heart, bones, vitality; Moon: mind, fluids, stomach; Mars: blood, muscles; Mercury: nerves, skin; Jupiter: liver, fat; Venus: kidneys, reproductive; Saturn: bones, joints, chronic; Rahu/Ketu: nervous/mysterious, surgery."),
  param("Planet -> ailments", "Tendencies linked to each planet (e.g. Saturn: chronic, arthritic, degenerative; Mars: inflammation, accidents)."),
  param("Sign -> body (Kalapurusha)", "Head (Aries) to feet (Pisces) mapped to the twelve signs; also used for house body regions."),
  param("House health meaning", "1 body/vitality, 6 disease, 8 chronic/surgery/longevity, 11 cure/recovery, 12 hospitalisation, etc."),
  param("KP house groups", "Disease houses 6/8/12 (adverse); recovery houses 1/5/11 (supportive). Maraka houses 2/7."),
  param("Natural benefic/malefic", "Jupiter, Venus, Mercury, (waxing) Moon are benefic; Sun, Mars, Saturn, Rahu, Ketu malefic. Affects affliction and aspect scoring."),

  h1("9. Parashara health engine"),
  p("Whole-sign analysis producing a vitality index (0-100, baseline 70). Factors and their score impact:"),
  li("Lagna lord in a dusthana (6/8/12): -12 and a constitution finding; in a kendra/trikona: +6."),
  li("Lagna lord debilitated: -8; exalted/own: +6."),
  li("Malefics in or aspecting the Ascendant: -4 each; body parts of those malefics + the Lagna sign are flagged."),
  li("6th house (disease) occupied/its lord in dusthana: -6. 8th house (chronic): -7. 12th house: -4."),
  li("Moon afflicted or in dusthana (mind/emotions): -5."),
  li("Any debilitated planet: -3 and its systems flagged."),
  p("The index is banded as robust (>=75), generally good (>=60), moderate (>=45) or delicate (<45)."),

  h1("10. KP (Krishnamurti Paddhati) health engine"),
  p("A planet delivers the houses it SIGNIFIES, chiefly via its star (nakshatra) lord, then by occupation/ownership. Health index baseline 70."),
  param("Cuspal sub-lords", "The sub-lord of the 1st cusp (body), 6th (disease), 8th (chronic) and 12th (hospitalisation) cusps is examined. If the 1st sub-lord signifies 6/8/12 (and not 1/5/11) health is vulnerable (-10); leaning to 1/5/11 supports health (+6). For 6/8/12 cusps, a sub-lord signifying disease houses means that matter can manifest (8th -8, others -5)."),
  param("Significators of 6/8/12", "Planets that signify the disease houses (four-fold: occupant's star, occupant, owner's star, owner). Their governed organs are linked to disease and listed."),

  h1("11. D6 Shashthamsa health engine"),
  p("Reads the health-specific houses within the D6 chart (baseline 70):"),
  li("D6 Lagna lord in a D6 dusthana: -10 (weak disease-resistance)."),
  li("Malefics on D6 1/6/8/12: -4 to -6 each; their organs flagged. Benefics on D6 1/6: +3 (recuperation)."),
  p("Produces a D6 health index banded strong / reasonably stable / guarded / fragile."),

  h1("12. Vimshottari dasha and timing"),
  p("The 120-year Vimshottari cycle starts from the Moon's nakshatra lord, with the balance proportional to the unelapsed nakshatra. Maha (MD), Antar (AD) and Pratyantar (PD) sub-periods follow the standard order and proportions (365.25-day year)."),
  h3("KP dasha health reading"),
  li("Each running lord is classified by the houses it signifies: 6/8/12 with no recovery link = Adverse; with 1/5/11 = Mixed; only 1/5/11 = Supportive."),
  li("The joint MD/AD/PD verdict flags health-sensitive periods. Upcoming Antar Dashas where both the Maha and Antar lords signify disease houses are listed as adverse windows."),
  h3("Parashara dasha schedule"),
  li("Each lord scored for adverse factors (dusthana placement/ownership, 2nd/7th maraka-house lordship, debilitation, being a 22nd-Drekkana or 64th-Navamsa lord) vs supportive factors (kendra/trikona, exaltation/own, benefic nature)."),
  li("Upcoming Maha, Antar and Pratyantar periods are listed with a verdict, and adverse Antar Dashas are flagged as sensitive windows."),

  h1("13. Period health forecast (synthesis)"),
  p("Combines the current MD/AD/PD with the maraka and strength factors to pinpoint the most vulnerable body part and the most probable issue, with a risk rating. Contributor base weights:"),
  li("Maha Dasha lord 3.0; Antar 2.2; Pratyantar 1.6; 64th-Navamsa lord 2.0; 22nd-Drekkana lord 2.0 (weights of a planet in multiple roles add up)."),
  h3("Amplifiers (multiply a contributor's weight)"),
  li("KP significator of a disease house: +0.5 (and +1.2 risk per role)."),
  li("Whole-sign dusthana placement: +0.4. Debilitated (uncancelled): +0.4. Cancelled debilitation: no penalty."),
  li("Running-period lord that is also a maraka point: +0.6 (heightened sensitivity)."),
  li("Shadbala weak: +0.4; combust: +0.3; strong: -0.2."),
  li("Occupies the D6 6th (disease): +1.3 role; D6 8th: +1.1 role."),
  param("Body-part synthesis", "Each contributor's weight is distributed to its karaka organs (primary x1.4) and the Kalapurusha parts of the sign it occupies (x0.5); the highest-scoring areas are the 'most vulnerable'. Ailments are tallied likewise."),
  param("Risk bands", "Risk score >=6 Elevated, >=3 Moderate, else Lower."),

  h1("14. Ask-a-Question module"),
  p("A free-text question is classified into a health topic (heart, cancer, diabetes, kidney, liver, mental, accident, BP, respiratory, joints, skin, digestive, eye, reproductive, thyroid, neuro, infection, or general). Each topic defines its karaka planets, houses, malefic triggers and body parts."),
  param("Predisposition score", "Sums affliction of the topic's karakas and houses: KP signifies 6 (+1.5) / 8 (+0.8) / 12 (+0.4); dusthana placement +1.2; debilitation +1.5; malefic conjunction +0.5; D6 6th +1.2 / 8th +0.8; maraka lord +1.0 to 1.2; house malefic occupants and adverse cuspal sub-lords add too."),
  param("Likelihood bands", "Total >=10 High predisposition; >=7 Elevated; >=4.5 Moderate; >=2.5 Mild; else Low. At or above 4.5 the answer is 'positive' and shows the organ and timing."),
  param("Organ pinpointing", "For named topics the stated organ leads; for open-ended ones (cancer/general) the organ is derived from the most afflicted karaka and house."),
  param("Timing", "Upcoming Antar Dashas (next ~45 years) whose Maha/Antar lords are topic-relevant and malefic are scored; the earliest strong window is refined to its Pratyantar sub-period. Output is a sensitive window, never a deterministic event."),

  h1("15. Transits (Gochara)"),
  p("Current sidereal positions of all bodies are mapped through the natal whole-sign houses. Transits of Saturn, Rahu, Ketu and Mars over the natal Ascendant or houses 6/8/12, and Saturn around the natal Moon (Sade Sati), are flagged as health-relevant timing."),

  h1("16. Reading the indices"),
  param("Parashara vitality index / KP health index / D6 health index", "0-100; higher is better. They use different methods, so differences are expected; convergence across them is the stronger signal."),
  param("Current-period risk", "Lower / Moderate / Elevated for the running dasha, from the synthesis."),
  param("Shadbala (Rupas)", "Per-planet strength vs requirement; shown with retrograde/combust markers in the birth chart."),

  h1("17. Accuracy and limitations"),
  li("Positions are accurate to a few arc-minutes - ample for signs, nakshatras and sub-lords, but not a Swiss-Ephemeris-grade tool."),
  li("Some Shadbala sub-balas (Tribhaga, year/month/day/hour lords, Yuddha) and the full seven-varga Saptavargaja are approximated; declination assumes ~0 ecliptic latitude. Results are reliable for the strong/weak classification used here."),
  li("Interpretations are deterministic summaries of classical rules, not the judgement of an experienced astrologer, and never a medical diagnosis."),
  li("Daylight-saving handling depends on the UTC offset entered."),

  h1("18. Glossary"),
  param("Lagna", "Ascendant - the rising sign/degree."),
  param("Dusthana", "Houses 6, 8, 12 (difficulty/disease)."),
  param("Kendra / Trikona", "Angular houses 1/4/7/10 / trines 1/5/9."),
  param("Karaka", "Significator (planet representing a matter or organ)."),
  param("Maraka / Khara", "Death-/affliction-inflicting points and house lords (2nd, 7th, and the 22nd-Drekkana / 64th-Navamsa lords)."),
  param("Vargottama", "Same sign in the Rasi (D1) and Navamsa (D9)."),
  param("Dasha / Bhukti", "Planetary period / sub-period in the Vimshottari system.")
];

/* ----------------------------------------------------------------------------
 * HTML generation
 * -------------------------------------------------------------------------- */
function escHtml(s) {
  return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; });
}
function buildHtml() {
  var body = "";
  var i = 0;
  while (i < BLOCKS.length) {
    var b = BLOCKS[i];
    if (b.t === "li") {
      body += "<ul>";
      while (i < BLOCKS.length && BLOCKS[i].t === "li") { body += "<li>" + escHtml(BLOCKS[i].s) + "</li>"; i++; }
      body += "</ul>";
      continue;
    }
    if (b.t === "h1") body += "<h2 class='sec'>" + escHtml(b.s) + "</h2>";
    else if (b.t === "h2") body += "<h3>" + escHtml(b.s) + "</h3>";
    else if (b.t === "h3") body += "<h4>" + escHtml(b.s) + "</h4>";
    else if (b.t === "p") body += "<p>" + escHtml(b.s) + "</p>";
    else if (b.t === "param") body += "<div class='param'><span class='pname'>" + escHtml(b.name) + "</span><span class='pdetail'>" + escHtml(b.detail) + "</span></div>";
    else if (b.t === "space") body += "<div style='height:" + (b.h || 8) + "px'></div>";
    i++;
  }
  return "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>" + TITLE + " - Technical Manual</title><style>" + MANUAL_CSS + "</style></head><body>" +
    "<header class=\"m-header\"><div class=\"wrap\"><h1>" + TITLE + "</h1><p class=\"sub\">" + SUBTITLE + "</p>" +
    "<button id=\"print-btn\" class=\"print\">&#128424; Print / Save as PDF</button></div></header>" +
    "<main class=\"wrap\">" + body +
    "<p class=\"foot-note\">Educational use only - not medical advice. Developed by Dr. Anil Sabaji (anilsabaji@gmail.com).</p>" +
    "</main>" +
    "<div class=\"page-foot\">Astrological Health Screener &mdash; Technical Manual &middot; developed by Dr. Anil Sabaji</div>" +
    "<script>document.getElementById('print-btn').addEventListener('click',function(){window.print();});</script>" +
    "</body></html>";
}

var MANUAL_CSS = "" +
  ":root{--bg:#0e1020;--bg2:#161a33;--card:#1c2142;--line:#313a6b;--text:#e9ecf8;--muted:#9aa3cf;--gold:#f2c46d;--indigo:#7c83f7;}" +
  "*{box-sizing:border-box}body{margin:0;background:#0e1020;color:var(--text);font-family:'Segoe UI',system-ui,Arial,sans-serif;line-height:1.6}" +
  ".wrap{max-width:900px;margin:0 auto;padding:0 20px}" +
  ".m-header{padding:28px 0;border-bottom:1px solid var(--line);text-align:center}" +
  ".m-header h1{margin:0;color:var(--gold);font-size:1.8rem}.m-header .sub{color:var(--muted);margin:6px 0 14px}" +
  "button.print{font:inherit;cursor:pointer;border:none;border-radius:9px;padding:10px 18px;font-weight:700;background:linear-gradient(180deg,#f2c46d,#e0a83c);color:#2a2305}" +
  "main{padding:24px 0 60px}" +
  "h2.sec{color:var(--gold);border-bottom:1px solid var(--line);padding-bottom:6px;margin-top:34px;font-size:1.3rem}" +
  "h3{color:var(--indigo);margin-top:22px}h4{color:var(--gold);margin:16px 0 6px;font-size:.98rem}" +
  "p{margin:10px 0}ul{margin:10px 0;padding-left:22px}li{margin:5px 0}" +
  ".param{display:flex;gap:14px;padding:8px 12px;margin:7px 0;background:var(--bg2);border:1px solid var(--line);border-left:3px solid var(--indigo);border-radius:0 8px 8px 0}" +
  ".param .pname{flex:0 0 210px;color:var(--gold);font-weight:600}.param .pdetail{flex:1;color:var(--text)}" +
  ".foot-note{margin-top:30px;color:var(--muted);font-size:.85rem;border-top:1px solid var(--line);padding-top:14px}" +
  ".page-foot{display:none}" +
  "@media (max-width:680px){.param{flex-direction:column;gap:4px}.param .pname{flex:none}}" +
  "@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:14mm 12mm 18mm}" +
  "body{background:#0e1020}.print,.m-header .sub{}button.print{display:none}" +
  ".param{break-inside:avoid}h2.sec,h3,h4{break-after:avoid}" +
  ".page-foot{display:block;position:fixed;left:0;right:0;bottom:0;text-align:center;font-size:8pt;color:var(--gold);background:#0e1020;border-top:1px solid var(--gold);padding:4px 0}}";

/* ----------------------------------------------------------------------------
 * PDF generation (dependency-free)
 * -------------------------------------------------------------------------- */
// Helvetica character widths (per 1000 units), ASCII 32..126
var HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];

function asciiOnly(s) {
  return String(s)
    .replace(/[\u2014\u2013]/g, "-").replace(/\u00b0/g, " deg").replace(/[\u00b7\u2022]/g, "-")
    .replace(/\u2192/g, "->").replace(/\u2248/g, "~").replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'").replace(/\u00d7/g, "x").replace(/\u2026/g, "...")
    .replace(/\u2265/g, ">=").replace(/\u2264/g, "<=").replace(/[^\x20-\x7E]/g, "");
}
function textWidth(str, size) {
  var w = 0;
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    w += (c >= 32 && c <= 126) ? HELV[c - 32] : 556;
  }
  return w * size / 1000;
}
function wrap(text, size, maxWidth) {
  var words = text.split(/\s+/), lines = [], cur = "";
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    var test = cur ? cur + " " + word : word;
    if (textWidth(test, size) <= maxWidth) { cur = test; continue; }
    if (cur) { lines.push(cur); cur = ""; }
    // break very long word
    while (textWidth(word, size) > maxWidth) {
      var n = 1;
      while (n <= word.length && textWidth(word.slice(0, n), size) <= maxWidth) n++;
      lines.push(word.slice(0, n - 1)); word = word.slice(n - 1);
    }
    cur = word;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}
function escPdf(s) { return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }

function buildPdf() {
  var PW = 595.28, PH = 841.89, ML = 56, MR = 56, MT = 60, MB = 60, maxW = PW - ML - MR;
  var STYLE = {
    h1: { bold: 1, s: 16, lh: 21, col: [0.12, 0.12, 0.42], sp: 12 },
    h2: { bold: 1, s: 12, lh: 16, col: [0.12, 0.12, 0.42], sp: 8 },
    h3: { bold: 1, s: 10.5, lh: 14, col: [0.20, 0.20, 0.55], sp: 6 },
    p: { bold: 0, s: 9.5, lh: 13, col: [0.12, 0.12, 0.12], sp: 4 },
    li: { bold: 0, s: 9.5, lh: 12.5, col: [0.12, 0.12, 0.12], sp: 2, bullet: 1 },
    pname: { bold: 1, s: 9.5, lh: 12.5, col: [0.55, 0.40, 0.05], sp: 5 },
    pdetail: { bold: 0, s: 9.5, lh: 12.5, col: [0.12, 0.12, 0.12], sp: 1, indent: 12 }
  };
  var pages = [], cur = [], y = PH - MT;
  function flush() { pages.push(cur); cur = []; y = PH - MT; }
  function line(text, st, x) {
    var f = st.bold ? "F2" : "F1";
    cur.push("q " + st.col[0] + " " + st.col[1] + " " + st.col[2] + " rg BT /" + f + " " + st.s +
      " Tf " + x.toFixed(2) + " " + y.toFixed(2) + " Td (" + escPdf(text) + ") Tj ET Q");
  }
  function writeBlock(text, st) {
    y -= st.sp;
    var indent = st.indent || 0;
    var bw = st.bullet ? 12 : 0;
    var lines = wrap(asciiOnly(text), st.s, maxW - indent - bw);
    for (var i = 0; i < lines.length; i++) {
      if (y - st.lh < MB) flush();
      if (st.bullet) {
        if (i === 0) line("-  " + lines[0], st, ML + indent);
        else line(lines[i], st, ML + indent + bw);
      } else {
        line(lines[i], st, ML + indent);
      }
      y -= st.lh;
    }
  }
  BLOCKS.forEach(function (b) {
    if (b.t === "space") { y -= (b.h || 8); return; }
    if (b.t === "param") {
      writeBlock(b.name, STYLE.pname);
      writeBlock(b.detail, STYLE.pdetail);
      return;
    }
    writeBlock(b.s, STYLE[b.t] || STYLE.p);
  });
  flush();

  // footer on each page
  var N = pages.length;
  var foot = asciiOnly("Astrological Health Screener  -  Technical Manual   |   developed by Dr. Anil Sabaji (anilsabaji@gmail.com)");
  for (var pi = 0; pi < N; pi++) {
    var fw = textWidth(foot, 7.5);
    pages[pi].push("q 0.45 0.45 0.45 rg BT /F1 7.5 Tf " + ((PW - fw) / 2).toFixed(2) + " 34 Td (" + escPdf(foot) + ") Tj ET Q");
    var pn = "Page " + (pi + 1) + " of " + N;
    pages[pi].push("q 0.45 0.45 0.45 rg BT /F1 7.5 Tf " + (PW - MR - textWidth(pn, 7.5)).toFixed(2) + " 34 Td (" + escPdf(pn) + ") Tj ET Q");
  }

  // assemble objects
  var objs = {};
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  var kids = [], parts = [];
  for (var i = 0; i < N; i++) { var pageNo = 5 + i * 2; kids.push(pageNo + " 0 R"); }
  objs[2] = "<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + N + " >>";
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  for (var j = 0; j < N; j++) {
    var pageNum = 5 + j * 2, contentNum = 6 + j * 2;
    objs[pageNum] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PW + " " + PH + "] " +
      "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + contentNum + " 0 R >>";
    var stream = pages[j].join("\n");
    objs[contentNum] = "<< /Length " + Buffer.byteLength(stream) + " >>\nstream\n" + stream + "\nendstream";
  }
  var maxObj = 4 + N * 2;
  objs[maxObj + 1] = "<< /Title (Astrological Health Screener - Technical Manual) /Author (Dr. Anil Sabaji) >>";

  var pdf = "%PDF-1.4\n";
  var offsets = [];
  for (var n = 1; n <= maxObj + 1; n++) {
    offsets[n] = Buffer.byteLength(pdf);
    pdf += n + " 0 obj\n" + objs[n] + "\nendobj\n";
  }
  var xrefPos = Buffer.byteLength(pdf);
  var count = maxObj + 2;
  pdf += "xref\n0 " + count + "\n0000000000 65535 f \n";
  for (var k = 1; k <= maxObj + 1; k++) {
    pdf += ("0000000000" + offsets[k]).slice(-10) + " 00000 n \n";
  }
  pdf += "trailer\n<< /Size " + count + " /Root 1 0 R /Info " + (maxObj + 1) + " 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF";
  return Buffer.from(pdf, "latin1");
}

/* ----------------------------------------------------------------------------
 * Write outputs
 * -------------------------------------------------------------------------- */
fs.writeFileSync(ROOT + "manual.html", buildHtml());
var pdf = buildPdf();
fs.writeFileSync(ROOT + "manual.pdf", pdf);
console.log("Wrote manual.html (" + fs.statSync(ROOT + "manual.html").size + " bytes) and manual.pdf (" + pdf.length + " bytes).");
