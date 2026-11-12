"use strict";

/* Swarm build animation: several colored cursors draw selection frames and
   "build" each block as it scrolls into view. Pure enhancement — see swarm.css. */
(() => {
  const root = document.documentElement;
  const KEY = "swarm";
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const ITEM_SELECTOR = [
    "#top :is(h1, .lead, .lead-en, .hero-links > li)",
    // Shared by every section, so a new section needs no change here.
    "main > .section :is(h2, .section-intro, .section-meta, .track-title, .card-list > *, .tool-list > li)",
    "#about :is(.prose > p, .facts)",
    "#ai :is(.ai-principle, .ai-role, .ai-steps > li, .ai-case, .ai-guard, .ai-stats, .colophon)",
    "#skills .skill-grid > div",
    "#experience :is(.timeline-head, .role, .bullets)",
    "#certifications .cert-list > li",
    "#contact .contact-list > li",
  ].join(", ");

  const COLORS = ["var(--sw-1)", "var(--sw-2)", "var(--sw-3)", "var(--sw-4)", "var(--sw-5)", "var(--sw-6)"];
  const NAMES = ["api", "db", "ui", "infra", "docs", "test", "auth", "build"];
  const CURSOR_SVG =
    '<svg viewBox="0 0 16 20" width="16" height="20" aria-hidden="true">' +
    '<path d="M1.5 1.5v15l4-3.8 2.6 5.8 2.4-1.1-2.6-5.6h5.6z" fill="currentColor" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/></svg>';

  const storage = {
    get() { try { return localStorage.getItem(KEY); } catch { return null; } },
    set(v) { try { v == null ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, v); } catch { /* blocked */ } },
  };

  /* ---------- Footer switch (exists even when the animation is off) ---------- */
  const toggle = document.getElementById("swarm-toggle");
  const syncToggle = () => {
    if (!toggle) return;
    toggle.hidden = reduceMotion.matches;
    toggle.textContent = root.classList.contains("sw-on")
      ? "빌드 애니메이션 끄기 (Turn off build animation)"
      : "빌드 애니메이션 켜기 (Turn on build animation)";
  };

  /* ---------- State ---------- */
  const isMobile = () => innerWidth < 640;
  const maxAgents = () => (isMobile() ? 3 : 7);
  let layer = null;
  let pill = null;
  let pillHideTimer = 0;
  let activeAgents = 0;
  let nameIndex = 0;
  const pending = new Set();       // items waiting to be built
  const building = new Set();      // items currently being built
  const waiting = new Set();       // in view, queued until an agent is free
  let batch = new Set();
  let batchTimer = 0;
  let scrollQueued = false;

  const pageRect = (el) => {
    let r = el.getBoundingClientRect();
    // Tighter box for text blocks: the union of their text, not the full line box.
    if (/^(H1|H2|H3|P)$/.test(el.tagName)) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const t = range.getBoundingClientRect();
      if (t.width && t.height) r = t;
    }
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
  };

  const reveal = (el) => {
    pending.delete(el);
    building.delete(el);
    waiting.delete(el);
    io?.unobserve(el);
    el.classList.add("sw-in");
  };

  /* ---------- Layer, cursors, frames ---------- */
  const ensureLayer = () => {
    if (layer?.isConnected) return layer;
    layer = document.createElement("div");
    layer.className = "sw-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.append(layer);
    return layer;
  };

  const makeCursor = (color, x, y) => {
    const el = document.createElement("div");
    el.className = "sw-cursor";
    el.style.color = color;
    el.style.setProperty("--c", color);
    el.innerHTML = CURSOR_SVG;
    const tag = document.createElement("span");
    tag.className = "sw-tag";
    tag.textContent = NAMES[nameIndex++ % NAMES.length];
    el.append(tag);
    el.style.transform = `translate(${x}px, ${y}px)`;
    ensureLayer().append(el);
    requestAnimationFrame(() => el.classList.add("is-live"));
    return { el, x, y };
  };

  // transform-only movement, compositor friendly. Final state is set inline so it
  // survives even if the animation is dropped.
  const moveTo = (cursor, x, y, duration) => {
    const from = `translate(${cursor.x}px, ${cursor.y}px)`;
    const to = `translate(${x}px, ${y}px)`;
    cursor.el.style.transform = to;
    cursor.el.animate([{ transform: from }, { transform: to }], { duration, easing: "cubic-bezier(.45,.05,.2,1)" });
    cursor.x = x;
    cursor.y = y;
  };

  const makeFrame = (color, r, duration) => {
    const f = document.createElement("div");
    f.className = "sw-frame";
    f.style.setProperty("--c", color);
    f.style.width = `${r.w}px`;
    f.style.height = `${r.h}px`;
    f.style.transform = `translate(${r.x}px, ${r.y}px)`;
    f.innerHTML = "<i></i><i></i><i></i><i></i>";
    ensureLayer().append(f);
    f.animate(
      [{ clipPath: "inset(-6px calc(100% - 2px) calc(100% - 2px) -6px)" }, { clipPath: "inset(-6px -6px -6px -6px)" }],
      { duration, easing: "cubic-bezier(.45,.05,.2,1)", fill: "forwards" },
    );
    return f;
  };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- Status pill ---------- */
  const ensurePill = () => {
    if (pill) return pill;
    pill = document.createElement("div");
    pill.className = "sw-pill";
    pill.hidden = true;
    pill.innerHTML =
      '<span class="sw-dot" aria-hidden="true"></span><span class="sw-count"></span>' +
      '<button type="button">건너뛰기 <span lang="en">Skip</span></button>';
    pill.querySelector("button").addEventListener("click", () => turnOff());
    document.body.append(pill);
    return pill;
  };

  const updatePill = () => {
    const p = ensurePill();
    clearTimeout(pillHideTimer);
    if (activeAgents > 0) {
      p.querySelector(".sw-count").textContent = `${activeAgents} agent${activeAgents > 1 ? "s" : ""} building`;
      p.hidden = false;
      p.classList.remove("is-leaving");
    } else if (!p.hidden) {
      p.classList.add("is-leaving");
      pillHideTimer = setTimeout(() => { p.hidden = true; }, 600);
    }
  };

  /* ---------- Build ---------- */
  const build = (items) => {
    items = items.filter((el) => pending.has(el));
    if (!items.length) return;

    const visible = [];
    for (const el of items) {
      if (el.getClientRects().length) visible.push(el);
      else reveal(el); // display:none (e.g. filtered track) — nothing to animate
    }
    if (!visible.length) return;

    const mobile = isMobile();
    const budget = mobile ? 1300 : 1800;
    const free = maxAgents() - activeAgents;
    if (free <= 0) {
      // Every agent is busy: wait for one to finish (safety net still applies).
      visible.forEach((el) => waiting.add(el));
      setTimeout(() => visible.forEach((el) => { if (pending.has(el)) reveal(el); }), budget + 900);
      return;
    }

    visible.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    visible.forEach((el) => { pending.delete(el); building.add(el); });

    const n = Math.min(visible.length, free);
    const perAgent = Math.ceil(visible.length / n);
    const step = Math.min(mobile ? 600 : 800, budget / perAgent);

    // Safety net: whatever happens, these items are shown shortly after the budget.
    setTimeout(() => visible.forEach(reveal), budget + 900);

    const vw = document.documentElement.clientWidth;
    for (let a = 0; a < n; a++) {
      const queue = visible.filter((_, i) => i % n === a);
      const color = COLORS[(a + nameIndex) % COLORS.length];
      const spawnX = Math.round(((a + 0.5) / n) * vw + (Math.random() - 0.5) * 80);
      const spawnY = Math.round(scrollY + innerHeight - 30 - Math.random() * 60);
      const cursor = makeCursor(color, spawnX, spawnY);
      activeAgents++;
      runAgent(cursor, color, queue, step).finally(() => {
        activeAgents = Math.max(0, activeAgents - 1);
        if (waiting.size && root.classList.contains("sw-on")) {
          const next = [...waiting];
          waiting.clear();
          build(next);
        }
        updatePill();
      });
    }
    updatePill();
  };

  const runAgent = async (cursor, color, queue, step) => {
    const travel = Math.round(step * 0.35);
    const drag = Math.round(step * 0.4);
    const settle = Math.round(step * 0.25);
    await wait(Math.random() * 120);
    for (const el of queue) {
      if (!building.has(el)) continue; // already revealed by skip or safety net
      const r = pageRect(el);
      moveTo(cursor, r.x, r.y, travel);
      await wait(travel);
      if (!building.has(el)) continue;
      const frame = makeFrame(color, r, drag);
      moveTo(cursor, r.x + r.w, r.y + r.h, drag);
      await wait(drag);
      reveal(el);
      frame.classList.add("is-out");
      setTimeout(() => frame.remove(), 250);
      await wait(settle);
    }
    cursor.el.classList.remove("is-live");
    await wait(220);
    cursor.el.remove();
  };

  /* ---------- Observation ---------- */
  const flush = () => {
    batchTimer = 0;
    const items = [...batch];
    batch = new Set();
    build(items);
  };

  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!pending.has(e.target)) continue;
          if (e.isIntersecting) batch.add(e.target);
          else if (e.boundingClientRect.bottom < 0) reveal(e.target); // already above the fold
        }
        if (batch.size && !batchTimer) batchTimer = setTimeout(flush, 60);
      }, { rootMargin: "0px 0px -12% 0px" })
    : null;

  const track = (el) => {
    if (el.classList.contains("sw-in") || pending.has(el) || building.has(el)) return;
    pending.add(el);
    io.observe(el);
  };

  // Fast scroll can jump past items without them ever intersecting: show anything
  // that is already above the viewport.
  const sweepAbove = () => {
    scrollQueued = false;
    for (const el of pending) {
      if (el.getBoundingClientRect().bottom < 0) reveal(el);
    }
  };
  const onScroll = () => {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(sweepAbove); }
  };

  // Cards and tool rows rendered later from projects.json.
  const mo = new MutationObserver((records) => {
    if (!root.classList.contains("sw-on")) return;
    for (const rec of records) {
      for (const node of rec.addedNodes) {
        if (node.nodeType === 1 && node.matches(ITEM_SELECTOR)) track(node);
      }
    }
  });

  /* ---------- On / off ---------- */
  const revealAll = () => {
    for (const el of [...pending, ...building]) reveal(el);
    document.querySelectorAll(ITEM_SELECTOR).forEach((el) => el.classList.add("sw-in"));
  };

  const stop = () => {
    revealAll();
    root.classList.remove("sw-on");
    layer?.remove();
    layer = null;
    activeAgents = 0;
    updatePill();
    removeEventListener("scroll", onScroll);
    removeEventListener("keydown", onKey);
  };

  function turnOff() {
    storage.set("off");
    stop();
    syncToggle();
  }

  const start = (belowOnly = false) => {
    const vh = innerHeight;
    if (belowOnly) {
      // Switched back on mid-page: keep what is already on screen or above it,
      // rebuild only what is still below the viewport.
      document.querySelectorAll(ITEM_SELECTOR).forEach((el) => {
        el.classList.toggle("sw-in", el.getBoundingClientRect().top <= vh);
      });
    }
    root.classList.add("sw-on", "sw-ready");
    document.querySelectorAll(ITEM_SELECTOR).forEach((el) => {
      if (!el.classList.contains("sw-in")) track(el);
    });
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("keydown", onKey);
    // Safety net if the observer never reports (e.g. rendering throttled): anything
    // in or above the viewport is shown after a short while.
    setTimeout(() => {
      for (const el of pending) {
        if (el.getBoundingClientRect().top < innerHeight) reveal(el);
      }
    }, 2800);
  };

  // Keyboard users tab through content: never let hidden items swallow focus.
  // Show everything for this page view (the saved preference is unchanged).
  function onKey(e) {
    if (e.key === "Tab") { stop(); syncToggle(); }
  }

  toggle?.addEventListener("click", () => {
    if (root.classList.contains("sw-on")) {
      turnOff();
    } else {
      storage.set(null);
      if (!reduceMotion.matches && io) start(true);
      syncToggle();
    }
  });

  reduceMotion.addEventListener?.("change", () => {
    if (reduceMotion.matches) stop();
    syncToggle();
  });

  for (const list of document.querySelectorAll(".card-list, .tool-list")) {
    mo.observe(list, { childList: true });
  }

  // html.sw-on is set in <head> only when allowed; if the head fallback already
  // gave up (slow load), stay off for this page view.
  if (root.classList.contains("sw-on") && io && !reduceMotion.matches) start();
  else root.classList.remove("sw-on");
  syncToggle();
})();
