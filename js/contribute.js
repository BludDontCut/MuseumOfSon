/* Museum of SON — Contribute page logic (requires shared.js + counter.js) */

// ⚠️ Set this to your actual GitHub repo before deploying, e.g.
// "your-username/museum-of-son". The Contribute button links to a
// pre-filled issue there, which .github/workflows/add-contribution.yml
// picks up automatically.
const REPO = "BludDontCut/MuseumOfSon";

document.addEventListener("DOMContentLoaded", () => {
  bumpVisitorCounter(document.getElementById("visitor-count"));

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const preview = document.getElementById("preview");
  const titleInput = document.getElementById("title-input");
  const contributorInput = document.getElementById("contributor-input");
  const sectionSelect = document.getElementById("section-select");
  const submitBtn = document.getElementById("submit-btn");
  const status = document.getElementById("status-msg");

  let chosenFile = null;

  function showFile(file) {
    chosenFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(file);
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
    const file = e.dataTransfer.files[0];
    if (file) showFile(file);
  });

  submitBtn.addEventListener("click", () => {
    const title = titleInput.value.trim();
    if (!title || !chosenFile) {
      status.textContent = "Give it a title and choose an image first.";
      status.className = "status-msg show err";
      return;
    }

    if (REPO.includes("YOUR-USERNAME")) {
      status.innerHTML = `Almost — set <code>REPO</code> at the top of <code>js/contribute.js</code> to your GitHub repo first.`;
      status.className = "status-msg show err";
      return;
    }

    const contributor = contributorInput.value.trim();
    const section = sectionSelect.value;

    // GitHub prefills issue-form fields via query params matching each
    // field's `id` from contribute-a-son.yml (not the visible label).
    const url = new URL(`https://github.com/${REPO}/issues/new`);
    url.searchParams.set("template", "contribute-a-son.yml");
    url.searchParams.set("title", title);
    if (contributor) url.searchParams.set("contributor", contributor);
    url.searchParams.set("section", section);
    url.searchParams.set("labels", "contribution");

    window.open(url.toString(), "_blank", "noopener");
    status.innerHTML = `Opening GitHub — <strong>drag your image into the Image box</strong> there (the fields below are pre-filled for you), then click "Submit new issue." It'll appear on the wall within a minute or two.`;
    status.className = "status-msg show ok";
  });
});
