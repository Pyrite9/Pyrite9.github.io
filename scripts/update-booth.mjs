// Refresh BOOTH heart (wish list) counts into data/booth.json.
// Node 18+ standard library only (global fetch). Used by .github/workflows/booth-hearts.yml.
//
//   node scripts/update-booth.mjs [--projects data/projects.json] [--out data/booth.json]
//
// - Item ids come from every BOOTH link in projects.json, so new products need no code change.
// - A failed or malformed response keeps that item's previous value.
// - If every request fails, the file is left alone and the process exits with code 1.
// - The file (and updated_at) is rewritten only when a count actually changed.

import { readFile, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PROJECTS = opt("--projects", "data/projects.json");
const OUT = opt("--out", "data/booth.json");
const DELAY_MS = 1500;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readJson = async (path) => {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
};

const projects = await readJson(PROJECTS);
if (!Array.isArray(projects)) {
  console.error(`Cannot read ${PROJECTS}`);
  process.exit(1);
}

const ids = [];
for (const p of projects) {
  for (const url of Object.values(p.links || {})) {
    const m = typeof url === "string" && url.match(/booth\.pm\/(?:[a-z]{2}\/)?items\/(\d+)/);
    if (m && !ids.includes(m[1])) ids.push(m[1]);
  }
}
if (!ids.length) {
  console.error("No BOOTH item links found");
  process.exit(1);
}

const previous = (await readJson(OUT)) || { updated_at: null, items: {} };
const prevItems = previous.items || {};

const fetchCount = async (id) => {
  const res = await fetch(`https://booth.pm/ko/items/${id}.json`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const n = data?.wish_lists_count;
  if (!Number.isInteger(n) || n < 0) throw new Error("wish_lists_count missing or not a number");
  return n;
};

const items = {};
let ok = 0;
for (const [i, id] of ids.entries()) {
  if (i > 0) await sleep(DELAY_MS);
  try {
    const n = await fetchCount(id);
    items[id] = { wish_lists_count: n };
    ok++;
    console.log(`${id}: ${n}`);
  } catch (err) {
    if (prevItems[id]) items[id] = prevItems[id];
    console.warn(`${id}: failed (${err.message}); ${prevItems[id] ? "kept previous value" : "no previous value"}`);
  }
}

// exitCode instead of process.exit(): lets open sockets close cleanly.
if (ok === 0) {
  console.error("All requests failed; leaving the file untouched");
  process.exitCode = 1;
} else if (JSON.stringify(items) === JSON.stringify(prevItems)) {
  console.log("No change");
} else {
  const next = { updated_at: new Date().toISOString(), items };
  await writeFile(OUT, JSON.stringify(next, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
