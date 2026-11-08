# Exploded: instructions for coding agents

Real machines, built from code with their real numbers, taken apart in the browser. One self-contained page per
machine and language (en, fr, es), a gallery, a Cloudflare Worker for the root. Read `README.md` first.
These instructions hold for any agent (Claude Code, OpenCode, Codex…); `CLAUDE.md` points here.

## The teardown skill

Every machine is built with the teardown skill. `SKILL_DIR` points to it: `~/.claude/skills/teardown` by default, or
the copy the launcher put in the working tree (`./.skill`, ignored by git). Read `$SKILL_DIR/SKILL.md` entirely
before starting, then the docs it points to.

- Frame capture uses the skill's Playwright Chromium. Without a GPU (Linux VMs), WebGL runs on SwiftShader: slower,
  same pixels. On macOS, if headless Chromium gets no WebGL context, set
  `CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
- `ffmpeg` and Python 3 are needed for the film and its score.

## Adding a machine

Each machine has a brief, `machines/<slug>/PROMPT.md`: follow it together with the skill. Then follow `README.md`,
section "Adding a machine". In short:

- `machines/<slug>/` holds `<p>-shared/` (model, geometry, console, tour, live page, i18n), `<p>-film/main.js`,
  `<p>-live/main.js`, `check.mjs`, `REFERENCES.md`, `FILM.md`, `og.png` (1200 × 630). `<p>` is a short prefix.
- Import the kit as `teardown-kit/…` (the build maps it to `kit/`).
- Every word goes through an `i18n.js` built with `makeT()` from `shared/i18n.js`, in en, fr and es.
- The live page calls `createChrome({slug, name, credit})` from `shared/chrome.js`.
- `check.mjs` recomputes the machine's figures; add it to the `check` script of `package.json`.
- Add the machine at the top of `MACHINES` in `scripts/machines.mjs` (newest first), with its title, line and
  description in 3 languages; update the gallery's description there and the README's table.
- The share card is rendered from the film with `{"lang":"en","clean":true}` (no console), see `machines/rope/FILM.md`.
- Models to copy from: `machines/rope`, `machines/radial`, `machines/pepper` (the most recent).
- Each machine has its own look: its own ground, light, materials, accent colour, console layout and type. Look at
  the other machines' `og.png` first; a new machine must not look like any of them.

## Do not

- Modify `kit/`, `shared/`, `worker/` or another machine's folder. Machine-specific styling stays in the machine.
- Track study material (photos, PDFs: `machines/<slug>/ref/`) or outputs (`teardown-out/`, `*.mp4`, `*.wav`): they
  are gitignored on purpose.
- Push to `main` or merge anything: `main` deploys to production. Work on your branch, `machine/<slug>`.
- Copy, print or write any secret or token.

## Done means

1. `npm test` passes (every machine's figures, the root language test, the build; each page under 1 MB).
2. The built page `dist/en/<slug>/index.html` runs in headless Chromium without console errors (the analytics beacon
   and the favicon fail under `file://`, that is expected), in en, fr and es.
3. The beats contact sheets (`--stills beats`) were looked at and pass the skill's review checklist; what you saw
   was fixed.
4. The film is recorded with its sound (`teardown-out/<slug>-en.mp4`), the share card `og.png` written with ffmpeg
   `-map_metadata -1`.
5. Everything committed on `machine/<slug>` and pushed, with a summary of the decisions and of what is estimated in
   the last commit message. The owner opens the pull request.
