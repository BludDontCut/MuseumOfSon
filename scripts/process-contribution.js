#!/usr/bin/env node
/**
 * Museum of SON — contribution processor
 *
 * Run by .github/workflows/add-contribution.yml whenever someone submits
 * the "Contribute a Son" issue form. Parses the issue body, downloads the
 * dragged-in image, saves it to images/sons/, and appends an entry to
 * data/manifest.json. The workflow then commits the result — so a
 * contribution goes from "submitted" to "hanging on the wall" with no
 * human moderation step in between.
 *
 * If you'd rather review submissions before they go live, add a manual
 * "approve" step in the workflow (see the comment down there) instead of
 * auto-committing.
 *
 * Env vars expected (set by the workflow):
 *   ISSUE_BODY   - raw issue body markdown
 *   ISSUE_NUMBER - issue number, used to make a stable id/filename
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const IMAGES_DIR = path.join(ROOT, "images", "sons");
const MANIFEST_PATH = path.join(ROOT, "data", "manifest.json");

function section(body) {
  const parts = getField(body, "Gallery section");
  return parts && parts !== "_No response_" ? parts.trim() : "General Collection";
}

function getField(body, heading) {
  const re = new RegExp(`###\\s*${heading}\\s*\\n+([\\s\\S]*?)(?=\\n###|$)`, "i");
  const m = body.match(re);
  return m ? m[1].trim() : "";
}

function findImageUrl(body) {
  const m = body.match(
    /https:\/\/(?:github\.com\/user-attachments\/assets\/[^\s)"']+|user-images\.githubusercontent\.com\/[^\s)"']+)/i
  );
  return m ? m[0] : null;
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "son";
}

async function main() {
  const body = process.env.ISSUE_BODY || "";
  const issueNumber = process.env.ISSUE_NUMBER || Date.now();

  const title = getField(body, "Title") || `Untitled Son #${issueNumber}`;
  const contributorRaw = getField(body, "Your name or handle");
  const contributor = contributorRaw && contributorRaw !== "_No response_" ? contributorRaw : "Anonymous";
  const imageUrl = findImageUrl(body);

  if (!imageUrl) {
    console.error("No image URL found in issue body — nothing to do.");
    process.exit(1);
  }

  const res = await fetch(imageUrl);
  if (!res.ok) {
    console.error(`Failed to download image: ${res.status}`);
    process.exit(1);
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  const ext = (imageUrl.match(/\.(png|jpe?g|webp|gif)(?:\?|$)/i)?.[1] || "png").toLowerCase();
  const filename = `${slugify(title)}-${issueNumber}.${ext}`;
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer);

  const manifest = fs.existsSync(MANIFEST_PATH) ? JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) : [];
  const now = new Date();
  manifest.push({
    id: `son-issue-${issueNumber}`,
    filename,
    src: `images/sons/${filename}`,
    title,
    contributor,
    section: section(body),
    dateAdded: now.toISOString(),
    weekAcquired: isoWeek(now),
    likes: 0,
    featured: false,
  });

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Added "${title}" by ${contributor} as ${filename}`);
}

main();
