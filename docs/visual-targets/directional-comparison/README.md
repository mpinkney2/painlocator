# Directional views comparison (adult-male)

Quick visual QA: **current production plates** vs a **new candidate set** for front / back / left / right.

Open locally: [`index.html`](./index.html)

| View | Current | Candidate |
| --- | --- | --- |
| Front | [`current/front.png`](./current/front.png) | [`candidate/front.png`](./candidate/front.png) |
| Back | [`current/back.png`](./current/back.png) | [`candidate/back.png`](./candidate/back.png) |
| Left | [`current/left.png`](./current/left.png) | [`candidate/left.png`](./candidate/left.png) |
| Right | [`current/right.png`](./current/right.png) | [`candidate/right.png`](./candidate/right.png) |

## Intent

Produce an independent four-view set in the same holographic musculo-skeletal atlas style as today’s `public/anatomy/adult-male/{view}.png`, then compare framing, laterality, and sex consistency — without wiring candidates into the app.

## Observations

1. **Style** — Candidates match the cyan/blue translucent muscle + brighter skeletal glow on black.
2. **Crop consistency** — Current front/back are torso-forward crops; current left reads taller/fuller. Candidates target a shared mid-neck → mid-thigh frame.
3. **Shared side assets** — `adult-female/left.png` and `right.png` are currently byte-identical to the male side plates (known gap). Candidates keep an adult-male-only laterality pair.
4. **Right laterality** — Candidate right faces image-left (viewer sees body’s right), aligned with `spatial-projection.js` (`right` → yaw `+π/2`).
5. **Not a drop-in** — Generated art is comparison-only. Replacing production plates needs clinical review, region/hit-map checks, and female/child/teen/senior parity.

## Non-goals

- No change to `public/anatomy/` runtime paths
- No schema / CAE coordinate changes
- No claim of clinical anatomical certification
