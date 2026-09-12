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
 * Env vars expected (set by the workflow):
 *   ISSUE_BODY   - raw issue body markdown
 *   ISSUE_NUMBER - issue number, used to make a stable id/filename
 *
 * Or pass issue number as argument:
 *   node scripts/process-contribution.js 2
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
    /https:\/\/(?:github\.com\/user-attachments\/assets\/[^\s)"']+|user-images\.githubusercontent\.com\/[^\s)"']+|raw\.githubusercontent\.com\/[^\s)"']+|camo\.githubusercontent\.com\/[^\s)"']+)/i
  );
  return m ? m[0] : null;
}

function detectExtension(imageUrl, contentType, buffer) {
  if (buffer && buffer.length >= 4) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return "gif";
    if (
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) return "webp";
  }
  if (contentType) {
    const ct = contentType.toLowerCase();
    if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
    if (ct.includes("png")) return "png";
    if (ct.includes("webp")) return "webp";
    if (ct.includes("gif")) return "gif";
  }
  const match = imageUrl.match(/\.(png|jpe?g|webp|gif)(?:\?|$)/i);
  if (match) return match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
  return "png";
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
  let body = process.env.ISSUE_BODY || "";
  let issueNumber = process.env.ISSUE_NUMBER || process.argv[2];

  if (!body && issueNumber) {
    console.log(`Fetching issue #${issueNumber} from GitHub...`);
    const resp = await fetch(`https://api.github.com/repos/BludDontCut/MuseumOfSon/issues/${issueNumber}`);
    if (!resp.ok) {
      console.error(`Failed to fetch issue #${issueNumber}: ${resp.status}`);
      process.exit(1);
    }
    const issueData = await resp.json();
    body = issueData.body || "";
  }

  if (!issueNumber) {
    issueNumber = Date.now();
  }

  const title = getField(body, "Title") || `Untitled Son #${issueNumber}`;
  const contributorRaw = getField(body, "Your name or handle");
  const contributor = contributorRaw && contributorRaw !== "_No response_" ? contributorRaw : "Anonymous";
  const imageUrl = findImageUrl(body);

  if (!imageUrl) {
    console.error("No image URL found in issue body — nothing to do.");
    process.exit(1);
  }

  console.log(`Downloading image from: ${imageUrl}`);
  const res = await fetch(imageUrl);
  if (!res.ok) {
    console.error(`Failed to download image: ${res.status}`);
    process.exit(1);
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  const ext = detectExtension(imageUrl, res.headers.get("content-type"), buffer);
  const filename = `${slugify(title)}-${issueNumber}.${ext}`;
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer);

  const manifest = fs.existsSync(MANIFEST_PATH) ? JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) : [];
  const now = new Date();
  const entryId = `son-issue-${issueNumber}`;
  const newEntry = {
    id: entryId,
    filename,
    src: `images/sons/${filename}`,
    title,
    contributor,
    section: section(body),
    dateAdded: now.toISOString(),
    weekAcquired: isoWeek(now),
    likes: 0,
    featured: false,
  };

  const existingIdx = manifest.findIndex((p) => p.id === entryId || p.filename === filename);
  if (existingIdx >= 0) {
    manifest[existingIdx] = { ...manifest[existingIdx], ...newEntry };
  } else {
    manifest.push(newEntry);
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Added "${title}" by ${contributor} as ${filename}`);
}

main();
