/* Museum of SON — shared helpers (loaded before app.js / hof.js) */

function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function weekLabel(weekId) {
  return `Exhibiting week ${weekId.split("-W")[1]}, ${weekId.split("-")[0]}`;
}

const likeKeyAllTime = (id) => `like_all_${id}`;
const likeKeyWeekly = (id, week) => `like_${week}_${id}`;

const svgHeart = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.35-9.3-8.1C.8 9.9 1.6 6.4 4.6 5c2.3-1.1 4.8-.2 6 1.6.6.9 1 1.5 1.4 2.1.4-.6.8-1.2 1.4-2.1 1.2-1.8 3.7-2.7 6-1.6 3 1.4 3.8 4.9 1.9 7.9C18.7 16.65 12 21 12 21z"/></svg>`;
const svgDownload = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

async function downloadImage(src, filename) {
  if (!src) return;
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || "son-meme.jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (e) {
    const a = document.createElement("a");
    a.href = src;
    a.download = filename || "son-meme.jpg";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function slug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function frameHTML(piece, likeCount) {
  const img = piece.src
    ? `<img src="${piece.src}" alt="${escapeHtml(piece.title)}" loading="lazy">`
    : `<div class="art-slot placeholder">awaiting<br>acquisition</div>`;
  const filename = piece.filename || `${slug(piece.title || "son")}.jpg`;
  return `
    <div class="piece" data-id="${piece.id}">
      <div class="frame" tabindex="0" role="button" aria-label="View ${escapeHtml(piece.title)} full size">
        <div class="spotlight"></div>
        <div class="mat">${img}</div>
      </div>
      <div class="plaque-label">
        <div class="p-title">${escapeHtml(piece.title)}</div>
        <div class="p-meta">Donated by ${escapeHtml(piece.contributor || "Anonymous")}</div>
      </div>
      <div class="like-row">
        <button class="like-btn" data-like-id="${piece.id}">
          ${svgHeart} <span class="like-count">${likeCount ?? "…"}</span>
        </button>
        ${piece.src ? `
        <button class="download-btn" data-src="${piece.src}" data-filename="${escapeHtml(filename)}" title="Download ${escapeHtml(piece.title)}" aria-label="Download ${escapeHtml(piece.title)}">
          ${svgDownload}
        </button>` : ""}
      </div>
    </div>`;
}

function wireLikesAndLightbox() {
  let currentLbSrc = "";
  let currentLbFilename = "";

  document.addEventListener("click", async (e) => {
    const dlBtn = e.target.closest(".download-btn");
    if (dlBtn) {
      e.stopPropagation();
      downloadImage(dlBtn.dataset.src, dlBtn.dataset.filename);
      return;
    }

    const lbDl = e.target.closest("#lb-download-btn");
    if (lbDl) {
      e.stopPropagation();
      downloadImage(currentLbSrc, currentLbFilename);
      return;
    }

    const btn = e.target.closest(".like-btn");
    if (btn) {
      const id = btn.dataset.likeId;
      const likedSet = JSON.parse(localStorage.getItem("mos_liked") || "[]");
      if (likedSet.includes(id)) return;
      btn.classList.add("liked");
      btn.disabled = true;
      const week = isoWeek();
      const [total] = await Promise.all([
        Counter.hit(likeKeyAllTime(id)),
        Counter.hit(likeKeyWeekly(id, week)),
      ]);
      if (total !== null) btn.querySelector(".like-count").textContent = total;
      likedSet.push(id);
      localStorage.setItem("mos_liked", JSON.stringify(likedSet));
      return;
    }

    const frame = e.target.closest(".frame");
    if (frame) {
      const img = frame.querySelector("img");
      if (!img) return;
      const piece = frame.closest(".piece");
      lbImg.src = img.src;
      lbImg.alt = img.alt;
      lbTitle.textContent = piece.querySelector(".p-title").textContent;
      lbMeta.textContent = piece.querySelector(".p-meta").textContent;
      currentLbSrc = img.src;
      currentLbFilename = piece.querySelector(".download-btn")?.dataset.filename || "son.jpg";
      lightbox.classList.add("open");
    }
  });

  const lightbox = document.getElementById("lightbox");
  if (!lightbox) return;
  const lbImg = lightbox.querySelector("img");
  const lbTitle = lightbox.querySelector(".lb-title");
  const lbMeta = lightbox.querySelector(".lb-meta");

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox || e.target.closest(".lb-close")) {
      lightbox.classList.remove("open");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") lightbox.classList.remove("open");
  });
}

function wireNav() {
  const items = document.querySelectorAll(".nav-item");
  items.forEach((item) => {
    const trigger = item.querySelector("button");
    if (!trigger) return;
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = item.classList.contains("open");
      items.forEach((i) => i.classList.remove("open"));
      if (!isOpen) item.classList.add("open");
    });
  });
  document.addEventListener("click", () => items.forEach((i) => i.classList.remove("open")));
}

async function bumpVisitorCounter(targetEl) {
  const alreadyCountedThisSession = sessionStorage.getItem("mos_counted");
  const v = await (alreadyCountedThisSession ? Counter.get("visitors_total") : Counter.hit("visitors_total"));
  if (v !== null && targetEl) targetEl.textContent = v.toLocaleString();
  sessionStorage.setItem("mos_counted", "1");
}

document.addEventListener("DOMContentLoaded", wireNav);
