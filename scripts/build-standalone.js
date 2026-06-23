/*
 * build-standalone.js
 * Generates the single-file standalone build by inlining css/styles.css and all
 * js/*.js (in load order) into the modular template (index-modular.html).
 *
 * Outputs (identical content):
 *   - index.html                          (served at the GitHub Pages root)
 *   - astrological-health-screener.html   (explicitly named standalone copy)
 *
 * Usage:  node scripts/build-standalone.js
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..") + "/";
const template = fs.readFileSync(root + "index-modular.html", "utf8");
const css = fs.readFileSync(root + "css/styles.css", "utf8");

// Load order matters (engine deps first, app.js last).
const jsFiles = [
  "js/ephemeris.js", "js/astro-core.js", "js/data.js", "js/parashara.js",
  "js/kp.js", "js/varga.js", "js/neecha.js", "js/dasha.js", "js/d6.js", "js/shadbala.js", "js/kp-dasha.js", "js/health-topics.js", "js/qa.js", "js/predict.js", "js/app.js"
];
const js = jsFiles.map(function (f) {
  return "/* ===== " + f + " ===== */\n" + fs.readFileSync(root + f, "utf8");
}).join("\n\n");

const out = template
  .replace(/<link rel="stylesheet" href="css\/styles\.css" \/>/, "<style>\n" + css + "\n  </style>")
  .replace(/  <!-- Engine scripts \(order matters\) -->[\s\S]*?<script src="js\/app\.js"><\/script>/,
    "  <!-- All engine + UI code inlined for standalone deployment -->\n  <script>\n" + js + "\n  </script>");

fs.writeFileSync(root + "astrological-health-screener.html", out);
fs.writeFileSync(root + "index.html", out);

const refs = out.match(/(href|src)="(css|js)\/[^"]*"/g);
console.log("Built standalone (" + out.length + " bytes). External css/js refs: " + (refs ? refs.join(", ") : "none"));
