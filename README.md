# Astrological Health Screener

A self-contained, browser-based tool that takes a person's birth details, computes a
sidereal (Vedic) birth chart plus the current planetary transits, and produces a
**health screening from two systems of Indian astrology**:

- **Parashara** (Brihat Parashara Hora Shastra) — whole-sign houses, lagna & lagna-lord
  strength, the disease houses (6/8/12), malefic afflictions, and body-part karakas.
- **KP — Krishnamurti Paddhati** — Placidus cusps, cuspal **sub-lords**, and the
  4-fold significators of the disease houses.

> ⚠️ **Not medical advice.** This is an educational / self-reflection tool based on
> classical astrological significations. It does **not** diagnose, treat, or predict
> any medical condition. Always consult a qualified healthcare professional.

## Features

- **No build step, no server, no API key** — just open `index.html` in a browser.
- Accurate sidereal positions for Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn,
  Rahu & Ketu (**Lahiri ayanamsa**).
- **Ascendant (Lagna)** and **Placidus house cusps** from birth time + location.
- **Nakshatra, pada and KP sub-lord** for every body and cusp.
- **Live transits (Gochara)** mapped through your natal houses, with Sade Sati and
  malefic-transit health flags.
- **Vimshottari Dasha** — current Maha / Antar / Pratyantar periods with dates,
  analysed for health both classically and **the KP way** (a dasha lord delivers
  the houses it signifies via its star lord; 6/8/12 = adverse, 1/5/11 = recovery).
- **Divisionals & maraka points** — D3 Drekkana chart, the **22nd Drekkana lord**
  (from Lagna) and the **64th Navamsa lord** (from Moon).
- **Shadbala** — six-fold planetary strength (Sthana, Dig, Kala, Cheshta,
  Naisargika, Drik) in Rupas vs the required minimum, plus each planet's **motion
  speed, direction (retrograde), combustion and declination**; weak/combust/slow
  planets flag the body systems most needing support, and feed the forecast.
- **D6 Shashthamsa health chart** — the divisional dedicated to health & disease,
  with its own vulnerability analysis (D6 houses 1/6/8/12) and score.
- **Period Health Forecast** — synthesises dasha lords + maraka points + KP
  significators + dignities to **pinpoint the most vulnerable body part and the
  most probable health issue** for the current period, with a risk rating.
- **Ask a Question** — a natural-language module: ask e.g. *"Will I get a heart
  attack?"* or *"Will I get cancer?"* and it classifies the theme, scores the
  astrological predisposition, names the most implicated organ, and times the
  most sensitive Vimshottari period. Framed as indication + timing, never a
  medical diagnosis.
- City search (via the free Open-Meteo geocoding API) or manual latitude / longitude /
  UTC-offset entry.
- Two independent, rule-based analyses with a vitality/health index and body systems
  to monitor.

## Usage

1. Open `index.html` in any modern browser (or host the folder on any static server /
   GitHub Pages).
2. Enter **date, time and place** of birth. Use the city search to auto-fill
   latitude/longitude and a suggested UTC offset, or type them in manually.
   - For India, the UTC offset is **5.5**. Double-check **daylight-saving** for the
     birth date/region if relevant.
   - No birth time? Tick *"Birth time unknown"* — planetary signs/nakshatras are still
     shown, but house-based analysis (and the indices) are skipped.
3. Click **Generate Health Screening** and review the tabs:
   **Birth Chart · Current Transits · Parashara Analysis · KP Analysis**.

Try **Load sample** for a worked example (15 Aug 1990, 14:30, Mumbai).

## Project structure

```
index.html            UI shell, form, results tabs
css/styles.css        styling (dark indigo/gold theme, responsive)
js/
  ephemeris.js        planetary positions (Schlyter's analytical method)
  astro-core.js       Julian Day, ayanamsa, sidereal conversion, nakshatra,
                      KP sub-lord, ascendant, Placidus cusps, chart builder
  data.js             classical significations (planet/sign body parts, ailments,
                      house meanings, dignities, KP house groups)
  parashara.js        Parashara health analysis engine
  kp.js               KP health analysis engine
  varga.js            divisional charts: D3 Drekkana, D6 Shashthamsa, D9 navamsa,
                      22nd Drekkana lord, 64th Navamsa lord
  dasha.js            Vimshottari Maha/Antar/Pratyantar dasha + current periods
  kp-dasha.js         KP analysis of the running dasha for health (significators)
  d6.js               D6 Shashthamsa (health/disease) chart analysis
  shadbala.js         Shadbala strength + speed/direction/declination, health read
  health-topics.js    health-question knowledge base + keyword classifier
  qa.js               natural-language question engine (likelihood, organ, timing)
  predict.js          synthesis -> pinpoints weakest body part & probable issue
  app.js              UI wiring (geocoding, rendering, orchestration)
```

Each engine file works both in the browser (`window.AHS.*`) and under Node
(`module.exports`), which makes the math unit-testable from the command line.

## How the calculations work

- **Ephemeris:** compact orbital-element method (Paul Schlyter) with the major
  perturbation terms for the Moon and for Jupiter/Saturn. Geocentric tropical
  longitudes are then converted to **sidereal** by subtracting the Lahiri ayanamsa.
  Accuracy is within a few arc-minutes — ample for sign, nakshatra and KP
  sub-division boundaries.
- **Houses:** Parashara uses **whole-sign** houses; KP uses **Placidus** cusps
  (semi-arc trisection), which is required for cuspal sub-lord analysis.
- **KP sub-lord:** each nakshatra (13°20′) is divided into nine unequal parts in
  Vimshottari-dasha proportion, starting from the star lord.

### Validation performed

- Planetary positions cross-checked at **J2000.0** and against **live transit data
  for June 2026** (Jupiter ≈ Cancer 27°, Saturn ≈ Aries 13°) — matches to
  arc-minutes.
- Placidus cusps verified to reduce to equal right-ascension division at the equator
  and to remain monotonic and ~30° apart at mid-latitudes.
- Ascendant verified against the sunrise→sign progression for the sample chart
  (Scorpio rising for a 14:30 Mumbai birth).

## Limitations

- Interpretations are **deterministic summaries** of classical rules, not the nuanced
  judgement of an experienced astrologer.
- Historical/forecast outer-planet perturbations are simplified; for research-grade
  precision use a Swiss Ephemeris–based tool.
- Daylight-saving handling depends on the offset you confirm at input time.

## License / attribution

Built from classical Parashara and KP principles. Ephemeris algorithm based on the
publicly documented method by Paul Schlyter (re-implemented; no source text copied).
Content rephrased for compliance with licensing restrictions.
