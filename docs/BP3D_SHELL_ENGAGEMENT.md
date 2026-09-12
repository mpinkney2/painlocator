# Spatial-primary locate (Patient + Clinician)

**Date:** 2026-09-12  
**Status:** Product runtime — Spatial is the interactive locate surface for clinician; simple pain-map defaults to Human with an on-map Human|3D toggle

## Decision

The CAE **2D plate image** and the **Spatial 3D body** share one stage and conflict when both try to occupy it. Clinician locate is Spatial-primary. Simple pain-map (patient) defaults to the Human plate and lets the user switch to 3D.

| Surface | Role |
| --- | --- |
| **Spatial 3D** | Clinician default; patient optional via Human\|3D toggle — rotate, snap Front/Back/Left/Right, tap to mark |
| **CAE 2D / Human plate** | Simple pain-map default; clinician fallback only (no WebGL / mount failure) + off-stage report/PDF map compositing |

## Behavior

At boot (`Bp3dShellEngagement.engageBp3dAcrossShells`):

1. Sets `PAINLOCATOR_CANONICAL_BODY_MODE = true` unless `?canonicalBodyMode=0`
2. Mounts **Spatial** when preferred (clinician default; simple pain-map only if user chose 3D or URL requests it)
3. Applies Spatial-primary chrome: hide Enlarge and plate-only Region/Polygon tools while Spatial is active
4. Simple pain-map always shows the **Human | 3D** dock; other shells show the 2D/Spatial dock only with QA flags
5. On `presentationchange`, refreshes clinician BP3D layer controls without remounting Spatial

| Shell | Visible body | BP3D role |
| --- | --- | --- |
| **Patient (Human)** | MetaHuman-style plate image | Not mounted |
| **Patient (3D)** | Calm stylized exterior (conformed into canonical frame) | Hidden registration body; runtime XYZ debug only |
| **Clinician** | Same exterior + Surface / Muscle / Skeletal | Shoulder packs use **identity** registration in canonical mode |

## Opt-out / QA

| Query / preference | Effect |
| --- | --- |
| `?canonicalBodyMode=0` | Legacy mannequin space + Slice 3 shoulder adapter |
| `?displayMode=plate` or `?plate=1` | Stay on 2D / Human plate |
| `?displayMode=spatial` | Force Spatial preference (including simple pain-map) |
| `?displayToggle=1` or `?dev=1` | Show 2D / Spatial toggle outside simple pain-map |
| `localStorage.painlocator_simple_display_mode` | Remembers simple pain-map Human vs 3D choice (`plate` \| `spatial`) |

## Non-goals

- Does not persist `canonicalBodyXYZ`
- Does not show raw BP3D skin to patients
- Does not auto-open Muscle/Skeletal (still Surface default; packs lazy)
- Does not delete plate assets (still needed for report maps and no-WebGL devices)
