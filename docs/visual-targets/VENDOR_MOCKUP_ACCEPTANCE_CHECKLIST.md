# Vendor mockup acceptance checklist

Use with the local visual QA harness (`npm run vendor-eval:serve`) and the approved PainLocator references:

- `docs/visual-targets/painlocator-clinician-anatomy-target-light.png`
- `docs/visual-targets/painlocator-clinician-anatomy-target-dark.png`

**Rule:** loading successfully is **not** acceptance.

Vendor: ____________  Sample version: ____________  Date: ____________  Reviewer: ____________

| Check | Pass? | Notes |
| --- | --- | --- |
| Recognizable adult human proportions | ☐ | |
| Muscle silhouette readable at overview | ☐ | |
| Head / neck realism acceptable | ☐ | |
| Torso detail acceptable | ☐ | |
| Shoulder detail acceptable | ☐ | |
| Hands readable (not blocky stubs) | ☐ | |
| Pelvis readable | ☐ | |
| Knee readable | ☐ | |
| Feet readable | ☐ | |
| Skeletal realism (if tested) | ☐ | |
| Visual continuity across regions | ☐ | |
| No mannequin / capsule appearance | ☐ | |
| Front / Back / Left / Right framing OK | ☐ | |
| Global registration residuals acceptable | ☐ | |
| Structure selection → FMA path works | ☐ | |
| Patient mode still cannot load packs | ☐ | |

**Overall:** ☐ Accept for license negotiation ☐ Reject / request different LOD ☐ Incompatible with canonical frame

Disclaimer reminder: anatomical context only — not a diagnosis.
