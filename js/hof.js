/* Museum of SON — Hall of Fame page logic (requires shared.js + counter.js) */

async function main() {
  const hofSlot = document.getElementById("hof-slot");
  const leaderboardEl = document.getElementById("leaderboard");
  const historyEl = document.getElementById("history-list");

  bumpVisitorCounter(document.getElementById("visitor-count"));

  let pieces = [];
  let history = [];
  try {
    const [pRes, hRes] = await Promise.all([
      fetch("data/manifest.json", { cache: "no-store" }),
      fetch("data/hall-of-fame-history.json", { cache: "no-store" }),
    ]);
    pieces = await pRes.json();
    history = await hRes.json();
  } catch (e) {
    console.error(e);
  }

  if (!pieces.length) {
    hofSlot.innerHTML = `<p class="week-range">No acquisitions yet.</p>`;
    leaderboardEl.innerHTML = "";
    historyEl.innerHTML = `<p style="color:var(--ivory-dim);text-align:center;">No history recorded yet — check back after the first week closes.</p>`;
    return;
  }

  const allTimeKeys = pieces.map((p) => likeKeyAllTime(p.id));
  const likeCounts = await Counter.getMany(allTimeKeys);

  // current week spotlight
  const week = isoWeek();
  const weeklyKeys = pieces.map((p) => likeKeyWeekly(p.id, week));
  const weeklyCounts = await Counter.getMany(weeklyKeys);
  const ranked = pieces
    .map((p) => ({ p, count: weeklyCounts[likeKeyWeekly(p.id, week)] ?? 0 }))
    .sort((a, b) => b.count - a.count);
  const winner = ranked[0];

  hofSlot.innerHTML = winner && winner.count > 0
    ? `
      <p class="week-range">${weekLabel(week)} · ${winner.count} like${winner.count === 1 ? "" : "s"} so far</p>
      <div class="hof-winner">
        ${frameHTML(winner.p, likeCounts[likeKeyAllTime(winner.p.id)] ?? 0)}
        <span class="hof-crown">★ Currently in the lead ★</span>
      </div>`
    : `
      <p class="week-range">${weekLabel(week)}</p>
      <div class="hof-winner">
        ${frameHTML(pieces[0], likeCounts[likeKeyAllTime(pieces[0].id)] ?? 0)}
        <span class="hof-crown">Be the first to like a piece this week</span>
      </div>`;

  // all-time leaderboard
  const allTimeRanked = pieces
    .map((p) => ({ p, count: likeCounts[likeKeyAllTime(p.id)] ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  leaderboardEl.innerHTML = allTimeRanked
    .map(
      ({ p, count }, i) => `
      <li class="lb-row">
        <span class="lb-rank">${i + 1}</span>
        <span class="lb-thumb">${p.src ? `<img src="${p.src}" alt="${escapeHtml(p.title)}">` : ""}</span>
        <span class="lb-title">${escapeHtml(p.title)}<small>by ${escapeHtml(p.contributor || "Anonymous")}</small></span>
        <span class="lb-likes">${count} ♥</span>
      </li>`
    )
    .join("");

  // historical weekly winners
  historyEl.innerHTML = history.length
    ? history
        .map(
          (h) => `
        <div class="hist-card">
          ${h.src ? `<img src="${h.src}" alt="${escapeHtml(h.title)}">` : ""}
          <div class="hist-week">${weekLabel(h.week)}</div>
          <div class="hist-title">${escapeHtml(h.title)}</div>
          <div class="hist-meta">${h.likes} like${h.likes === 1 ? "" : "s"} · by ${escapeHtml(h.contributor || "Anonymous")}</div>
        </div>`
        )
        .join("")
    : `<p style="color:var(--ivory-dim);text-align:center;">The archive starts filling in after the first week closes — the weekly snapshot runs automatically every Monday.</p>`;

  wireLikesAndLightbox();
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("leaderboard")) main();
});
