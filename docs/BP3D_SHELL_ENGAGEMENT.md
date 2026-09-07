# BP3D engagement across Patient + Clinician shells

**Date:** 2026-09-07  
**Status:** Product runtime engagement (Recommendation B)

## Behavior

At boot (`Bp3dShellEngagement.engageBp3dAcrossShells`):

1. Sets `PAINLOCATOR_CANONICAL_BODY_MODE = true` unless `?canonicalBodyMode=0`
2. Prefers **Spatial** when WebGL is available (both shells)
3. On `presentationchange`, refreshes clinician BP3D layer controls without remounting Spatial

| Shell | Visible body | BP3D role |
| --- | --- | --- |
| **Patient** | Calm stylized exterior (conformed into canonical frame) | Hidden registration body; runtime XYZ debug only |
| **Clinician** | Same exterior + Surface / Muscle / Skeletal | Shoulder packs use **identity** registration in canonical mode |

## Opt-out

| Query | Effect |
| --- | --- |
| `?canonicalBodyMode=0` | Legacy mannequin space + Slice 3 shoulder adapter |
| `?displayMode=plate` or `?plate=1` | Stay on 2D plate |
| `?displayMode=spatial` | Force Spatial preference |

## Non-goals

- Does not persist `canonicalBodyXYZ`
- Does not show raw BP3D skin to patients
- Does not auto-open Muscle/Skeletal (still Surface default; packs lazy)
