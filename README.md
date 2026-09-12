# Museum of SON

A static art-gallery-themed website for a permanent collection of Son memes.
Frames on the wall, plaques with credits, a live visitor counter, per-piece
likes, and a weekly Hall of Fame — all running on plain GitHub Pages, no
server of your own required.

## How it's built (so you know what you're deploying)

- **Pure static site** — `index.html`, `css/style.css`, a handful of `js/*.js`
  files. No build step, no framework, no `npm install` needed to run it.
- **Live visitor count & likes** — powered by
  [countapi.mileshilliard.com](https://countapi.mileshilliard.com), a free,
  no-signup counting API. Every "like" and every visit increments a public
  counter that every visitor's browser reads. It's genuinely free and needs
  zero setup, but it's a small community-run service, not a serious
  database — see **Limitations** below.
- **Gallery contents** — come from `data/manifest.json`. You generate this
  once from your own image folder (see below); it's a normal file in your
  repo, committed like any other.
- **"Contribute your own Son" that actually auto-adds it** — done through a
  GitHub Issue Form + a GitHub Action (`.github/workflows/add-contribution.yml`),
  not through the static site directly (a static site can't write files to
  itself). Someone fills out the form on your Contribute page, it opens a
  pre-filled GitHub issue, they drag their image in, and the Action commits
  it to `images/sons/` and adds it to the manifest automatically — no
  moderation queue, no third-party account for you to manage.
- **Weekly Hall of Fame** — a second GitHub Action
  (`.github/workflows/weekly-hall-of-fame.yml`) runs every Monday, reads the
  past week's like counts, and appends that week's winner to
  `data/hall-of-fame-history.json`, which the Hall of Fame page renders as a
  permanent archive.

## 1. Add your own memes

Drop your PNGs into `images/sons/` (delete the placeholder `.gitkeep`), then
generate the manifest:

```bash
node scripts/generate-manifest.js
```

This scans the folder and writes `data/manifest.json` with a title, section,
and id for every image, guessed from the filename (`son_at_the_dmv.png` →
"Son At The Dmv" — you'll want to hand-tidy a few titles/sections in that
file afterward; it's plain JSON). Re-run the script any time you bulk-add
more images later — it won't touch entries you've already hand-edited for
files it's seen before.

Each manifest entry looks like this, and you can edit any field by hand:

```json
{
  "id": "son-0001-abc123",
  "filename": "son-at-the-dmv.png",
  "src": "images/sons/son-at-the-dmv.png",
  "title": "Son At The DMV",
  "contributor": "Museum Archive",
  "section": "General Collection",
  "likes": 0
}
```

`section` controls which "room" a piece is grouped into on the homepage —
add whatever section names you like, the site builds nav + rooms from
whatever's in the manifest automatically.

## 2. Preview it locally

It's static, so any local server works:

```bash
python3 -m http.server 8000
# or: npx serve
```

Open `http://localhost:8000`.

## 3. Deploy to GitHub Pages

1. Push this folder to a **public** GitHub repo (Pages' free tier needs
   public for the Issue-Form contribution flow to work for visitors without
   you paying for GitHub anything).
2. In the repo: **Settings → Pages → Build and deployment → Source** = "Deploy
   from a branch", branch `main`, folder `/ (root)`.
3. Your site is live at `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

## 4. Turn on live contributions

1. Open `js/contribute.js` and set:
   ```js
   const REPO = "YOUR-USERNAME/YOUR-REPO";
   ```
2. In the repo: **Settings → Actions → General → Workflow permissions** →
   set to **"Read and write permissions"** (the contribution bot needs this
   to commit new images back to the repo).
3. That's it — the Contribute page will open a pre-filled GitHub issue, and
   `.github/workflows/add-contribution.yml` handles the rest automatically.

Want a human to approve submissions instead of full auto-publish? Open that
workflow file and turn the final commit step into a step that instead adds a
`needs-review` label and leaves the issue open for you to merge by hand
later — the processing script (`scripts/process-contribution.js`) already
does the hard part (downloading the image, building the manifest entry).

## 5. Weekly Hall of Fame

Nothing to configure — `.github/workflows/weekly-hall-of-fame.yml` runs
automatically every Monday at 00:10 UTC via GitHub's free Actions cron and
commits the update itself. You can also trigger it manually from the
**Actions** tab (**"Weekly Hall of Fame snapshot" → Run workflow**) to test
it without waiting for Monday.

## Limitations, honestly

- **The counting API is a free community service**, not something either of
  us controls. Counters are public (anyone who knew your exact key could
  read or bump it — unlikely by accident, but don't rely on this for
  anything that matters). If it ever goes down, swap `BASE_URL` in
  `js/counter.js` for another CountAPI-compatible host; that's the only
  line to change.
- **One like per browser**, enforced client-side via `localStorage` — not
  vote-proof against someone clearing storage or using another browser.
  Fine for a fun weekly meme contest, not fine for anything with a prize.
- **Contribution requires a free GitHub account** for whoever's donating —
  that's the trade-off for "fully automatic, no moderation queue, no
  backend of your own."

## Customizing sections

Edit `SECTION_RULES` in `scripts/generate-manifest.js` to auto-sort future
bulk imports by filename keyword, or just hand-edit the `"section"` field
in `data/manifest.json` — the homepage rebuilds its rooms from whatever
section names it finds, so you can add, rename, or merge rooms freely.
