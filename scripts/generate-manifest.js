#!/usr/bin/env node
/**
 * Museum of SON — manifest generator
 *
 * Scans /images/sons for image files and (re)builds /data/manifest.json,
 * which is what the site reads to render frames on the wall.
 *
 * Usage:
 *   node scripts/generate-manifest.js
 *
 * Run this any time you drop new PNGs/JPGs into images/sons, then commit
 * the updated data/manifest.json. This is what makes "just drop a file in
 * the folder" work for your own bulk imports (as opposed to the live
 * "Contribute" form on the site, which writes to Firebase instead).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const IMAGES_DIR = path.join(ROOT, "images", "sons");
const MANIFEST_PATH = path.join(ROOT, "data", "manifest.json");
const VALID_EXT = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

// Auto-sectioning by keyword, checked against BOTH the filename and the
// auto-generated title (titles are usually where the actual pun lives,
// e.g. "SoneyBun", "Sonion-ring"). Add your own rows freely — order
// matters, first match wins, and anything left over falls into
// "General Collection". This is exactly the pattern to copy if you want
// more themed rooms beyond the ones below.
const SECTION_RULES = [
  {
    // food & drink puns — Sonion, Sonion-ring, SoneyBun, Saus, Soncolli...
    test: /onion|bun|sauce|saus|jam|cake|pie|taco|sandwich|burger|fries?|roll|bread|butter|cream|sushi|noodle|soup|stew|biscuit|waffle|pancake|honey|donut|doughnut|cookie|candy|chocolate|broccoli|colli|bacon|pizza|pasta|cheese|salad/i,
    section: "The Food Court",
  },
  { test: /goku|anime|manga|naruto|luffy|pikachu/i, section: "Anime Annex" },
  { test: /civic|corolla|camry|mustang|tesla|garage|engine|\bcar\b|auto/i, section: "The Motor Garage" },
  { test: /jackson|elvis|beyonce|drake|kanye|pop-?star|celeb/i, section: "Pop Culture Parlor" },
  { test: /mona|lisa|samson|davinci|vinci|michelangelo|classic|\bog\b|original/i, section: "The Classics Wing" },
  { test: /safari|fari|messenger|chrome|firefox|wifi|app|browser|software|tech/i, section: "Digital Wing" },
  { test: /father|mother|dad|mom|family|sibling/i, section: "Family Room" },
  { test: /sunset|sunrise|ocean|mountain|forest|scenic/i, section: "The Scenic Room" },
  { test: /meme|sahur|tung|viral|trend/i, section: "Internet Culture Vault" },
  { test: /remix|edit|shop|photoshop/i, section: "Contemporary Remix Room" },
  { test: /rare|deep|obscure/i, section: "Rare & Obscure Annex" },
  { test: /gold|golden|hof|fame/i, section: "Hall of Fame Archive" },
];

function titleFromFilename(filename) {
  const base = path.basename(filename, path.extname(filename));
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || "Untitled Son";
}

function sectionFor(filename, title) {
  const haystack = `${filename} ${title || ""}`;
  const hit = SECTION_RULES.find((r) => r.test.test(haystack));
  return hit ? hit.section : "General Collection";
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function loadExisting() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return [];
  }
}

function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`No such folder: ${IMAGES_DIR}`);
    process.exit(1);
  }

  const existing = loadExisting();
  const existingByFile = new Map(existing.map((e) => [e.filename, e]));

  const files = fs
    .readdirSync(IMAGES_DIR)
    .filter((f) => VALID_EXT.includes(path.extname(f).toLowerCase()))
    .sort();

  const manifest = files.map((filename, i) => {
    const prev = existingByFile.get(filename);
    const stat = fs.statSync(path.join(IMAGES_DIR, filename));
    const title = prev ? prev.title : titleFromFilename(filename);
    return (
      prev || {
        id: `son-${String(i + 1).padStart(4, "0")}-${Date.now().toString(36)}`,
        filename,
        src: `images/sons/${filename}`,
        title,
        contributor: "Museum Archive",
        section: sectionFor(filename, title),
        dateAdded: stat.mtime.toISOString(),
        weekAcquired: isoWeek(stat.mtime),
        likes: 0,
        featured: false,
      }
    );
  });

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Wrote ${manifest.length} piece(s) to ${path.relative(ROOT, MANIFEST_PATH)}`);
}

main();
