<p align="right">English | <a href="README.md">简体中文</a></p>

<h1 align="center">Homepage Modules</h1>

<p align="center">
<b>30 modules</b> in one plugin: todo board · pomodoro · habit tracker · FSRS vocabulary · AI assistant · ledger · calendar · weather and more.<br/>
Each module works from <b>a single code block</b>, data stays <b>100% local</b>, and your homepage supports <b>drag-and-drop layout</b>, theme-aware styling, and Ctrl+scroll zoom. Works on both desktop and mobile.
</p>

<p align="center">
  <img src="assets/demo-homepage.gif" width="300" alt="Homepage modules demo" />
  &nbsp;&nbsp;
  <img src="assets/demo-vocab.gif" width="300" alt="FSRS vocabulary demo" />
</p>

## ⚡ Install via BRAT (30 seconds)

Not yet in the official community store, so install through **BRAT**, which keeps the plugin auto-updated:

1. From the Community Plugins store, install and enable **BRAT** (Obsidian42 - BRAT).
2. Run the command **BRAT: Add a beta plugin**, or click **Add Beta Plugin** in BRAT's settings.
3. Enter this repository:
   ```
   lv-g-eng/obsidian-homepage-modules
   ```
4. Enable **Homepage Modules** under **Community plugins**.
5. Create a note and drop in a code block to start using it:

   ````markdown
   ```pomodoro
   title: Focus
   focus: 25
   break: 5
   ```
   ````

   Or run the **Generate toolkit homepage** command to lay out every module at once.

> 💡 The full vocabulary word bank (CET-4 / CET-6 / IELTS, ~14,000 words) is **not** bundled into the plugin binary. On first use it is **downloaded automatically from the GitHub Release and cached locally**, so BRAT users never have to copy files by hand.

Pricing: **7-day free trial** unlocks everything; **one-time purchase of ¥59 for a perpetual license** (not a subscription). The free modules `clock`, `links`, `countdown`, and `random` are always available.

> This is an independent implementation of the paid "Obsidian Modular Homepage" plugin from Xiaohongshu, including a self-built, sellable licensing system.

## Module list (30)

| Category | Modules (code-block tag) |
|----------|--------------------------|
| Productivity (7) | `todo` todo board · `today` today list · `pomodoro` pomodoro timer · `pomodoro-heatmap` focus heatmap · `timeblock` time blocking · `countdown` countdown · `capture` quick capture |
| Habits & Health (4) | `habit` habit tracker · `mood` mood log · `water` water intake · `sleep` sleep log |
| Learning & Memory (4) | `vocab` vocabulary (FSRS) · `flashcards` flashcards · `reading` reading list · `review-queue` review queue |
| AI (3) | `ai-chat` AI assistant · `ai-summary` AI summary → task dispatch · `ai-brief` daily morning brief |
| Finance (4) | `ledger` ledger · `budget` budget · `goal` goal progress · `subs` subscription manager |
| Dashboard (5) | `calendar` calendar · `weather` weather · `stats` vault stats · `links` quick links · `clock` clock |
| Tools (1) | `random` random picker |

Free modules: `clock`, `links`, `countdown`, `random`. The rest are Pro (unlocked by the 7-day trial).

---

> Everything below is for development / self-hosting. Regular users only need the **Install** section above.

## Development / local loading

```bash
npm install
npm run dev          # esbuild watch, emits main.js
```

Copy `main.js`, `manifest.json`, and `styles.css` into your test vault's `<vault>/.obsidian/plugins/homepage-modules/`:

- Option A — set an environment variable so esbuild writes straight into the test vault:
  ```powershell
  $env:HM_OUT="C:/TestVault/.obsidian/plugins/homepage-modules"; npm run dev
  ```
- Option B — create a symbolic link in that directory pointing at this repo's build output:
  ```powershell
  New-Item -ItemType SymbolicLink -Path "C:/TestVault/.obsidian/plugins/homepage-modules" -Target "D:/xiaohongshu/obsidian"
  ```

Then enable it under **Community plugins** in Obsidian. Code changes trigger an automatic rebuild; install the community **Hot-Reload** plugin for live reloading.

## Verify

```bash
npx tsc -noEmit -skipLibCheck   # type check
npm run build                    # production build
node smoke-test.cjs              # smoke test: loads the build against a stub of obsidian, confirms 29 processors register
```

Mobile testing: run `this.app.emulateMobile(true)` in the desktop devtools console; for real devices use `chrome://inspect` on Android and the macOS Safari Web Inspector on iOS 16.4+.

## Usage

Create a note and write:

````markdown
```pomodoro
title: Focus
focus: 25
break: 5
```
````

Or use the **Generate toolkit homepage** command to build a homepage containing every module. See `示例主页.md` for a full example.

## Selling / licensing

The licensing backend lives in `server/` (a Cloudflare Worker with Ed25519 offline-signed tokens and 3-device binding); see `server/README.md` for deployment. After deploying, fill `ACTIVATION_URL` and `SERVER_PUBLIC_KEY` into `src/license/license-manager.ts`, then run `npm run build`.

> Note: a client-side plugin can always be modified, so the licensing layer aims to *raise the barrier* rather than provide unbreakable protection.

## Architecture

- `src/core/` — module system, hybrid storage (`data.json` + per-item `.homemodules/` JSON with cross-device LWW merge), event bus, settings, zoom
- `src/modules/<name>/` — individual modules (one code-block tag + render + data)
- `src/ui/` — homepage grid (drag-and-drop), components (cards, SVG heatmaps, modals)
- `src/ai/` — OpenAI-compatible dual-transport client (streaming on desktop / `requestUrl` on mobile)
- `src/license/` — trial + offline signed-token verification + device fingerprinting
