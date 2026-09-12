/**
 * Museum of SON — Cloudflare Worker backend for direct in-browser donations.
 *
 * This serverless worker receives image donations directly from visitors
 * on the website, commits the image to `images/sons/`, and updates `data/manifest.json`
 * in the GitHub repository using the GitHub Git API in a single atomic commit.
 *
 * Requirements in Cloudflare Worker:
 *   Environment Variables / Secrets:
 *     GITHUB_TOKEN - A GitHub Personal Access Token (Fine-grained or Classic)
 *                    with contents:write permission for the repo.
 *     REPO_OWNER   - (Optional, defaults to "BludDontCut")
 *     REPO_NAME    - (Optional, defaults to "MuseumOfSon")
 *     REPO_BRANCH  - (Optional, defaults to "main")
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function slugify(str) {
  return (
    str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "son"
  );
}

function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getExtension(mimeType) {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mimeType?.toLowerCase()] || "jpg";
}

async function githubRequest(url, method, token, body = null) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "MuseumOfSon-Worker",
  };
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API error ${res.status} on ${method} ${url}: ${errText}`);
  }

  return res.json();
}

export default {
  async fetch(request, env) {
    // 1. Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // 2. Only allow POST requests
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const token = env.GITHUB_TOKEN;
    if (!token) {
      return jsonResponse(
        { error: "Server configuration error: GITHUB_TOKEN secret is not set in the worker." },
        500
      );
    }

    const owner = env.REPO_OWNER || "BludDontCut";
    const repo = env.REPO_NAME || "MuseumOfSon";
    const branch = env.REPO_BRANCH || "main";

    try {
      const payload = await request.json();
      const { title, contributor, section, imageBase64, imageType } = payload;

      // Validate inputs
      if (!title || typeof title !== "string" || !title.trim()) {
        return jsonResponse({ error: "Title is required." }, 400);
      }
      if (!imageBase64 || typeof imageBase64 !== "string") {
        return jsonResponse({ error: "Image data is required." }, 400);
      }

      // Max 5 MB decoded file size (approx 7 MB base64)
      if (imageBase64.length > 7 * 1024 * 1024) {
        return jsonResponse({ error: "Image file is too large (maximum 5 MB)." }, 400);
      }

      const validMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
      if (imageType && !validMimes.includes(imageType.toLowerCase())) {
        return jsonResponse({ error: "Unsupported image format. Please use JPG, PNG, WebP, or GIF." }, 400);
      }

      const cleanTitle = title.trim().slice(0, 100);
      const cleanContributor = (contributor && typeof contributor === "string" && contributor.trim())
        ? contributor.trim().slice(0, 50)
        : "Anonymous";
      const cleanSection = section && typeof section === "string" ? section.trim() : "General Collection";
      const ext = getExtension(imageType);

      // Unique ID and filename
      const idStamp = Date.now().toString(36);
      const filename = `${slugify(cleanTitle)}-${idStamp}.${ext}`;
      const pieceId = `son-web-${idStamp}`;
      const now = new Date();

      const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

      // Step A: Upload image blob
      const imageBlob = await githubRequest(`${apiBase}/git/blobs`, "POST", token, {
        content: imageBase64,
        encoding: "base64",
      });

      // Step B: Get latest commit SHA on branch
      const refData = await githubRequest(`${apiBase}/git/ref/heads/${branch}`, "GET", token);
      const latestCommitSha = refData.object.sha;

      // Step C: Get tree SHA from latest commit
      const commitData = await githubRequest(`${apiBase}/git/commits/${latestCommitSha}`, "GET", token);
      const baseTreeSha = commitData.tree.sha;

      // Step D: Fetch and parse current manifest.json
      let manifest = [];
      try {
        const manifestFileData = await githubRequest(
          `${apiBase}/contents/data/manifest.json?ref=${branch}`,
          "GET",
          token
        );
        const rawContent = atob(manifestFileData.content.replace(/\s/g, ""));
        manifest = JSON.parse(rawContent);
      } catch (err) {
        console.warn("Could not load existing manifest, initializing empty list:", err.message);
      }

      // Step E: Append new piece
      const newPiece = {
        id: pieceId,
        filename,
        src: `images/sons/${filename}`,
        title: cleanTitle,
        contributor: cleanContributor,
        section: cleanSection,
        dateAdded: now.toISOString(),
        weekAcquired: isoWeek(now),
        likes: 0,
        featured: false,
      };
      manifest.push(newPiece);

      // Step F: Upload updated manifest blob
      const updatedManifestStr = JSON.stringify(manifest, null, 2) + "\n";
      const manifestBase64 = btoa(unescape(encodeURIComponent(updatedManifestStr)));
      const manifestBlob = await githubRequest(`${apiBase}/git/blobs`, "POST", token, {
        content: manifestBase64,
        encoding: "base64",
      });

      // Step G: Create a new tree with both new files
      const newTree = await githubRequest(`${apiBase}/git/trees`, "POST", token, {
        base_tree: baseTreeSha,
        tree: [
          {
            path: `images/sons/${filename}`,
            mode: "100644",
            type: "blob",
            sha: imageBlob.sha,
          },
          {
            path: "data/manifest.json",
            mode: "100644",
            type: "blob",
            sha: manifestBlob.sha,
          },
        ],
      });

      // Step H: Create a commit
      const commitMessage = `Add donation: "${cleanTitle}" by ${cleanContributor}`;
      const newCommit = await githubRequest(`${apiBase}/git/commits`, "POST", token, {
        message: commitMessage,
        tree: newTree.sha,
        parents: [latestCommitSha],
      });

      // Step I: Update the branch reference
      await githubRequest(`${apiBase}/git/refs/heads/${branch}`, "PATCH", token, {
        sha: newCommit.sha,
      });

      // Step J: Dispatch GitHub Pages deployment
      try {
        await githubRequest(`${apiBase}/actions/workflows/static.yml/dispatches`, "POST", token, {
          ref: branch,
        });
      } catch (dispErr) {
        console.warn("Could not dispatch static.yml deployment:", dispErr.message);
      }

      return jsonResponse({
        success: true,
        message: "Your donation has been added to the museum!",
        piece: newPiece,
      });
    } catch (error) {
      console.error("Donation failed:", error);
      return jsonResponse({ error: error.message || "Failed to process donation" }, 500);
    }
  },
};
