"use strict";

/* ---------- Theme toggle (two-state: system <-> opposite of what is shown) ---------- */
(() => {
  const KEY = "color-scheme";
  const meta = document.querySelector('meta[name="color-scheme"]');
  const media = matchMedia("(prefers-color-scheme: dark)");
  const button = document.getElementById("theme-toggle");

  const readStored = () => {
    try { return localStorage.getItem(KEY); } catch { return null; }
  };
  const apply = (value) => { meta.content = value ?? "light dark"; };
  const rendered = () => {
    const stored = readStored();
    if (stored === "light" || stored === "dark") return stored;
    return media.matches ? "dark" : "light";
  };

  button?.addEventListener("click", () => {
    const target = rendered() === "dark" ? "light" : "dark";
    const system = media.matches ? "dark" : "light";
    try {
      if (target === system) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, target);
    } catch { /* storage blocked: still apply for this page view */ }
    apply(target === system ? null : target);
  });

  // Another tab changed the override.
  addEventListener("storage", (e) => {
    if (e.key === KEY) apply(e.newValue);
  });
})();

/* ---------- Projects ---------- */
(() => {
  const DATA_URL = "data/projects.json";
  const BOOTH_URL = "data/booth.json"; // heart counts, refreshed by GitHub Actions
  const numberFmt = new Intl.NumberFormat("ko-KR");
  const HEART_SVG =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">' +
    '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" fill="currentColor"/></svg>';
  const LINK_LABELS = { repo: "GitHub", repo2: "GitHub", demo: "Demo", booth: "BOOTH", video: "Video" };
  const lists = {
    backend: document.querySelector('[data-list="backend"]'),
    vrchat: document.querySelector('[data-list="vrchat"]'),
    tools: document.querySelector('[data-list="tools"]'),
  };

  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const child of [].concat(children)) if (child) node.append(child);
    return node;
  };

  const linksFor = (p) => {
    const labels = { ...LINK_LABELS, ...(p.link_labels || {}) };
    return Object.entries(p.links || {})
      .filter(([, url]) => typeof url === "string" && url)
      .map(([key, url]) => el("a", { href: url, text: labels[key] || key }));
  };

  const boothId = (p) => {
    const m = typeof p.links?.booth === "string" && p.links.booth.match(/items\/(\d+)/);
    return m ? m[1] : null;
  };

  // Valid count for this project, or null (missing file, unknown item, bad value).
  const heartsFor = (p, booth) => {
    const n = booth?.items?.[boothId(p)]?.wish_lists_count;
    return Number.isInteger(n) && n >= 0 ? n : null;
  };

  const heartBadge = (n, cls, label) => {
    const badge = el("span", { class: cls });
    badge.innerHTML = HEART_SVG;
    badge.append(
      el("span", { "aria-hidden": "true", text: numberFmt.format(n) }),
      el("span", { class: "visually-hidden", text: `${label} ${numberFmt.format(n)}개` }),
    );
    return badge;
  };

  const updatedTitle = (booth) => {
    const t = booth?.updated_at ? new Date(booth.updated_at) : null;
    return t && !Number.isNaN(t.getTime())
      ? `BOOTH 하트(위시리스트) 수 · 마지막 갱신 ${t.toLocaleString("ko-KR")}`
      : "BOOTH 하트(위시리스트) 수";
  };

  const card = (p, booth) => {
    const hasImage = p.image && p.image.src;
    const article = el("article", { class: hasImage ? "card" : "card compact" });

    if (hasImage) {
      const img = el("img", {
        src: p.image.src,
        alt: p.image.alt || p.title,
        width: String(p.image.width || 1200),
        height: String(p.image.height || 675),
        loading: "lazy",
        decoding: "async",
      });
      // Missing file: drop the media block instead of showing a broken image.
      img.addEventListener("error", () => img.parentElement?.remove(), { once: true });
      article.append(el("div", { class: "card-media" }, img));
    }

    const hearts = heartsFor(p, booth);
    const heading = el("div", { class: "card-head" }, [
      el("h4", { text: p.title }),
      hearts == null ? null : heartBadge(hearts, "hearts", "BOOTH 하트"),
    ]);
    if (hearts != null) heading.lastChild.title = updatedTitle(booth);
    const body = el("div", { class: "card-body" }, [
      heading,
      p.summary_ko ? el("p", { class: "summary", text: p.summary_ko }) : null,
      p.summary_en ? el("p", { class: "summary-en", lang: "en", text: p.summary_en }) : null,
    ]);

    if (Array.isArray(p.highlights_ko) && p.highlights_ko.length) {
      body.append(el("ul", { class: "highlights" }, p.highlights_ko.map((h) => el("li", { text: h }))));
    }
    if (Array.isArray(p.stack) && p.stack.length) {
      body.append(el("ul", { class: "chips", "aria-label": "Stack" }, p.stack.map((s) => el("li", { text: s }))));
    }
    const links = linksFor(p);
    if (links.length) body.append(el("p", { class: "card-links" }, links));

    article.append(body);
    return article;
  };

  const toolItem = (p) => {
    const links = linksFor(p);
    const head = el("div", {}, [
      el("span", { class: "tool-name", text: p.title }),
      document.createTextNode(" "),
      p.stack?.length ? el("span", { class: "tool-stack", text: p.stack.join(" · ") }) : null,
    ]);
    const desc = el("p", { text: p.summary_ko || "" });
    const linkLine = links.length ? el("p", { class: "card-links" }, links) : null;
    return el("li", {}, [head, desc, linkLine]);
  };

  const showError = (message) => {
    for (const list of [lists.backend, lists.vrchat]) {
      if (!list) continue;
      list.replaceChildren(el("p", { class: "status", role: "status" }, [
        document.createTextNode(message + " "),
        el("a", { href: "https://github.com/Pyrite9", text: "GitHub에서 보기 (View on GitHub)" }),
      ]));
    }
  };

  const render = (projects, booth) => {
    const byTrack = { backend: [], vrchat: [], tools: [] };
    for (const p of projects) if (byTrack[p.track]) byTrack[p.track].push(p);
    // VRChat: newest BOOTH release first; items without a date go last (stable otherwise).
    byTrack.vrchat.sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));

    for (const track of ["backend", "vrchat"]) {
      const list = lists[track];
      if (!list) continue;
      const items = byTrack[track];
      list.replaceChildren(...(items.length ? items.map((p) => card(p, booth)) : [el("p", { class: "status", text: "아직 항목 없음. (No projects yet)" })]));
    }

    // Heart total next to the VRChat heading; silently skipped without data.
    const counts = byTrack.vrchat.map((p) => heartsFor(p, booth)).filter((n) => n != null);
    const heading = document.getElementById("track-vrchat");
    heading?.querySelector(".hearts-total")?.remove();
    if (heading && counts.length) {
      const total = heartBadge(counts.reduce((a, b) => a + b, 0), "hearts hearts-total", "BOOTH 하트 합계");
      total.title = updatedTitle(booth);
      heading.append(total);
    }
    lists.tools?.replaceChildren(...byTrack.tools.map(toolItem));
  };

  // Optional data: any failure just means no heart counts.
  const boothData = fetch(BOOTH_URL, { cache: "no-cache" })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);

  // no-cache: revalidate so JSON edits show up right after deploy.
  fetch(DATA_URL, { cache: "no-cache" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(async (data) => {
      if (!Array.isArray(data)) throw new Error("projects.json must be an array");
      render(data, await boothData);
    })
    .catch(() => showError("프로젝트 목록 불러오기 실패. (Could not load the project list.)"));

  /* ---------- Track filter ---------- */
  const tracks = document.getElementById("tracks");
  const buttons = document.querySelectorAll(".filter button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.filter;
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      tracks.dataset.filter = value;
      tracks.classList.remove("is-switching");
      void tracks.offsetWidth; // restart animation
      tracks.classList.add("is-switching");
    });
  });
})();
