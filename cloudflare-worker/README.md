# Museum of SON — Free Donation Backend Setup

Follow these quick steps (takes ~2 minutes) to let anyone donate images directly from your website without needing a GitHub account.

---

### Step 1: Generate a GitHub Personal Access Token (PAT)

1. On GitHub, click your profile picture (top right) → **Settings**.
2. Scroll to the bottom of the left sidebar → **Developer settings**.
3. Click **Personal access tokens** → **Tokens (classic)** (or Fine-grained tokens).
4. Click **Generate new token** → **Generate new token (classic)**.
5. Note: `MuseumOfSon-Worker`.
6. Expiration: Choose `No expiration` (or whatever you prefer).
7. Under **Select scopes**, check:
   - `repo` (Full control of private repositories, or at least `public_repo` for public repos).
8. Click **Generate token** at the bottom.
9. **Copy the token** (e.g. `ghp_xxxxxxxxxxxx`). You will need it in Step 2.

---

### Step 2: Create the Free Cloudflare Worker

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/) and sign up or log in (100% free, no credit card required).
2. On the left menu, click **Compute (Workers & Pages)** → **Workers & Pages**.
3. Click **Create Application** → **Create Worker**.
4. Name it anything (e.g. `museum-of-son-donate`), then click **Deploy**.
5. Click **Edit code** on the top right.
6. Delete whatever code is in `worker.js`, and **paste the entire contents of [worker.js](worker.js)** into the editor.
7. Click **Deploy** (top right).

---

### Step 3: Add the `GITHUB_TOKEN` Secret

1. Go back to your Worker's main page in the Cloudflare dashboard.
2. Click the **Settings** tab → **Variables and Secrets**.
3. Under **Secrets**, click **Add**.
4. Variable name: `GITHUB_TOKEN`
5. Value: *Paste your GitHub token from Step 1*
6. Click **Save and Deploy**.

---

### Step 4: Add the Worker URL to the Website

1. Copy your Worker's public URL from the Cloudflare dashboard (it looks like: `https://museum-of-son-donate.<your-subdomain>.workers.dev`).
2. Open `js/contribute.js` in your repository.
3. Replace the placeholder on Line 10:
   ```javascript
   const WORKER_URL = "https://museum-of-son-donate.<your-subdomain>.workers.dev";
   ```
4. Commit and push the changes!

Visitors can now donate their pictures directly on the website with zero signups or GitHub accounts!
