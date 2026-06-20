/*
 * health-topics.js
 * Knowledge base that maps a free-text health question to the relevant
 * astrological factors (houses, planetary karakas, body parts), plus a simple
 * keyword classifier.
 *
 * Sign indices: Aries 0 ... Pisces 11.
 * Works in browser (window.AHS.topics) and Node.
 */
(function (root) {
  "use strict";

  // severity: acute = sudden/event-like; chronic = long-developing.
  var TOPICS = [
    {
      id: "heart", label: "heart / cardiac issue (e.g. heart attack)",
      keywords: ["heart attack", "heart", "cardiac", "coronary", "myocard", "chest pain", "angina", "palpitation"],
      houses: [4, 5], karakas: ["Sun"], support: ["Moon"],
      malefics: ["Saturn", "Mars", "Rahu"], bodyParts: ["heart", "chest"],
      signs: [3, 4], severity: "acute"
    },
    {
      id: "cancer", label: "cancer / malignancy",
      keywords: ["cancer", "tumor", "tumour", "malignan", "carcinoma", "oncolog", "growth", "lump"],
      houses: [6, 8], karakas: ["Saturn", "Rahu", "Ketu"], support: ["Moon", "Mars"],
      malefics: ["Saturn", "Rahu", "Ketu"], bodyParts: [],
      signs: [], severity: "chronic", organSearch: true
    },
    {
      id: "diabetes", label: "diabetes / blood sugar",
      keywords: ["diabet", "blood sugar", "insulin", "sugar level", "glucose"],
      houses: [6], karakas: ["Venus", "Jupiter"], support: [],
      malefics: ["Saturn", "Rahu"], bodyParts: ["pancreas", "liver"], signs: [11], severity: "chronic"
    },
    {
      id: "kidney", label: "kidney / urinary system",
      keywords: ["kidney", "renal", "urinary", "urine", "bladder", "nephro"],
      houses: [7], karakas: ["Venus"], support: [], malefics: ["Saturn", "Mars"],
      bodyParts: ["kidneys & urinary tract", "bladder"], signs: [6], severity: "chronic"
    },
    {
      id: "liver", label: "liver disorder",
      keywords: ["liver", "hepat", "jaundice", "cirrhosis"],
      houses: [5, 9], karakas: ["Jupiter"], support: [], malefics: ["Saturn", "Mars", "Rahu"],
      bodyParts: ["liver"], signs: [8], severity: "chronic"
    },
    {
      id: "mental", label: "mental / emotional health (anxiety, depression)",
      keywords: ["depress", "anxiety", "mental", "stress", "panic", "psych", "mind", "insomnia", "sleep"],
      houses: [1, 5], karakas: ["Moon", "Mercury"], support: ["Jupiter"],
      malefics: ["Saturn", "Rahu", "Ketu"], bodyParts: ["mind & emotions", "nervous system"], signs: [], severity: "chronic"
    },
    {
      id: "accident", label: "accident / injury / surgery",
      keywords: ["accident", "injury", "injur", "fracture", "surgery", "operation", "wound", "cut", "fall"],
      houses: [6, 8], karakas: ["Mars", "Ketu"], support: [], malefics: ["Mars", "Saturn", "Rahu", "Ketu"],
      bodyParts: ["blood", "muscles", "bones & joints"], signs: [0], severity: "acute"
    },
    {
      id: "bp", label: "blood pressure / hypertension",
      keywords: ["blood pressure", "hypertension", "bp", "hypotension"],
      houses: [4], karakas: ["Sun", "Mars"], support: ["Moon"], malefics: ["Saturn", "Rahu"],
      bodyParts: ["heart", "blood", "arterial system"], signs: [], severity: "chronic"
    },
    {
      id: "respiratory", label: "respiratory / lungs (asthma, breathing)",
      keywords: ["asthma", "lung", "respirat", "breath", "bronch", "cough", "pneumon", "tuberc"],
      houses: [3, 4], karakas: ["Mercury", "Moon"], support: [], malefics: ["Saturn", "Ketu"],
      bodyParts: ["lungs", "respiratory tract"], signs: [2], severity: "chronic"
    },
    {
      id: "joints", label: "bones / joints / arthritis",
      keywords: ["arthrit", "joint", "bone", "knee", "spine", "back pain", "osteo", "rheumat"],
      houses: [1], karakas: ["Saturn"], support: [], malefics: ["Saturn", "Rahu"],
      bodyParts: ["bones & joints", "knees"], signs: [9], severity: "chronic"
    },
    {
      id: "skin", label: "skin condition",
      keywords: ["skin", "derma", "eczema", "psoriasis", "rash", "allerg"],
      houses: [6], karakas: ["Mercury", "Saturn"], support: [], malefics: ["Saturn", "Rahu", "Mars"],
      bodyParts: ["skin"], signs: [], severity: "chronic"
    },
    {
      id: "digestive", label: "digestive / stomach",
      keywords: ["stomach", "digest", "ulcer", "acidity", "gastr", "intestin", "bowel", "ibs", "constipat"],
      houses: [5, 6], karakas: ["Moon", "Mercury"], support: ["Jupiter"], malefics: ["Mars", "Saturn"],
      bodyParts: ["stomach", "intestines", "digestive system"], signs: [5], severity: "chronic"
    },
    {
      id: "eye", label: "eyes / vision",
      keywords: ["eye", "vision", "sight", "blind", "cataract", "retina"],
      houses: [2, 12], karakas: ["Sun", "Venus"], support: ["Moon"], malefics: ["Saturn", "Mars"],
      bodyParts: ["eyes"], signs: [], severity: "chronic"
    },
    {
      id: "reproductive", label: "reproductive / fertility",
      keywords: ["reproduc", "fertil", "pregnan", "uterus", "ovary", "prostate", "sperm", "menstr", "sexual"],
      houses: [7, 8], karakas: ["Venus", "Mars"], support: ["Jupiter", "Moon"], malefics: ["Saturn", "Rahu", "Ketu"],
      bodyParts: ["reproductive organs"], signs: [7], severity: "chronic"
    },
    {
      id: "thyroid", label: "thyroid / hormonal / throat",
      keywords: ["thyroid", "hormon", "throat", "goiter", "endocrine"],
      houses: [2], karakas: ["Mercury", "Venus", "Jupiter"], support: [], malefics: ["Saturn", "Rahu"],
      bodyParts: ["throat", "hormonal/endocrine balance"], signs: [1], severity: "chronic"
    },
    {
      id: "neuro", label: "neurological / nervous system",
      keywords: ["nerv", "neuro", "parkinson", "epilep", "seizure", "stroke", "paralys", "migraine"],
      houses: [3], karakas: ["Mercury", "Saturn"], support: [], malefics: ["Saturn", "Rahu", "Ketu"],
      bodyParts: ["nervous system"], signs: [], severity: "chronic"
    },
    {
      id: "infection", label: "infection / fever",
      keywords: ["infect", "fever", "viral", "virus", "bacteri", "flu", "sepsis"],
      houses: [6], karakas: ["Mars", "Ketu"], support: [], malefics: ["Mars", "Rahu", "Ketu"],
      bodyParts: ["blood"], signs: [], severity: "acute"
    }
  ];

  var GENERIC = {
    id: "general", label: "general health",
    keywords: [], houses: [1, 6, 8], karakas: ["Sun", "Moon", "Saturn"], support: [],
    malefics: ["Saturn", "Mars", "Rahu", "Ketu"], bodyParts: [], signs: [], severity: "both", organSearch: true
  };

  // Classify a free-text question -> best matching topic (or generic).
  function classify(text) {
    var q = (text || "").toLowerCase();
    var best = null, bestHits = 0;
    TOPICS.forEach(function (t) {
      var hits = 0;
      t.keywords.forEach(function (k) { if (q.indexOf(k) >= 0) hits++; });
      if (hits > bestHits) { bestHits = hits; best = t; }
    });
    return { topic: best || GENERIC, matched: !!best, hits: bestHits };
  }

  var api = { TOPICS: TOPICS, GENERIC: GENERIC, classify: classify };
  root.AHS = root.AHS || {};
  root.AHS.topics = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
