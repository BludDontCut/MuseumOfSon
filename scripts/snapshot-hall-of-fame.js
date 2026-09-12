#!/usr/bin/env node
/**
 * Museum of SON — weekly Hall of Fame snapshot
 *
 * Meant to be run by .github/workflows/weekly-hall-of-fame.yml on a cron
 * (see that file). It reads the just-finished week's like counts from the
 * counting API and appends the winner to data/hall-of-fame-history.json,
 * so the "weekly Hall of Fame" has a permanent, browsable archive instead
 * of only ever showing the current week.
 *
 * Usage: node scripts/snapshot-hall-of-fame.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "data", "manifest.json");
const HISTORY_PATH = path.join(ROOT, "data", "hall-of-fame-history.json");
const BASE_URL = "https://countapi.mileshilliard.com/api/v1";
const NAMESPACE = "museum-of-son-v1";

function key(name) {
  return `${NAMESPACE}_${name}`.replace(/[^A-Za-z0-9_\-.]/g, "-");
}

// Compute the ISO week that just ended (this script is intended to run
// early Monday UTC, so "last week" is the one we're closing the book on).
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function getCount(name) {
  try {
    const res = await fetch(`${BASE_URL}/get/${key(name)}`);
    if (!res.ok) return 0;
    const data = await res.json();
    return data.value ?? data.count ?? 0;
  } catch {
    return 0;
  }
}

async function main() {
  const now = new Date();
  const lastWeekDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // safely inside last week
  const week = isoWeek(lastWeekDate);

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  if (!manifest.length) {
    console.log("Manifest is empty, nothing to snapshot.");
    return;
  }

  const counts = await Promise.all(
    manifest.map(async (p) => ({ piece: p, count: await getCount(`like_${week}_${p.id}`) }))
  );
  counts.sort((a, b) => b.count - a.count);
  const winner = counts[0];

  const history = fs.existsSync(HISTORY_PATH) ? JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8")) : [];

  if (history.some((h) => h.week === week)) {
    console.log(`Week ${week} already snapshotted, skipping.`);
    return;
  }
  if (winner.count === 0) {
    console.log(`No likes recorded for week ${week}, skipping snapshot.`);
    return;
  }

  history.unshift({
    week,
    pieceId: winner.piece.id,
    title: winner.piece.title,
    src: winner.piece.src,
    contributor: winner.piece.contributor,
    likes: winner.count,
    snapshotAt: now.toISOString(),
  });

  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + "\n");
  console.log(`Recorded ${week} winner: "${winner.piece.title}" with ${winner.count} likes.`);
}

main();
