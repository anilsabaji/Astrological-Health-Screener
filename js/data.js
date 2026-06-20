/*
 * data.js
 * Classical Vedic / KP reference data used for HEALTH interpretation.
 * Sources: standard Brihat Parashara Hora Shastra significations, the
 * Kalapurusha (cosmic body) sign-to-bodypart mapping, and common KP house
 * groupings. This is reference knowledge, not reproduced source text.
 *
 * Works in the browser (window.AHS.data) and Node (module.exports).
 */
(function (root) {
  "use strict";

  // Natural benefic / malefic classification (Moon & Mercury treated neutral-ish
  // but here simplified; refined for waxing Moon elsewhere if needed).
  var NATURE = {
    Sun: "malefic", Moon: "benefic", Mars: "malefic", Mercury: "benefic",
    Jupiter: "benefic", Venus: "benefic", Saturn: "malefic",
    Rahu: "malefic", Ketu: "malefic"
  };

  // Exaltation / debilitation sign index (0=Aries..11=Pisces); deep degree noted.
  var DIGNITY = {
    Sun: { exalt: 0, debil: 6, own: [4] },           // exalt Aries, debil Libra, own Leo
    Moon: { exalt: 1, debil: 7, own: [3] },          // exalt Taurus, debil Scorpio, own Cancer
    Mars: { exalt: 9, debil: 3, own: [0, 7] },       // exalt Capricorn, debil Cancer, own Aries/Scorpio
    Mercury: { exalt: 5, debil: 11, own: [2, 5] },   // exalt Virgo, debil Pisces, own Gemini/Virgo
    Jupiter: { exalt: 3, debil: 9, own: [8, 11] },   // exalt Cancer, debil Capricorn, own Sag/Pisces
    Venus: { exalt: 11, debil: 5, own: [1, 6] },     // exalt Pisces, debil Virgo, own Taurus/Libra
    Saturn: { exalt: 6, debil: 0, own: [9, 10] },    // exalt Libra, debil Aries, own Cap/Aquarius
    Rahu: { exalt: 1, debil: 7, own: [] },
    Ketu: { exalt: 7, debil: 1, own: [] }
  };

  // Planet -> body parts / physiological systems governed
  var PLANET_BODY = {
    Sun: ["heart", "bones", "right eye (males) / left eye (females)", "head", "spine", "general vitality & immunity"],
    Moon: ["mind & emotions", "blood & body fluids", "stomach", "lungs", "left eye (males) / right eye (females)", "breasts", "lymphatic system"],
    Mars: ["blood", "bone marrow", "muscles", "genitals", "energy/metabolism"],
    Mercury: ["nervous system", "skin", "speech & vocal cords", "respiratory tract", "intellect", "hands"],
    Jupiter: ["liver", "fat tissue", "pancreas", "spleen", "thighs", "arterial system"],
    Venus: ["reproductive organs", "kidneys & urinary tract", "throat", "face", "eyes", "hormonal/endocrine balance"],
    Saturn: ["bones & joints", "teeth", "knees", "nerves", "skin (chronic)", "muscular contraction"],
    Rahu: ["nervous disorders", "skin", "feet", "undiagnosed/mysterious conditions"],
    Ketu: ["wounds & surgery", "infections", "abdomen", "spine", "mysterious/auto-immune conditions"]
  };

  // Planet -> tendencies / ailments often associated (astrological tradition)
  var PLANET_AILMENTS = {
    Sun: ["fevers", "cardiac issues", "blood pressure", "eye strain", "bone/spine problems", "low immunity"],
    Moon: ["mental/emotional stress", "anxiety", "anaemia & blood disorders", "digestive/stomach issues", "cough & cold", "fluid retention"],
    Mars: ["accidents & injuries", "inflammation", "infections & fevers", "surgery", "blood disorders", "burns", "muscular strain"],
    Mercury: ["nervous disorders", "skin allergies", "speech issues", "respiratory complaints", "anxiety/over-thinking"],
    Jupiter: ["liver disorders", "diabetes", "obesity/weight gain", "cholesterol", "swelling/oedema"],
    Venus: ["reproductive/urinary issues", "kidney problems", "hormonal imbalance", "throat ailments", "diabetes (with Jupiter)"],
    Saturn: ["chronic & long-term ailments", "arthritis & joint pain", "dental problems", "nerve pain", "depression", "fatigue", "degenerative conditions"],
    Rahu: ["undiagnosed/mysterious illness", "phobias & anxiety", "poisoning/toxicity", "skin conditions", "viral infections"],
    Ketu: ["surgical conditions", "infections", "ulcers", "mysterious/auto-immune issues", "accidents"]
  };

  // Sign (0..11) -> body part per Kalapurusha (head to feet)
  var SIGN_BODY = [
    ["head", "brain", "face (upper)"],                         // Aries
    ["face", "throat", "neck", "eyes", "teeth"],               // Taurus
    ["shoulders", "arms", "hands", "lungs", "nervous system"], // Gemini
    ["chest", "lungs", "breasts", "stomach", "heart region"],  // Cancer
    ["heart", "upper back", "spine", "upper abdomen"],         // Leo
    ["intestines", "digestive system", "abdomen"],             // Virgo
    ["kidneys", "lower back", "lumbar region"],                // Libra
    ["genitals", "excretory organs", "bladder", "reproductive"], // Scorpio
    ["hips", "thighs", "arterial system", "liver"],            // Sagittarius
    ["knees", "joints", "bones", "skin"],                      // Capricorn
    ["calves", "ankles", "circulatory system"],                // Aquarius
    ["feet", "lymphatic system", "general fluids"]             // Pisces
  ];

  // House significations relevant to health/medical KP & Parashara
  var HOUSE_HEALTH = {
    1: "Body, physical constitution, vitality, head, overall well-being",
    2: "Face, right eye, teeth, mouth, nourishment/diet",
    3: "Throat, shoulders, arms, ears (right), nervous system",
    4: "Chest, lungs, heart region, emotional well-being",
    5: "Stomach, upper abdomen, heart, mental state",
    6: "DISEASE, illness, infection, injuries, debts, daily health (primary disease house)",
    7: "Pelvis, kidneys, reproductive organs, partner's health",
    8: "Chronic & incurable disease, longevity, surgery, accidents, cause of death",
    9: "Hips, thighs, arterial system",
    10: "Knees, joints, professional stress",
    11: "Calves, ankles, recovery/cure, fulfilment (positive for health)",
    12: "Hospitalization, bed-rest, loss, sleep, feet, left eye, expenditure on health"
  };

  // KP house groupings used in medical analysis
  var KP_DISEASE_HOUSES = [6, 8, 12];      // negative: disease, chronic, hospitalization
  var KP_RECOVERY_HOUSES = [1, 5, 11];     // positive: good health, recovery, cure
  // Maraka (death-inflicting) houses in Parashara
  var MARAKA_HOUSES = [2, 7];

  // House lord ownership (which houses a planet rules from a given lagna sign)
  // Provided as a helper rather than data; lagna-dependent. See engine.

  var api = {
    NATURE: NATURE,
    DIGNITY: DIGNITY,
    PLANET_BODY: PLANET_BODY,
    PLANET_AILMENTS: PLANET_AILMENTS,
    SIGN_BODY: SIGN_BODY,
    HOUSE_HEALTH: HOUSE_HEALTH,
    KP_DISEASE_HOUSES: KP_DISEASE_HOUSES,
    KP_RECOVERY_HOUSES: KP_RECOVERY_HOUSES,
    MARAKA_HOUSES: MARAKA_HOUSES
  };

  root.AHS = root.AHS || {};
  root.AHS.data = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
