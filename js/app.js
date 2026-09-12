/* Museum of SON — homepage gallery logic (requires shared.js + counter.js) */

async function main() {
  const gallery = document.getElementById("gallery-rooms");
  const hofSlot = document.getElementById("hof-slot");
  const navGalleries = document.getElementById("nav-galleries-list");

  let pieces = [];
  try {
    const res = await fetch("data/manifest.json", { cache: "no-store" });
    pieces = await res.json();
  } catch (e) {
    console.error("Could not load manifest.json", e);
  }

  bumpVisitorCounter(document.getElementById("visitor-count"));

  /* ── populate hero metrics ── */
  const metricPieces = document.getElementById("metric-pieces");
  if (metricPieces) metricPieces.textContent = pieces.length || "—";

  /* ── populate frontispiece card with a random piece ── */
  const fpImgSlot = document.getElementById("frontispiece-img-slot");
  const fpTitle = document.getElementById("frontispiece-title");
  const fpMeta = document.getElementById("frontispiece-meta");
  if (pieces.length && fpImgSlot) {
    const fp = pieces[Math.floor(Math.random() * pieces.length)];
    if (fp.src) {
      fpImgSlot.innerHTML = `<img src="${fp.src}" alt="${escapeHtml(fp.title)}" class="frontispiece-img" style="aspect-ratio:auto;">`;
    }
    if (fpTitle) fpTitle.textContent = fp.title || "—";
    if (fpMeta) fpMeta.textContent = `Donated by ${fp.contributor || "Anonymous"}`;
  }

  if (!pieces.length) {
    gallery.innerHTML = `
      <div class="gallery-room">
        <div class="wrap">
          <div class="empty-room">
            <h3>The walls are bare.</h3>
            <p>Drop PNGs into <code>images/sons/</code>, then run
            <code>node scripts/generate-manifest.js</code> to hang them.</p>
          </div>
        </div>
      </div>`;
    hofSlot.innerHTML = `<p class="week-range">No acquisitions yet — the pedestal awaits its first champion.</p>`;
    navGalleries.innerHTML = `<a href="#">No rooms yet</a>`;
    return;
  }

  const sections = new Map();
  for (const p of pieces) {
    const s = p.section || "General Collection";
    if (!sections.has(s)) sections.set(s, []);
    sections.get(s).push(p);
  }

  const allTimeKeys = pieces.map((p) => likeKeyAllTime(p.id));
  const likeCounts = await Counter.getMany(allTimeKeys);

  let roomsHTML = "";
  for (const [section, items] of sections) {
    roomsHTML += `
      <section class="gallery-room" id="room-${slug(section)}">
        <div class="wrap">
          <div class="room-header">
            <div>
              <h2>${escapeHtml(section)}</h2>
              <p>${items.length} work${items.length === 1 ? "" : "s"} on permanent display</p>
            </div>
          </div>
          <div class="frame-grid">
            ${items.map((p) => frameHTML(p, likeCounts[likeKeyAllTime(p.id)] ?? 0)).join("")}
          </div>
        </div>
      </section>`;
  }
  gallery.innerHTML = roomsHTML;

  navGalleries.innerHTML = [...sections.entries()]
    .map(([s, items]) => `<a href="#room-${slug(s)}">${escapeHtml(s)} <span class="count">${items.length}</span></a>`)
    .join("");

  const week = isoWeek();
  const weeklyKeys = pieces.map((p) => likeKeyWeekly(p.id, week));
  const weeklyCounts = await Counter.getMany(weeklyKeys);
  const ranked = pieces
    .map((p) => ({ p, count: weeklyCounts[likeKeyWeekly(p.id, week)] ?? 0 }))
    .sort((a, b) => b.count - a.count);

  const winner = ranked[0];
  if (winner && winner.count > 0) {
    hofSlot.innerHTML = `
      <p class="week-range">${weekLabel(week)} · ${winner.count} like${winner.count === 1 ? "" : "s"} this week</p>
      <div class="hof-winner">
        ${frameHTML(winner.p, likeCounts[likeKeyAllTime(winner.p.id)] ?? 0)}
        <span class="hof-crown">★ Curator's Choice, This Week ★</span>
      </div>`;
  } else {
    hofSlot.innerHTML = `
      <p class="week-range">${weekLabel(week)}</p>
      <div class="hof-winner">
        ${frameHTML(pieces[0], likeCounts[likeKeyAllTime(pieces[0].id)] ?? 0)}
        <span class="hof-crown">Be the first to like a piece this week</span>
      </div>`;
  }

  wireLikesAndLightbox();
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("gallery-rooms")) main();
});
