/**
 * Museum of SON — live counters
 *
 * Uses countapi.mileshilliard.com: a free, open-source, no-signup counting
 * API (spiritual successor to the now-dead countapi.xyz). Every key is a
 * public integer counter you can "hit" (increment) or "get" (read).
 *
 * This is what makes the live visitor count and per-meme like counts work
 * with ZERO backend of your own — perfect for a static GitHub Pages site.
 *
 * Heads up: this is a free best-effort community service, not a serious
 * database. Counts are public (anyone who guesses your key can read/bump
 * it) and there's no uptime guarantee. If it ever goes down, swap the
 * BASE_URL below for another CountAPI-compatible host — that's the only
 * line you need to change.
 */
const Counter = (() => {
  const BASE_URL = "https://countapi.mileshilliard.com/api/v1";
  // Change this if you fork the site, so your counters don't collide with
  // anyone else's — keys on this service are global and public.
  const NAMESPACE = "museum-of-son-v1";

  const key = (name) => `${NAMESPACE}_${name}`.replace(/[^A-Za-z0-9_\-.]/g, "-");

  async function hit(name) {
    try {
      const res = await fetch(`${BASE_URL}/hit/${key(name)}`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      return data.value ?? data.count ?? null;
    } catch (e) {
      console.warn("Counter.hit failed", name, e);
      return null;
    }
  }

  async function get(name) {
    try {
      const res = await fetch(`${BASE_URL}/get/${key(name)}`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      return data.value ?? data.count ?? 0;
    } catch (e) {
      return 0;
    }
  }

  async function getMany(names) {
    const results = await Promise.all(names.map((n) => get(n).then((v) => [n, v])));
    return Object.fromEntries(results);
  }

  return { hit, get, getMany };
})();
