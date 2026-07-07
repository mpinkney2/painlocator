# PainLocator

A simple, client-side pain logging tool. Tap the body avatar to mark where it hurts, describe the pain, and build a timeline your doctor can review.

**All data stays in your browser** (localStorage). No server, no accounts, no network calls.

## Quick start

```bash
cd /Users/mattpinkney/DEV/Pain_Locator
./start.sh
```

Open **http://localhost:5500** in your browser.

> **Note:** If port 8080 shows your home directory listing, another server is running from `~`. Use `./start.sh` (port 5500) instead, or stop the old server: `kill $(lsof -t -i:8080)`

> You can also open `index.html` directly, but a local server is recommended for speech recognition in some browsers.

## How to use

1. **Pick a body view** — Front, Back, Left, or Right.
2. **Tap a body region** on the avatar to place a pain marker.
3. **Set intensity** (0–10), quality, triggers, and how long pain eases after stopping.
4. **Add notes** — type or use the microphone (Chrome/Safari).
5. Click **+ Log This Entry**.
6. Review the **Recovery Timeline** chart and **AI Pattern Insight** on the right.
7. **Export Report** (print/PDF) or **Share** (copy/download JSON).

## Project structure

```
src/engine/          Clinical Anatomy Engine (reusable)
  anatomy/           Regions, plates, CAE core
  coordinates/       Normalized coordinate mapping
  annotations/       Pain regions, markup renderer
  overlays/          Visualization modes
  reporting/         Print/share reports

src/features/        PainLocator workflow features
  capture/           Entry logging
  review/            Timeline, history, compare
  clinical-analysis/ Clinical insights

src/layout/          Shell styles, panel resizers
src/ui/              Generic UI behaviors
src/state/           App state, workflow mode
src/types/           TypeScript definitions
src/app/             Bootstrap / init

public/anatomy/      Anatomy plate assets per model
```

## Development

```bash
npm install
npm run build    # TypeScript check
./start.sh       # http://localhost:5500
```

## Files

| Path | Purpose |
|------|---------|
| `index.html` | App shell and script load order |
| `src/app/bootstrap.js` | Initialization |
| `src/layout/styles.css` | UI styles |
| `src/engine/` | Clinical Anatomy Engine |
| `src/features/` | Capture, Review, Clinical Analysis |

## Privacy

- Entries are stored under the key `painlocator_entries` in localStorage.
- Sharing exports a JSON file you control — nothing is sent automatically.
- Use **Clear** to wipe all local data.

## Customization

- **Anatomy layers** — toggle muscle, skeletal, nerve, and organ overlays in the left panel.
- **Pattern insights** — rule-based summaries in `src/features/clinical-analysis/insights.js`.
