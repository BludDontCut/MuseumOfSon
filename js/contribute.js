/* Museum of SON — Contribute page logic (requires shared.js + counter.js) */

/**
 * 🌐 Direct In-Browser Donation Backend:
 *
 * Deploy the Cloudflare Worker script in `cloudflare-worker/worker.js` (takes ~2 mins, 100% free),
 * then paste your Worker URL below.
 *
 * Example:
 *   const WORKER_URL = "https://museum-of-son-donate.sanidhya.workers.dev";
 */
const WORKER_URL = "https://museum-of-son-donate.sanidhyalabh139.workers.dev";

// Fallback GitHub repository for issue submissions:
const REPO = "BludDontCut/MuseumOfSon";

document.addEventListener("DOMContentLoaded", () => {
  bumpVisitorCounter(document.getElementById("visitor-count"));

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const preview = document.getElementById("preview");
  const dzText = document.getElementById("dz-text");
  const titleInput = document.getElementById("title-input");
  const contributorInput = document.getElementById("contributor-input");
  const sectionSelect = document.getElementById("section-select");
  const submitBtn = document.getElementById("submit-btn");
  const status = document.getElementById("status-msg");

  let chosenFile = null;

  function showFile(file) {
    if (!file.type.startsWith("image/")) {
      status.textContent = "Please select an image file (PNG, JPG, WebP, or GIF).";
      status.className = "status-msg show err";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      status.textContent = "Image is too large. Please select an image under 5 MB.";
      status.className = "status-msg show err";
      return;
    }

    status.className = "status-msg";
    chosenFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.style.display = "block";
      if (dzText) dzText.style.display = "none";
    };
    reader.readAsDataURL(file);
  }

  function resetForm() {
    titleInput.value = "";
    contributorInput.value = "";
    sectionSelect.selectedIndex = 0;
    chosenFile = null;
    fileInput.value = "";
    preview.src = "";
    preview.style.display = "none";
    if (dzText) dzText.style.display = "block";
  }

  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) showFile(fileInput.files[0]);
  });
  ["dragover", "dragenter"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("drag");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) showFile(file);
  });

  submitBtn.addEventListener("click", async () => {
    const title = titleInput.value.trim();
    if (!title) {
      status.textContent = "Please give your artwork a title.";
      status.className = "status-msg show err";
      titleInput.focus();
      return;
    }
    if (!chosenFile) {
      status.textContent = "Please select or drag an image into the box.";
      status.className = "status-msg show err";
      return;
    }

    const contributor = contributorInput.value.trim() || "Anonymous";
    const section = sectionSelect.value;

    // ── Option A: Direct In-Browser Upload via Cloudflare Worker ──
    if (WORKER_URL && WORKER_URL.startsWith("http")) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Hanging your artwork in the gallery...";
      status.textContent = "Uploading image and notifying the automated curator...";
      status.className = "status-msg show info";

      try {
        // Read file as base64
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            const base64 = result.split(",")[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(chosenFile);
        });

        const res = await fetch(WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            contributor,
            section,
            imageBase64: base64Data,
            imageType: chosenFile.type,
          }),
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || `Server error (${res.status})`);
        }

        status.innerHTML = `🎉 <strong>It's hung!</strong> Thank you for your donation. <em>"${escapeHtml(
          title
        )}"</em> has been accepted into the museum and will appear on the walls in about a minute once the live gallery rebuilds.<br><br><a href="index.html">← Return to Galleries</a>`;
        status.className = "status-msg show ok";
        resetForm();
      } catch (err) {
        console.error("Donation failed:", err);
        status.innerHTML = `<strong>Could not donate:</strong> ${escapeHtml(
          err.message
        )}. Please check your internet connection and try again.`;
        status.className = "status-msg show err";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit to the Collection";
      }
      return;
    }

    // ── Option B: Fallback if WORKER_URL has not been set yet ──
    const url = new URL(`https://github.com/${REPO}/issues/new`);
    url.searchParams.set("template", "contribute-a-son.yml");
    url.searchParams.set("title", title);
    if (contributor && contributor !== "Anonymous") url.searchParams.set("contributor", contributor);
    url.searchParams.set("section", section);
    url.searchParams.set("labels", "contribution");

    status.innerHTML = `
      <strong>To enable 1-click in-browser uploads (no GitHub account needed):</strong><br>
      Follow the quick guide in <code>cloudflare-worker/README.md</code> to deploy your free Cloudflare Worker and paste its URL into <code>js/contribute.js</code>.<br><br>
      <small>Or if you have a GitHub account right now: <a href="${url.toString()}" target="_blank" rel="noopener">click here to submit as a GitHub Issue</a>.</small>
    `;
    status.className = "status-msg show info";
  });
});
