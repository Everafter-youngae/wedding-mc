# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static site ("Everafter") that a wedding MC (사회자) uses to build a wedding-ceremony script/run-of-show together with the bride and groom, then archive the day afterward as a keepsake. There is no build step, no package manager, and no server code in this repo — every page is a single self-contained `.html` file (inline `<style>` + inline `<script>`, no bundler, no framework) deployed directly to GitHub Pages. Committing to `main` ships to production. The one shared file is `shared.js`, loaded via `<script src="shared.js">` by `ask.html`/`review.html`/`story.html`. It holds the `GS_URL` backend-endpoint constant — kept separate so a redeployed Apps Script only needs one file updated instead of three (see "Routing convention" below for how already-issued links stay working even without editing that file) — plus the shared loading/notice UI: `LOADER_CSS`, `LOADER_SVG` (the pixel-art envelope animation), `loaderHTML(msg, sub)` and `noticeHTML(title, body, action)`, with an IIFE that injects the stylesheet on load. Build every "loading…" and every dead-end/error screen on the guest pages through those two helpers rather than hand-rolling markup — the three pages are meant to look identical here, and the animation is ~20KB that should stay downloaded once.

Persistence and mail/notification logic run outside this repo, in a **Google Apps Script** web app (`.../macros/s/<deployment-id>/exec`) referenced from each page as `GS_URL`. From the pages' side it is an external JSON API (`fetch` with `GET ?query=` for reads, `POST` of a JSON envelope for writes, both returning `{ok, ...}`).

Its source is mirrored at `apps-script/Code.gs` — **a copy, not the running code.** The live code is whatever was last pasted into the Apps Script editor and deployed as a new version; editing that file changes nothing on its own. Read it to understand what the API actually does (which sheets, which params, which auth), and if you change it, follow `apps-script/README.md` — which project it belongs to, and why saving without "배포 → 배포 관리 → 새 버전" silently leaves the old code running.

## Commands

There is no build/lint/test tooling. To work on a page, open the `.html` file directly in a browser (or serve the directory with any static file server, e.g. `python3 -m http.server`) and drive it through `location.hash`/query params as described below — most pages render nothing without a valid hash.

## Pages and how they fit together

- **`index.html`** — "사회자 대본 빌더" (MC script builder). This is the admin tool the MC uses; it is the source of truth for a wedding's data (`DB.list`, one `w` object per wedding, keyed by `id`, autosaved to `localStorage` under `mc-weddings-v1` and mirrored to the Apps Script backend). It generates ceremony script text from `SEC_DEFS` templates, builds the shareable links below (encoding wedding id + optional Apps Script deployment id into a URL hash), and reads back guest/couple responses (inbox/diff view).
- **`ask.html`** — sent to the couple early on. A step-by-step questionnaire (`STORY` questions about the couple + `SECS` run-of-show items to include/exclude/customize) that POSTs answers back to the Apps Script backend for the MC to pull into `index.html`.
- **`review.html`** — sent once a script draft exists. Shows the generated script section by section, lets the couple mark each "이대로 좋아요" (keep) or "고치고 싶어요" (fix, with a note), and submits back to the backend.
- **`story.html`** — the long-lived "our story" / journey tracker the couple can revisit; shows a status timeline (`LABELS`/`state()`), and after the ceremony (`steps.s8`) unlocks a form for the couple to leave a memory/reply, archived as an "Everafter Letter". `journey.html` is only a redirect stub to `story.html` preserving old links (hash/query passthrough) — do not add new logic there.

## Routing convention shared by all guest-facing pages

Every guest-facing page (`ask`, `review`, `story`) is a single-page app driven entirely by `location.hash`, of the form:

```
#<record-id>[.<link-key>][~<apps-script-deployment-id>]
```

- `<record-id>` selects the wedding/journey/script record via a query param to the Apps Script backend (e.g. `?cfg=`, `?script=`, `?story=`).
- `.<link-key>` is a per-wedding 14-character secret **required by the backend** — every read (`?cfg=`, `?script=`, `?journey=`, `?story=`) and every write (`review`, generic answers) is rejected with `{ok:false,error:'link key required'}` without it. Record ids and 영애 codes are guessable (codes are sequential `YYMM_NN`), so the key is what actually authorizes access; the id alone is not a secret. It rides in the **hash**, never the query string — hashes aren't sent to servers or logged by analytics. The MC's `index.html` mints it lazily via `ensureLinkKey(w)` (admin-token-gated `POST {type:'linkKey'}`) and caches it on the wedding as `w.linkKey`, so every link builder appends it automatically.
- The optional `~<deployment-id>` suffix overrides the hardcoded `GS_URL` constant — used so old shared links keep working even after the Apps Script is redeployed under a new id (see `gsId()`/`hashInfo()`/`routeFromHash()` in each file). When absent, the page falls back to its own `GS_URL` constant.
- `story.html` additionally supports a bare Korean name-lookup flow (`#영애xxxx_xx`, normalized via `normalize()`) when no direct id is known. This is the **recovery path for a lost link key**: `?lookup=` requires code *and* the couple's name, and on a match re-issues the key, which `story.html` writes back into the hash. Keep it that way — it is the only way a couple who lost their link can get back in without the MC.

Each of `ask.html`/`review.html` caches the fetched config/script in `localStorage` (keys like `mc-cfg-<id>`, draft answers under `mc-ask-<id>` / `ea-review-<id>`) so a guest can close the tab mid-way and resume, and so the page still renders (from cache) if the network fetch fails. Preserve this cache-first, resume-safe pattern when touching these flows — these are non-technical wedding guests filling this out on their phones, often in poor connectivity, and losing their draft is the main failure mode to avoid.

## Git workflow

The user has authorized pushing to `main` without asking for confirmation each time — this repo deploys straight to GitHub Pages, and the user wants verified fixes to go live promptly rather than sitting in local commits. Once a change has been tested/verified (see below), `git add` the relevant file(s), commit with a message explaining *why*, and `git push origin main` immediately, without a "should I push?" check-in.

This authorization covers only the normal edit → verify → commit → push loop. It does not extend to destructive or history-rewriting operations (`--force`, `reset --hard`, amending pushed commits, etc.) — those still need explicit confirmation per standard git safety practice.

Before pushing, verify the change actually works — for anything touching `index.html`'s JS/CSS, that means loading it in a real browser (serve with `python3 -m http.server`, or hit the live GitHub Pages URL) and checking behavior via direct DOM/computed-style inspection (`getComputedStyle`, `getBoundingClientRect`, element attributes), not just a visual screenshot — screenshots have been observed to occasionally return stale/cached renders that don't reflect the live DOM in this environment, so treat a suspicious-looking screenshot as inconclusive and cross-check with a JS query before trusting it either way. Reproduce the actual failing scenario (not just a fresh happy-path load) when fixing a reported bug.

## Editing conventions actually in use

- Everything is minified-by-hand inline CSS/JS in the `<head>`/`<body>` — match the existing terse style (no semicolons-as-style-choice debates, no reformatting passes) rather than introducing a build step or splitting into separate files. `shared.js` is the sole deliberate exception (see above); don't extract further shared code without a similar concrete justification.
- Korean-language, guest-facing copy is the product; when changing copy, preserve tone (formal-polite, warm, minimal) and the existing `word-break:keep-all` line-break handling for Korean text.
- All dynamic HTML is built via template literals through a local `esc()` helper (`&<>"'` escaping) — always run user-supplied or backend-supplied strings through `esc()` before interpolating into `innerHTML`, matching the existing pattern in every page.
- `og:image` / Open Graph tags are hand-maintained per page for KakaoTalk link previews (see `README.txt` for the KakaoTalk cache-busting caveat: it ignores everything after `#` in previews, so preview copy must stay generic/shared rather than personalized).
- Section/question schemas (`SEC_DEFS` in `index.html`, `STORY`/`SECS` in `ask.html`, section rendering in `review.html`) are hand-kept in sync by key (e.g. `preshow`, `candle`, `groom`, `speech`, `song`, `march`...) across files — if you add/rename a section key in one file, check whether the same key is read or written in the others before assuming it's isolated.
