# Spatial-primary locate (Patient + Clinician)

**Date:** 2026-09-07  
**Status:** Product runtime — Spatial is the interactive locate surface

## Decision

The CAE **2D plate image** and the **Spatial 3D body** share one stage and conflict when both try to occupy it. Product locate no longer presents the plate image in front of (or instead of) the 3D body.

| Surface | Role |
| --- | --- |
| **Spatial 3D** | Primary interactive locate — rotate, snap Front/Back/Left/Right, tap to mark |
| **CAE 2D plate** | Silent fallback only (no WebGL / mount failure) + off-stage report/PDF map compositing |

## Behavior

At boot (`Bp3dShellEngagement.engageBp3dAcrossShells`):

1. Sets `PAINLOCATOR_CANONICAL_BODY_MODE = true` unless `?canonicalBodyMode=0`
2. Mounts **Spatial** whenever WebGL works (both shells)
3. Applies Spatial-primary chrome: hide 2D toggle, Enlarge, and plate-only Region/Polygon tools
4. On `presentationchange`, refreshes clinician BP3D layer controls without remounting Spatial

| Shell | Visible body | BP3D role |
| --- | --- | --- |
| **Patient** | Calm stylized exterior (conformed into canonical frame) | Hidden registration body; runtime XYZ debug only |
| **Clinician** | Same exterior + Surface / Muscle / Skeletal | Shoulder packs use **identity** registration in canonical mode |

## Opt-out / QA

| Query | Effect |
| --- | --- |
| `?canonicalBodyMode=0` | Legacy mannequin space + Slice 3 shoulder adapter |
| `?displayMode=plate` or `?plate=1` | Stay on 2D plate fallback |
| `?displayToggle=1` or `?dev=1` | Show 2D / Spatial toggle for QA |
| `?displayMode=spatial` | Force Spatial preference |

## Non-goals

- Does not persist `canonicalBodyXYZ`
- Does not show raw BP3D skin to patients
- Does not auto-open Muscle/Skeletal (still Surface default; packs lazy)
- Does not delete plate assets (still needed for report maps and no-WebGL devices)
