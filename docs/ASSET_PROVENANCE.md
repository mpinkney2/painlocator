# Asset provenance — PainLocator body images and 3D figures

**Status:** evidence record from git history, Cursor cloud-agent transcripts, and tool calls  
**Scope:** pain-map work on PR #22 (`cursor/simple-pain-map-83c7`), PR #25 (`cursor/directional-views-comparison-ddf8`), PR #26 (`cursor/simple-pain-map-toggle-448c`), plus classic July atlas plates referenced by those branches  
**Method:** transcript mining + `git`/`gh` audit only; values marked **unknown** were not recoverable from available session history  
**Recorded:** 2026-11-02 (America/Chicago)

Agents with recoverable image-generation tool history:

| Agent | Branch / PR | Role |
| --- | --- | --- |
| `bc-01a0897b-1179-75ba-b496-51d434fbddf8` | PR #25 `cursor/directional-views-comparison-ddf8` | Blue candidate plates + first MetaHuman-style sprite sheets |
| `bc-e3c2d35f-7e54-4fbb-979d-b8e60f003606` | PR #22 `cursor/simple-pain-map-83c7` | `mh-*.png` HQ/prod/tee regenerations, chroma-key pack, New-avatar-stand install |
| `bc-01a0968e-f1fc-7116-b688-79de340b448c` | PR #26 `cursor/simple-pain-map-toggle-448c` | Human\|3D toggle; reused existing assets (no new GenerateImage) |
| `bc-019fae2d-6d0d-7f90-814a-6afb71ca83c7` | PR #22 (footer agent id) | Transcript **not available** to this audit (studio-person prompts unknown) |

Tool used for all recovered stills: Cursor **`GenerateImage`**. Underlying image-model name inside tool args: **unknown**.

No evidence that any `mh-*.png` / MetaHuman-style still was downloaded from a stock library, Unsplash, or third-party asset pack. Upscale weights only: OpenCV FSRCNN (`Saafke/FSRCNN_Tensorflow` GitHub).

---

## Answers (plain language)

1. **Photo-style figures (man, woman, teen, child, elderly; front/back/left/right; gray tee/shorts):** Created with Cursor `GenerateImage`, not downloaded. First as 5 horizontal chroma-key sprite sheets (PR #25), then regenerated as per-view `mh-hq-*` → `mh-prod-*` stills and reclothed as `mh-tee-*` (PR #22 agent). Processed with green-screen key + 4× FSRCNN into `public/anatomy/metahuman/`. Exact prompts are in [Prompts](#prompts). Teen/child/elderly first wore nude-tone bodysuits, then were regenerated in gray tee/shorts. Woman/man first sheet attempts failed (HTTP 400; prompt args stripped); clothed retries succeeded. Female teen/child/senior variants added later via more `GenerateImage` calls.
2. **`/opt/cursor/artifacts/assets/mh-*.png` and sprite/green-screen stills:** Produced in-session by `GenerateImage` into that artifacts folder, then keyed/upscaled by `scripts/build-metahuman-anatomy-pack.py`. **Not** copied from an outside website/stock pack (no source URL). FSRCNN model from GitHub only.
3. **`New-avatar-stand` / Blender 3D figure:** User-uploaded Blender export (`New-avatar-stand.glb`, generator `Khronos glTF Blender I/O v4.4.55`). Agent meshopt-compressed it to `public/anatomy/metahuman/body.glb`. Not agent-generated; commercial license beyond repo LICENSE text: **unknown**.
4. **Blue X-ray plates (July first commit):** Introduced in `2cffe30` (2026-07-07) as `public/anatomy/{adult-male,adult-female,teen,child,senior}/*.png`. **Origin / vendor / license: unknown.** Later PR #25 generated *candidate* blue plates via `GenerateImage` (eval only under `docs/visual-targets/`).
5. **MetaHuman / Unreal / Epic asset?** **No** evidence of importing an official Epic MetaHuman DNA, Fab, or Unreal Editor asset. Agents used “MetaHuman” / “Unreal Engine” as **prompt style language** and product naming; transcripts state the environment had no Unreal Editor / MetaHuman DNA and that stills are “AI humans, not Epic MetaHumans.” The GLB is a user Blender mesh (bones described as MetaHuman-*style*). Separate licensed content in the wider repo: BodyParts3D (CC BY 4.0) — not these photo plates.
6. **Duplicates:** Classic July atlas: child/teen/senior are **byte-identical** to adult-male (all views); adult-female **left/right** are **byte-identical** to adult-male left/right (front/back female differ). MetaHuman pack: child/teen/senior folders are **copies of male** plates (`child`≡`child-male`, etc.); woman left/right are **not** copies of man; profiles were separately generated (not adult-male byte clones).

---

## Provenance table

| File / folder | How made | Tool / model | Prompt / process | Source / license | Date (UTC unless noted) |
| --- | --- | --- | --- | --- | --- |
| `public/anatomy/{adult-male,adult-female,teen,child,senior}/*.png` (classic blue “Clinical Atlas”) | Present in initial CAE foundation commit; creation method not in recoverable agent transcripts | **unknown** | **unknown** | **unknown** (no LICENSE beside plates; not traced to stock URL in this audit) | 2026-07-07 (`2cffe30`, author America/Chicago) |
| `docs/visual-targets/directional-comparison/candidate/*` | AI stills, blue holographic style; refs = classic adult-male plates | Cursor `GenerateImage` (model **unknown**) | See prompts §1.1–1.7 | Eval art; AI-generated | 2026-09-10 (PR #25) |
| `docs/visual-targets/metahuman-sprites/` initial sheets/frames/atlas | `GenerateImage` chroma-key sprite sheets → keyed transparent frames | Cursor `GenerateImage` | See prompts §1.8–1.12; user request: “sprite sheet set to look like a meta human… Woman, man, teen, child, elderly” | AI-generated; no stock URL | 2026-09-10 (PR #25 `fab6027`) |
| `/opt/cursor/artifacts/assets/metahuman-sheet-*-raw.png` | Same sheet generation outputs | Cursor `GenerateImage` | §1.8–1.12 | Session artifacts (not stock download) | 2026-09-10 |
| `/opt/cursor/artifacts/assets/mh-hq-*.png` | Per-view regen from sprite frames | Cursor `GenerateImage` | §2 mh-hq-* | Session artifacts | 2026-09-10 (PR #22 agent) |
| `/opt/cursor/artifacts/assets/mh-prod-*.png` | Sharper regen from `mh-hq-*` refs | Cursor `GenerateImage` | §2 mh-prod-* | Session artifacts | 2026-09-10 |
| `/opt/cursor/artifacts/assets/mh-tee-*.png` | Reclothe teen/child/elderly (+ female variants) into gray tee/tank + shorts | Cursor `GenerateImage` | §2 mh-tee-*; refs include man/woman clothing stills | Session artifacts | 2026-09-10 |
| `docs/visual-targets/metahuman-sprites/hq-raw/*` | Copied/processed HQ stills from artifacts | Build pipeline | Chroma inputs for pack builder | Derived from GenerateImage | 2026-09-10 (`2717e14`, `7d28da0`, `8a22db8`, `ad2807a`) |
| `docs/visual-targets/metahuman-sprites/frames/*` | Green-screen keyed + (later) FSRCNN upscaled frames | Python + OpenCV FSRCNN (`scripts/vendor/FSRCNN_x4.pb` from Saafke/FSRCNN_Tensorflow) | N/A (post-process) | Derived; FSRCNN weights from GitHub | 2026-09-10 |
| `public/anatomy/metahuman/{adult-male,adult-female,teen-male,teen-female,child-male,child-female,senior-male,senior-female}/*.png` | Letterboxed 2048×3072 RGBA plates from keyed frames | `scripts/build-metahuman-anatomy-pack.py` | N/A | Derived from GenerateImage stills; **no** asset LICENSE file in folder | 2026-09-10 |
| `public/anatomy/metahuman/{teen,child,senior}/*` | **Duplicates** of male plates (aliases) | `shutil` copy in build script (`FOLDER_ALIASES`) | N/A | Same bytes as `*-male` | 2026-09-10 |
| `public/anatomy/metahuman/thumbs/*.png` | Cropped/resized from front plates | Build script | N/A | Derived | 2026-09-10 |
| `public/anatomy/simple-pain-map/{front,back,left,right}.png` | Commit claims “photorealistic … warm-white cyclorama”; **creation tool/prompts not in available transcripts** | **unknown** (likely GenerateImage on unavailable PR #22 agent `bc-019fae2d…`) | **unknown** | **unknown** | 2026-09-08 (`bab8aae`) |
| `public/anatomy/metahuman/body.glb` (`New-avatar-stand`) | User-uploaded Blender glTF; meshopt-compressed by agent | Blender export (`Khronos glTF Blender I/O v4.4.55`) + `gltf-transform` meshopt | N/A (mesh, not image prompt) | User upload; `public/anatomy/spatial/adult-male/LICENSE.md` on pain-map branch: © 2026 PainLocator contributors and the figure author; broader commercial terms **unknown** | 2026-09-11 (`7940b62`) |
| PR #26 toggle UI | Code only; no new body art | N/A | N/A | Reuses metahuman plates + `body.glb` | 2026-09-12 |

### Duplicate matrix (byte identity)

| Pair | Result | Evidence |
| --- | --- | --- |
| Classic `teen|child|senior` vs `adult-male` (all views) | **Identical** | SHA-256 match on current tree / v0.1.0 |
| Classic `adult-female` left/right vs `adult-male` left/right | **Identical** | SHA-256 match |
| Classic `adult-female` front/back vs male | **Different** | SHA-256 differ |
| MetaHuman `teen|child|senior` vs `*-male` | **Identical** (alias folders) | Build script + SHA-256 |
| MetaHuman woman vs man (any view) | **Different** | SHA-256 differ |
| MetaHuman child/teen/senior-male vs adult-male | **Different** (separately generated) | SHA-256 differ |

---

## Evidence notes

- User upload quote (Blender): `New-avatar-stand.glb use this` → `/home/ubuntu/.cursor/projects/workspace/uploads/New-avatar-stand_bf2b.glb` → `public/anatomy/metahuman/body.glb` (SHA256 `cbd84dc29bfedd356ce42a0c37e096003444e38550f903fadb32cf4ee74e0596`).
- Agent quote: “This environment has no Unreal Editor and no MetaHuman DNA library.” / “These are AI humans, not Epic MetaHumans.”
- Changelog/docs historically note classic child/teen/senior reuse adult-male plates.
- `/opt/cursor/artifacts/assets/` is empty on this audit VM; filenames recovered from transcript events and build script.

---

## Prompts

Exact prompts recovered from tool calls follow. Studio-person / `simple-pain-map` prompts: **unknown**. Failed woman/man first-sheet prompts: **unknown** (`tool_args` stripped). Image model behind `GenerateImage`: **unknown**.

## 1) bc-01a0897b-1179-75ba-b496-51d434fbddf8

Transcript: `/tmp/cursor/cloud-agent-transcripts/2026-11-02T06-48-41Z-94c4/bc-01a0897b-1179-75ba-b496-51d434fbddf8/transcript.json`

### 1.1 `candidate-adult-male-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/candidate-adult-male-front.png`
- **Msg index:** 73
- **tool_call_id:** `turn-0:step:42:tool`
- **Regenerated:** no
- **Reference image paths:**
  - `/workspace/public/anatomy/adult-male/front.png`
  - `/workspace/public/anatomy/adult-male/back.png`

**Prompt (verbatim):**

```
Clinical medical anatomy plate, adult male, ANTERIOR (front) view only. Square 1:1 composition. Solid pure black background. Semi-transparent electric cyan/blue musculature with fine fiber striations over brighter glowing white-blue skeleton (spine, ribs, pelvis, clavicles, arm bones). Anatomical position: facing camera, arms slightly abducted, palms forward. Frame from mid-neck to mid-thigh, body centered, no head crown, no text, no labels, no watermark, no logo. Same holographic X-ray medical visualization style as professional clinical atlas plates.
```

### 1.2 `candidate-adult-male-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/candidate-adult-male-back.png`
- **Msg index:** 75
- **tool_call_id:** `turn-0:step:43:tool`
- **Regenerated:** no
- **Reference image paths:**
  - `/workspace/public/anatomy/adult-male/back.png`
  - `/workspace/public/anatomy/adult-male/front.png`

**Prompt (verbatim):**

```
Clinical medical anatomy plate, adult male, POSTERIOR (back) view only. Square 1:1 composition. Solid pure black background. Semi-transparent electric cyan/blue musculature with fine fiber striations over brighter glowing white-blue skeleton (full spine, scapulae, ribs, pelvis, arm bones). Anatomical position: back facing camera, arms slightly abducted. Frame from mid-neck to mid-thigh, body centered, no head crown, no text, no labels, no watermark. Same holographic X-ray medical visualization style as professional clinical atlas plates. Show trapezius, latissimus dorsi, gluteals.
```

### 1.3 `candidate-adult-male-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/candidate-adult-male-left.png`
- **Msg index:** 77
- **tool_call_id:** `turn-0:step:44:tool`
- **Regenerated:** no
- **Reference image paths:**
  - `/workspace/public/anatomy/adult-male/left.png`
  - `/workspace/public/anatomy/adult-male/front.png`

**Prompt (verbatim):**

```
Clinical medical anatomy plate, adult male, LEFT lateral (left side) profile view only. Square 1:1 composition. Solid pure black background. Semi-transparent electric cyan/blue musculature with fine fiber striations over brighter glowing white-blue skeleton (spine S-curve, ribs, pelvis, femur). Figure facing viewer-left (anatomical left side toward camera). Standing upright, arm at side. Frame from mid-neck to mid-thigh to match torso-focused plates, body centered, no text, no labels, no watermark. Same holographic X-ray medical visualization style as professional clinical atlas plates.
```

### 1.4 `candidate-adult-male-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/candidate-adult-male-right.png`
- **Msg index:** 79
- **tool_call_id:** `turn-0:step:45:tool`
- **Regenerated:** no
- **Reference image paths:**
  - `/workspace/public/anatomy/adult-male/right.png`
  - `/workspace/public/anatomy/adult-male/front.png`

**Prompt (verbatim):**

```
Clinical medical anatomy plate, adult male, RIGHT lateral (right side) profile view only. Square 1:1 composition. Solid pure black background. Semi-transparent electric cyan/blue musculature with fine fiber striations over brighter glowing white-blue skeleton (spine S-curve, ribs, pelvis, femur). Figure facing viewer-right (anatomical right side toward camera). Standing upright, arm at side. Frame from mid-neck to mid-thigh to match torso-focused plates, body centered, no text, no labels, no watermark. Same holographic X-ray medical visualization style as professional clinical atlas plates. Male anatomy only (not female).
```

### 1.5 `candidate-adult-male-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/candidate-adult-male-right.png`
- **Msg index:** 102
- **tool_call_id:** `turn-0:step:59:tool`
- **Regenerated:** yes — Second successful GenerateImage for same filename (laterality fix).
- **Reference image paths:**
  - `/workspace/public/anatomy/adult-male/right.png`
  - `/opt/cursor/artifacts/assets/candidate-adult-male-left.png`

**Prompt (verbatim):**

```
Clinical medical anatomy plate, adult male, viewing the anatomical RIGHT side of the body (RIGHT lateral view). The figure faces toward the LEFT of the image (nose points left). Square 1:1. Solid pure black background. Semi-transparent electric cyan/blue musculature with fine fiber striations over brighter glowing white-blue skeleton. Standing upright, arm at side. Frame mid-neck to mid-thigh, body centered. No text, no labels, no watermark. Holographic X-ray clinical atlas style. Male only. Mirror opposite of a left-side profile.
```

### 1.6 `candidate-adult-male-left-fulllength.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/candidate-adult-male-left-fulllength.png`
- **Msg index:** 154
- **tool_call_id:** `turn-2:step:3:tool`
- **Regenerated:** no — New filename; replaced cropped lateral candidates in docs/visual-targets (not same filename overwrite).
- **Reference image paths:**
  - `/workspace/public/anatomy/adult-male/left.png`
  - `/workspace/docs/visual-targets/directional-comparison/candidate/front.png`

**Prompt (verbatim):**

```
Clinical medical anatomy plate, adult male, LEFT lateral view (viewer sees body's left side). FULL LENGTH FIGURE from crown of head to soles of feet — complete standing body, not cropped at thighs. Square 1:1 composition with figure centered vertically filling most of the frame head-to-toe like a full-body clinical atlas plate. Solid pure black background. Semi-transparent electric cyan/blue musculature with fine fiber striations over brighter glowing white-blue skeleton (full spine S-curve, ribs, pelvis, femur, tibia/fibula, foot bones). Figure facing toward the right of the image. Arms at sides. No text, no labels, no watermark, no logo. Same holographic X-ray medical visualization style. Male anatomy only.
```

### 1.7 `candidate-adult-male-right-fulllength.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/candidate-adult-male-right-fulllength.png`
- **Msg index:** 156
- **tool_call_id:** `turn-2:step:4:tool`
- **Regenerated:** no — New filename; replaced cropped lateral candidates in docs/visual-targets (not same filename overwrite).
- **Reference image paths:**
  - `/workspace/public/anatomy/adult-male/right.png`
  - `/workspace/docs/visual-targets/directional-comparison/candidate/front.png`

**Prompt (verbatim):**

```
Clinical medical anatomy plate, adult male, RIGHT lateral view (viewer sees body's right side). FULL LENGTH FIGURE from crown of head to soles of feet — complete standing body, not cropped at thighs. Square 1:1 composition with figure centered vertically filling most of the frame head-to-toe like a full-body clinical atlas plate. Solid pure black background. Semi-transparent electric cyan/blue musculature with fine fiber striations over brighter glowing white-blue skeleton (full spine S-curve, ribs, pelvis, femur, tibia/fibula, foot bones). Figure facing toward the LEFT of the image (nose points left). Arms at sides. No text, no labels, no watermark, no logo. Same holographic X-ray medical visualization style. Male anatomy only — flat male chest profile, not female.
```

### 1.8 `metahuman-sheet-teen-raw.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/metahuman-sheet-teen-raw.png`
- **Msg index:** 192
- **tool_call_id:** `turn-3:step:8:tool`
- **Regenerated:** no
- **Reference image paths:** _(none)_

**Prompt (verbatim):**

```
Sprite sheet of ONE teenager (~15 years) MetaHuman-style photorealistic character, gender-neutral adolescent presentation, four full-length standing poses in a horizontal row left-to-right: FRONT anatomical position, BACK, LEFT profile, RIGHT profile. Same teen in all four panels. Realistic Unreal Engine MetaHuman look: natural skin, soft studio lighting, lean adolescent proportions (not adult, not toddler), neutral expression, simple fitted nude-tone anatomical bodysuit (clinical body reference, non-sexual). Pure solid chroma-key green background #00FF00 everywhere, no floor, no shadow, no text, no labels. Equal spacing, each figure fully visible head to toe.
```

### 1.9 `metahuman-sheet-child-raw.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/metahuman-sheet-child-raw.png`
- **Msg index:** 194
- **tool_call_id:** `turn-3:step:9:tool`
- **Regenerated:** no
- **Reference image paths:** _(none)_

**Prompt (verbatim):**

```
Sprite sheet of ONE child (~7 years) MetaHuman-style photorealistic character, four full-length standing poses in a horizontal row left-to-right: FRONT anatomical position, BACK, LEFT profile, RIGHT profile. Same child in all four panels. Realistic Unreal Engine MetaHuman look: natural skin, soft studio lighting, child body proportions (larger head relative to body, shorter limbs), neutral expression, simple fitted nude-tone anatomical bodysuit (clinical pediatric body reference, non-sexual, age-appropriate). Pure solid chroma-key green background #00FF00 everywhere, no floor, no shadow, no text, no labels. Equal spacing, each figure fully visible head to toe.
```

### 1.10 `metahuman-sheet-elderly-raw.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/metahuman-sheet-elderly-raw.png`
- **Msg index:** 196
- **tool_call_id:** `turn-3:step:10:tool`
- **Regenerated:** no
- **Reference image paths:** _(none)_

**Prompt (verbatim):**

```
Sprite sheet of ONE elderly adult (~75 years) MetaHuman-style photorealistic character, four full-length standing poses in a horizontal row left-to-right: FRONT anatomical position, BACK, LEFT profile, RIGHT profile. Same elderly person in all four panels. Realistic Unreal Engine MetaHuman look: natural aged skin with wrinkles, soft studio lighting, older adult proportions, silver/gray hair, neutral expression, simple fitted nude-tone anatomical bodysuit (clinical geriatric body reference, non-sexual). Pure solid chroma-key green background #00FF00 everywhere, no floor, no shadow, no text, no labels. Equal spacing, each figure fully visible head to toe.
```

### 1.11 `metahuman-sheet-woman-raw.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/metahuman-sheet-woman-raw.png`
- **Msg index:** 200
- **tool_call_id:** `turn-3:step:13:tool`
- **Regenerated:** no
- **Reference image paths:** _(none)_

**Prompt (verbatim):**

```
Sprite sheet of ONE adult woman photorealistic MetaHuman-style 3D character. Four full-length standing poses in one horizontal row left-to-right labeled only by pose order: FRONT facing camera, BACK facing away, LEFT side profile, RIGHT side profile. Same woman in all panels. Unreal Engine MetaHuman quality: realistic skin, soft studio key light, average athletic build, calm neutral face. Wearing a plain light-gray fitted athletic tank top and matching shorts (clinical mannequin reference clothing). Solid pure chroma-key green background #00FF00 filling entire frame, no floor, no shadows, no text, no watermarks. Equal panel spacing, each figure complete head to toes.
```

### 1.12 `metahuman-sheet-man-raw.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/metahuman-sheet-man-raw.png`
- **Msg index:** 202
- **tool_call_id:** `turn-3:step:14:tool`
- **Regenerated:** no
- **Reference image paths:** _(none)_

**Prompt (verbatim):**

```
Sprite sheet of ONE adult man photorealistic MetaHuman-style 3D character. Four full-length standing poses in one horizontal row left-to-right: FRONT facing camera, BACK facing away, LEFT side profile, RIGHT side profile. Same man in all panels. Unreal Engine MetaHuman quality: realistic skin, soft studio key light, average athletic male build, calm neutral face. Wearing a plain light-gray fitted athletic t-shirt and matching shorts (clinical mannequin reference clothing). Solid pure chroma-key green background #00FF00 filling entire frame, no floor, no shadows, no text, no watermarks. Equal panel spacing, each figure complete head to toes.
```

### Failed calls (no prompt recovered)

- `turn-3:step:6:tool` and `turn-3:step:7:tool` — HTTP 400; `tool_args` absent in transcript. Context: woman/man MetaHuman sheets with nude-tone bodysuit language; later succeeded as `metahuman-sheet-woman-raw.png` / `metahuman-sheet-man-raw.png` with clothed prompts.

---

## 2) bc-e3c2d35f-7e54-4fbb-979d-b8e60f003606

Transcript: `/tmp/cursor/cloud-agent-transcripts/2026-11-02T06-48-41Z-94c4/bc-e3c2d35f-7e54-4fbb-979d-b8e60f003606/transcript.json`

### 2.1 `mh-hq-woman-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-woman-front.png`
- **Msg index:** 1713
- **tool_call_id:** `turn-11:step:13:tool`
- **Regenerated:** no
- **Reference image paths:**
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/woman-front.png`

**Prompt (verbatim):**

```
Photoreal Unreal Engine 5 MetaHuman cinematic full-body photograph, production quality 8k, razor sharp, not pixelated, not a video game screenshot. Adult woman matching the reference: olive-tan skin, dark brown hair pulled back with a center part and small face-framing strands, calm neutral expression, looking at camera. Wearing a fitted light-gray ribbed tank top and matching light-gray athletic shorts. Barefoot. Natural standing anatomical pose, arms relaxed slightly away from the torso, feet hip-width. Entire figure head-to-toe visible with space around the body. Pure chroma-key green background (#00FF00), no floor, no shadow, no props, no text. Neutral studio lighting, 85mm portrait lens, shallow but full-body in focus.
```

### 2.2 `mh-hq-man-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-man-front.png`
- **Msg index:** 1715
- **tool_call_id:** `turn-11:step:14:tool`
- **Regenerated:** no
- **Reference image paths:**
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/man-front.png`

**Prompt (verbatim):**

```
Photoreal Unreal Engine 5 MetaHuman cinematic full-body photograph, production quality 8k, razor sharp, not pixelated, not a video game screenshot. Adult man matching the reference: light-medium skin, short dark brown hair, light stubble, calm neutral expression, looking at camera. Wearing a fitted light-gray crew-neck t-shirt and matching light-gray athletic shorts. Barefoot. Natural standing anatomical pose, arms relaxed slightly away from the torso, feet hip-width. Entire figure head-to-toe visible with space around the body. Pure chroma-key green background (#00FF00), no floor, no shadow, no props, no text. Neutral studio lighting, 85mm portrait lens, full-body in focus.
```

### 2.3 `mh-hq-teen-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-teen-front.png`
- **Msg index:** 1717
- **tool_call_id:** `turn-11:step:15:tool`
- **Regenerated:** no
- **Reference image paths:**
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/teen-front.png`

**Prompt (verbatim):**

```
Photoreal Unreal Engine 5 MetaHuman cinematic full-body photograph, production quality 8k, razor sharp, not pixelated. Teenage boy matching the reference: fair skin, dark curly medium-length hair, youthful face, calm neutral expression, looking at camera. Wearing a seamless beige/nude athletic bodysuit covering torso, arms, and legs (clinical mannequin base layer, not nude). Barefoot. Natural standing anatomical pose, arms slightly away from the torso. Entire figure head-to-toe visible. Pure chroma-key green background (#00FF00), no floor, no shadow, no props, no text. Neutral studio lighting, 85mm lens, full-body in focus.
```

### 2.4 `mh-hq-child-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-child-front.png`
- **Msg index:** 1719
- **tool_call_id:** `turn-11:step:16:tool`
- **Regenerated:** no
- **Reference image paths:**
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/child-front.png`

**Prompt (verbatim):**

```
Photoreal Unreal Engine 5 MetaHuman cinematic full-body photograph, production quality 8k, razor sharp, not pixelated. Young child matching the reference: fair skin, curly light-brown hair, round youthful face, calm neutral expression, looking at camera. Wearing a seamless beige turtleneck athletic bodysuit covering torso, arms, and legs (clinical mannequin base layer, not nude). Barefoot. Natural standing anatomical pose, arms slightly away from the torso. Entire figure head-to-toe visible, child proportions (larger head, shorter limbs). Pure chroma-key green background (#00FF00), no floor, no shadow, no props, no text. Neutral studio lighting, 85mm lens, full-body in focus.
```

### 2.5 `mh-hq-elderly-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-elderly-front.png`
- **Msg index:** 1721
- **tool_call_id:** `turn-11:step:17:tool`
- **Regenerated:** no
- **Reference image paths:**
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/elderly-front.png`

**Prompt (verbatim):**

```
Photoreal Unreal Engine 5 MetaHuman cinematic full-body photograph, production quality 8k, razor sharp, not pixelated. Elderly man matching the reference: fair wrinkled skin, short white/silver hair, age spots, calm serious expression, looking at camera. Wearing a seamless beige long-sleeve thermal bodysuit covering torso, arms, and legs (clinical mannequin base layer). Barefoot. Natural standing anatomical pose with a slightly softer older posture, arms slightly away from the torso. Entire figure head-to-toe visible, elderly body proportions. Pure chroma-key green background (#00FF00), no floor, no shadow, no props, no text. Neutral studio lighting, 85mm lens, full-body in focus.
```

### 2.6 `mh-hq-woman-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-woman-back.png`
- **Msg index:** 1747
- **tool_call_id:** `turn-11:step:32:tool`
- **Regenerated:** no — Additional view of same identity; front generated first.
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-woman-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/woman-back.png`

**Prompt (verbatim):**

```
Same woman as the first reference photo: dark brown hair in a low ponytail, gray ribbed tank and gray shorts, barefoot. FULL BODY BACK VIEW, facing away from camera, head-to-toe. Photoreal Unreal MetaHuman 8k, sharp, not pixelated. Standing straight, arms slightly away from torso. Pure chroma-key green background (#00FF00), no floor, no shadow, no text. Match identity of the front photo.
```

### 2.7 `mh-hq-man-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-man-back.png`
- **Msg index:** 1749
- **tool_call_id:** `turn-11:step:33:tool`
- **Regenerated:** no — Additional view of same identity; front generated first.
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-man-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/man-back.png`

**Prompt (verbatim):**

```
Same man as the first reference photo: short dark hair, gray t-shirt and gray shorts, barefoot. FULL BODY BACK VIEW, facing away from camera, head-to-toe. Photoreal Unreal MetaHuman 8k, sharp, not pixelated. Standing straight, arms slightly away from torso. Pure chroma-key green background (#00FF00), no floor, no shadow. Match identity of the front photo.
```

### 2.8 `mh-hq-teen-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-teen-back.png`
- **Msg index:** 1751
- **tool_call_id:** `turn-11:step:34:tool`
- **Regenerated:** no — Additional view of same identity; front generated first.
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-teen-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/teen-back.png`

**Prompt (verbatim):**

```
Same teenage boy as the first reference: dark curly hair, beige full-body athletic suit, barefoot. FULL BODY BACK VIEW, facing away from camera, head-to-toe. Photoreal Unreal MetaHuman 8k, sharp. Standing straight, arms slightly away from torso. Pure chroma-key green background (#00FF00), no floor, no shadow. Match identity of the front photo.
```

### 2.9 `mh-hq-child-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-child-back.png`
- **Msg index:** 1753
- **tool_call_id:** `turn-11:step:35:tool`
- **Regenerated:** no — Additional view of same identity; front generated first.
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-child-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/child-back.png`

**Prompt (verbatim):**

```
Same young child as the first reference: curly light-brown hair, beige turtleneck bodysuit, barefoot. FULL BODY BACK VIEW, facing away from camera, head-to-toe, child proportions. Photoreal Unreal MetaHuman 8k, sharp. Standing straight, arms slightly away from torso. Pure chroma-key green background (#00FF00), no floor, no shadow. Match identity of the front photo.
```

### 2.10 `mh-hq-elderly-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-elderly-back.png`
- **Msg index:** 1755
- **tool_call_id:** `turn-11:step:36:tool`
- **Regenerated:** no — Additional view of same identity; front generated first.
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-elderly-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/elderly-back.png`

**Prompt (verbatim):**

```
Same elderly man as the first reference: short white hair, beige long-sleeve thermal bodysuit, barefoot. FULL BODY BACK VIEW, facing away from camera, head-to-toe. Photoreal Unreal MetaHuman 8k, sharp. Standing straight, slightly older posture, arms slightly away from torso. Pure chroma-key green background (#00FF00), no floor, no shadow. Match identity of the front photo.
```

### 2.11 `mh-hq-woman-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-woman-left.png`
- **Msg index:** 1758
- **tool_call_id:** `turn-11:step:38:tool`
- **Regenerated:** no — Additional view of same identity; front generated first.
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-woman-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/woman-left.png`

**Prompt (verbatim):**

```
Same woman as the front reference: dark hair ponytail, gray tank and shorts, barefoot. FULL BODY LEFT PROFILE, subject facing the left side of the frame, camera sees her left side, head-to-toe. Photoreal Unreal MetaHuman 8k, sharp. Straight standing pose, arms slightly forward of the torso. Pure chroma-key green (#00FF00), no floor, no shadow. Match identity.
```

### 2.12 `mh-hq-woman-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-woman-right.png`
- **Msg index:** 1760
- **tool_call_id:** `turn-11:step:39:tool`
- **Regenerated:** no — Additional view of same identity; front generated first.
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-woman-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/woman-right.png`

**Prompt (verbatim):**

```
Same woman as the front reference: dark hair ponytail, gray tank and shorts, barefoot. FULL BODY RIGHT PROFILE, subject facing the right side of the frame, camera sees her right side, head-to-toe. Photoreal Unreal MetaHuman 8k, sharp. Straight standing pose. Pure chroma-key green (#00FF00), no floor, no shadow. Match identity.
```

### 2.13 `mh-hq-man-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-man-left.png`
- **Msg index:** 1762
- **tool_call_id:** `turn-11:step:40:tool`
- **Regenerated:** no — Additional view of same identity; front generated first.
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-man-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/man-left.png`

**Prompt (verbatim):**

```
Same man as the front reference: short dark hair, gray t-shirt and shorts, barefoot. FULL BODY LEFT PROFILE, subject facing left of frame, camera sees his left side, head-to-toe. Photoreal Unreal MetaHuman 8k, sharp. Pure chroma-key green (#00FF00), no floor. Match identity.
```

### 2.14 `mh-hq-man-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-man-right.png`
- **Msg index:** 1764
- **tool_call_id:** `turn-11:step:41:tool`
- **Regenerated:** no — Additional view of same identity; front generated first.
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-man-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/man-right.png`

**Prompt (verbatim):**

```
Same man as the front reference: short dark hair, gray t-shirt and shorts, barefoot. FULL BODY RIGHT PROFILE, subject facing right of frame, camera sees his right side, head-to-toe. Photoreal Unreal MetaHuman 8k, sharp. Pure chroma-key green (#00FF00), no floor. Match identity.
```

### 2.15 `mh-hq-teen-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-teen-left.png`
- **Msg index:** 1766
- **tool_call_id:** `turn-11:step:42:tool`
- **Regenerated:** no — Additional view of same identity; front generated first.
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-teen-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/teen-left.png`

**Prompt (verbatim):**

```
Same teenage boy as the front reference: curly dark hair, beige bodysuit, barefoot. FULL BODY LEFT PROFILE, facing left of frame, head-to-toe. Photoreal Unreal MetaHuman 8k, sharp. Pure chroma-key green (#00FF00), no floor. Match identity.
```

### 2.16 `mh-hq-teen-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-teen-right.png`
- **Msg index:** 1768
- **tool_call_id:** `turn-11:step:43:tool`
- **Regenerated:** no — Additional view of same identity; front generated first.
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-teen-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/teen-right.png`

**Prompt (verbatim):**

```
Same teenage boy as the front reference: curly dark hair, beige bodysuit, barefoot. FULL BODY RIGHT PROFILE, facing right of frame, head-to-toe. Photoreal Unreal MetaHuman 8k, sharp. Pure chroma-key green (#00FF00), no floor. Match identity.
```

### 2.17 `mh-hq-child-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-child-left.png`
- **Msg index:** 1770
- **tool_call_id:** `turn-11:step:44:tool`
- **Regenerated:** no — Additional view of same identity; front generated first.
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-child-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/child-left.png`

**Prompt (verbatim):**

```
Same young child as the front reference: curly light-brown hair, beige turtleneck bodysuit, barefoot. FULL BODY LEFT PROFILE, facing left of frame, child proportions, head-to-toe. Photoreal Unreal MetaHuman 8k, sharp. Pure chroma-key green (#00FF00), no floor. Match identity.
```

### 2.18 `mh-hq-child-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-child-right.png`
- **Msg index:** 1772
- **tool_call_id:** `turn-11:step:45:tool`
- **Regenerated:** no — Additional view of same identity; front generated first.
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-child-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/child-right.png`

**Prompt (verbatim):**

```
Same young child as the front reference: curly light-brown hair, beige turtleneck bodysuit, barefoot. FULL BODY RIGHT PROFILE, facing right of frame, child proportions, head-to-toe. Photoreal Unreal MetaHuman 8k, sharp. Pure chroma-key green (#00FF00), no floor. Match identity.
```

### 2.19 `mh-hq-elderly-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-elderly-left.png`
- **Msg index:** 1774
- **tool_call_id:** `turn-11:step:46:tool`
- **Regenerated:** no — Additional view of same identity; front generated first.
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-elderly-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/elderly-left.png`

**Prompt (verbatim):**

```
Same elderly man as the front reference: white hair, beige thermal bodysuit, barefoot. FULL BODY LEFT PROFILE, facing left of frame, head-to-toe, older posture with a slight belly. Photoreal Unreal MetaHuman 8k, sharp. Pure chroma-key green (#00FF00), no floor. Match identity.
```

### 2.20 `mh-hq-elderly-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-hq-elderly-right.png`
- **Msg index:** 1776
- **tool_call_id:** `turn-11:step:47:tool`
- **Regenerated:** no — Additional view of same identity; front generated first.
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-elderly-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/frames/elderly-right.png`

**Prompt (verbatim):**

```
Same elderly man as the front reference: white hair, beige thermal bodysuit, barefoot. FULL BODY RIGHT PROFILE, facing right of frame, head-to-toe, older posture with a slight belly. Photoreal Unreal MetaHuman 8k, sharp. Pure chroma-key green (#00FF00), no floor. Match identity.
```

### 2.21 `mh-prod-man-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-man-front.png`
- **Msg index:** 1890
- **tool_call_id:** `turn-11:step:114:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-man-front.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the exact same adult man as the reference: same face, hair, body, pose, and light gray heather t-shirt and shorts. Photorealistic MetaHuman quality. Visible skin pores, fabric knit, individual hair strands, sharp eyes and fingers, natural subsurface skin. Neutral even studio lighting, no harsh shadows. Full body head to toes, standing straight, arms relaxed at sides, barefoot, feet planted. Solid chroma-key green background (#00FF00) with no floor, no shadow, no backdrop texture. No pixelation, no compression artifacts, no illustration, no plastic CGI, no watermarks, no text.
```

### 2.22 `mh-prod-woman-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-woman-front.png`
- **Msg index:** 1892
- **tool_call_id:** `turn-11:step:115:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-woman-front.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the exact same adult woman as the reference: same face, hair, body, pose, and light gray tank top and shorts. Photorealistic MetaHuman quality. Visible skin pores, fabric knit, individual hair strands, sharp eyes and fingers, natural subsurface skin. Neutral even studio lighting. Full body head to toes, standing straight, arms relaxed at sides, barefoot. Solid chroma-key green background (#00FF00) with no floor, no shadow. No pixelation, no compression artifacts, no illustration, no plastic CGI, no watermarks, no text.
```

### 2.23 `mh-prod-teen-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-teen-front.png`
- **Msg index:** 1894
- **tool_call_id:** `turn-11:step:116:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-teen-front.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the exact same teenage person as the reference: same face, hair, body, pose, and beige athletic bodysuit. Photorealistic MetaHuman quality. Visible skin texture, fabric weave, individual hair strands, sharp eyes and fingers. Neutral even studio lighting. Full body head to toes, standing straight, arms relaxed at sides, barefoot. Solid chroma-key green background (#00FF00) with no floor, no shadow. No pixelation, no compression artifacts, no illustration, no plastic CGI, no watermarks, no text.
```

### 2.24 `mh-prod-child-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-child-front.png`
- **Msg index:** 1896
- **tool_call_id:** `turn-11:step:117:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-child-front.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the exact same young child as the reference: same face, hair, body, pose, and beige turtleneck bodysuit. Photorealistic quality, modest full-body clinical figure. Visible fabric weave, natural skin, sharp fingers and toes. Neutral even studio lighting. Full body head to toes, standing straight, arms relaxed at sides, barefoot. Solid chroma-key green background (#00FF00) with no floor, no shadow. No pixelation, no compression artifacts, no illustration, no watermarks, no text.
```

### 2.25 `mh-prod-elderly-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-elderly-front.png`
- **Msg index:** 1898
- **tool_call_id:** `turn-11:step:118:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-hq-elderly-front.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the exact same elderly adult as the reference: same face, hair, body, pose, and beige long-sleeve thermal shirt and pants. Photorealistic MetaHuman quality. Visible skin texture and age detail, fabric knit, individual hair strands, sharp eyes and fingers. Neutral even studio lighting. Full body head to toes, standing straight, arms relaxed at sides, barefoot. Solid chroma-key green background (#00FF00) with no floor, no shadow. No pixelation, no compression artifacts, no illustration, no plastic CGI, no watermarks, no text.
```

### 2.26 `mh-prod-man-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-man-back.png`
- **Msg index:** 1926
- **tool_call_id:** `turn-11:step:134:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-prod-man-front.png`
  - `/opt/cursor/artifacts/assets/mh-hq-man-back.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the same adult man as the references, posterior / back view. Same person, same light gray heather t-shirt and shorts. Standing straight, back of head facing camera, arms relaxed at sides, barefoot, feet planted. Photorealistic MetaHuman quality, sharp fabric knit, skin texture, hair. Solid chroma-key green background (#00FF00), no floor, no shadow. No pixelation, no text, no watermarks.
```

### 2.27 `mh-prod-man-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-man-left.png`
- **Msg index:** 1928
- **tool_call_id:** `turn-11:step:135:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-prod-man-front.png`
  - `/opt/cursor/artifacts/assets/mh-hq-man-left.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the same adult man as the references, anatomical left profile (camera sees his left side). Same person, same light gray heather t-shirt and shorts. Standing straight in true 90-degree side view, arms relaxed at sides, barefoot. Photorealistic MetaHuman quality. Solid chroma-key green background (#00FF00), no floor, no shadow. No pixelation, no text, no watermarks.
```

### 2.28 `mh-prod-man-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-man-right.png`
- **Msg index:** 1930
- **tool_call_id:** `turn-11:step:136:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-prod-man-front.png`
  - `/opt/cursor/artifacts/assets/mh-hq-man-right.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the same adult man as the references, anatomical right profile (camera sees his right side). Same person, same light gray heather t-shirt and shorts. Standing straight in true 90-degree side view, arms relaxed at sides, barefoot. Photorealistic MetaHuman quality. Solid chroma-key green background (#00FF00), no floor, no shadow. No pixelation, no text, no watermarks.
```

### 2.29 `mh-prod-woman-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-woman-back.png`
- **Msg index:** 1932
- **tool_call_id:** `turn-11:step:137:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-prod-woman-front.png`
  - `/opt/cursor/artifacts/assets/mh-hq-woman-back.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the same adult woman as the references, posterior / back view. Same person, same light gray ribbed tank top and shorts. Standing straight, back of head facing camera, arms relaxed at sides, barefoot. Photorealistic MetaHuman quality. Solid chroma-key green background (#00FF00), no floor, no shadow. No pixelation, no text, no watermarks.
```

### 2.30 `mh-prod-woman-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-woman-left.png`
- **Msg index:** 1934
- **tool_call_id:** `turn-11:step:138:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-prod-woman-front.png`
  - `/opt/cursor/artifacts/assets/mh-hq-woman-left.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the same adult woman as the references, anatomical left profile (camera sees her left side). Same person, same light gray ribbed tank top and shorts. Standing straight in true 90-degree side view, arms relaxed at sides, barefoot. Photorealistic MetaHuman quality. Solid chroma-key green background (#00FF00), no floor, no shadow. No pixelation, no text, no watermarks.
```

### 2.31 `mh-prod-woman-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-woman-right.png`
- **Msg index:** 1936
- **tool_call_id:** `turn-11:step:139:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-prod-woman-front.png`
  - `/opt/cursor/artifacts/assets/mh-hq-woman-right.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the same adult woman as the references, anatomical right profile (camera sees her right side). Same person, same light gray ribbed tank top and shorts. Standing straight in true 90-degree side view, arms relaxed at sides, barefoot. Photorealistic MetaHuman quality. Solid chroma-key green background (#00FF00), no floor, no shadow. No pixelation, no text, no watermarks.
```

### 2.32 `mh-prod-teen-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-teen-back.png`
- **Msg index:** 1943
- **tool_call_id:** `turn-11:step:143:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-prod-teen-front.png`
  - `/opt/cursor/artifacts/assets/mh-hq-teen-back.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the same teenager as the references, posterior / back view. Same person, curly brown hair, same beige athletic bodysuit. Standing straight, back of head facing camera, arms relaxed at sides, barefoot. Photorealistic quality. Solid chroma-key green background (#00FF00), no floor, no shadow. No pixelation, no text, no watermarks.
```

### 2.33 `mh-prod-teen-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-teen-left.png`
- **Msg index:** 1945
- **tool_call_id:** `turn-11:step:144:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-prod-teen-front.png`
  - `/opt/cursor/artifacts/assets/mh-hq-teen-left.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the same teenager as the references, anatomical left profile (camera sees their left side). Same person, curly brown hair, same beige athletic bodysuit. Standing straight in true 90-degree side view, arms relaxed at sides, barefoot. Photorealistic quality. Solid chroma-key green background (#00FF00), no floor, no shadow. No pixelation, no text, no watermarks.
```

### 2.34 `mh-prod-child-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-child-back.png`
- **Msg index:** 1949
- **tool_call_id:** `turn-11:step:146:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-prod-child-front.png`
  - `/opt/cursor/artifacts/assets/mh-hq-child-back.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the same young child as the references, posterior / back view. Same child, curly brown hair, same beige turtleneck bodysuit. Standing straight, back of head facing camera, arms relaxed at sides, barefoot. Modest clinical figure. Solid chroma-key green background (#00FF00), no floor, no shadow. No pixelation, no text, no watermarks.
```

### 2.35 `mh-prod-child-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-child-left.png`
- **Msg index:** 1951
- **tool_call_id:** `turn-11:step:147:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-prod-child-front.png`
  - `/opt/cursor/artifacts/assets/mh-hq-child-left.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the same young child as the references, anatomical left profile (camera sees their left side). Same child, curly brown hair, same beige turtleneck bodysuit. Standing straight in true 90-degree side view, arms relaxed at sides, barefoot. Modest clinical figure. Solid chroma-key green background (#00FF00), no floor, no shadow. No pixelation, no text, no watermarks.
```

### 2.36 `mh-prod-child-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-child-right.png`
- **Msg index:** 1953
- **tool_call_id:** `turn-11:step:148:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-prod-child-front.png`
  - `/opt/cursor/artifacts/assets/mh-hq-child-right.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the same young child as the references, anatomical right profile (camera sees their right side). Same child, curly brown hair, same beige turtleneck bodysuit. Standing straight in true 90-degree side view, arms relaxed at sides, barefoot. Modest clinical figure. Solid chroma-key green background (#00FF00), no floor, no shadow. No pixelation, no text, no watermarks.
```

### 2.37 `mh-prod-teen-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-teen-right.png`
- **Msg index:** 1956
- **tool_call_id:** `turn-11:step:150:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-prod-teen-front.png`
  - `/opt/cursor/artifacts/assets/mh-hq-teen-right.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the same teenager as the references, anatomical right profile (camera sees their right side). Same person, curly brown hair, beige athletic bodysuit covering arms and legs. Standing straight in true 90-degree side view, arms relaxed at sides, barefoot. Photorealistic quality. Solid chroma-key green background (#00FF00), no floor, no shadow. No pixelation, no text, no watermarks.
```

### 2.38 `mh-prod-elderly-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-elderly-back.png`
- **Msg index:** 1958
- **tool_call_id:** `turn-11:step:151:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-prod-elderly-front.png`
  - `/opt/cursor/artifacts/assets/mh-hq-elderly-back.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the same elderly man as the references, posterior / back view. Same person, short silver hair, same beige long-sleeve thermal shirt and matching thermal pants. Standing straight, back of head facing camera, arms relaxed at sides, barefoot. Photorealistic MetaHuman quality. Solid chroma-key green background (#00FF00), no floor, no shadow. No pixelation, no text, no watermarks.
```

### 2.39 `mh-prod-elderly-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-elderly-left.png`
- **Msg index:** 1960
- **tool_call_id:** `turn-11:step:152:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-prod-elderly-front.png`
  - `/opt/cursor/artifacts/assets/mh-hq-elderly-left.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the same elderly man as the references, anatomical left profile (camera sees his left side). Same person, short silver hair, same beige long-sleeve thermal shirt and matching thermal pants. Standing straight in true 90-degree side view, arms relaxed at sides, barefoot. Photorealistic MetaHuman quality. Solid chroma-key green background (#00FF00), no floor, no shadow. No pixelation, no text, no watermarks.
```

### 2.40 `mh-prod-elderly-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-prod-elderly-right.png`
- **Msg index:** 1962
- **tool_call_id:** `turn-11:step:153:tool`
- **Regenerated:** yes — Sharpened remake of corresponding mh-hq-* identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-prod-elderly-front.png`
  - `/opt/cursor/artifacts/assets/mh-hq-elderly-right.png`

**Prompt (verbatim):**

```
Ultra-sharp 8K studio photograph of the same elderly man as the references, anatomical right profile (camera sees his right side). Same person, short silver hair, same beige long-sleeve thermal shirt and matching thermal pants. Standing straight in true 90-degree side view, arms relaxed at sides, barefoot. Photorealistic MetaHuman quality. Solid chroma-key green background (#00FF00), no floor, no shadow. No pixelation, no text, no watermarks.
```

### 2.41 `mh-tee-teen-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-teen-front.png`
- **Msg index:** 2351
- **tool_call_id:** `turn-15:step:10:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/teen-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/man-front.png`

**Prompt (verbatim):**

```
Keep the exact same teenage person as the first reference: same face, curly brown hair, age, body, and pose. Change ONLY the clothing: put him in a light gray heather crew-neck t-shirt and matching light gray heather athletic shorts, same style as the adult man in the second reference. Bare arms and bare legs. Barefoot. No beige bodysuit, no onesie, no thermal, no skin-colored clothing. Photorealistic studio photograph. Standing straight, arms relaxed at sides, full body head to toes. Solid chroma-key green background (#00FF00), no floor, no shadow. No text, no watermarks.
```

### 2.42 `mh-tee-child-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-child-front.png`
- **Msg index:** 2353
- **tool_call_id:** `turn-15:step:11:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/child-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/man-front.png`

**Prompt (verbatim):**

```
Keep the exact same young child as the first reference: same face, curly brown hair, age, body, and pose. Change ONLY the clothing: put the child in a modest light gray heather crew-neck t-shirt and matching light gray heather athletic shorts, same style as the adult man in the second reference. Bare arms and bare legs. Barefoot. No beige bodysuit, no onesie, no turtleneck, no skin-colored clothing. Photorealistic studio photograph of a clothed child. Standing straight, arms relaxed at sides, full body head to toes. Solid chroma-key green background (#00FF00), no floor, no shadow. No text, no watermarks.
```

### 2.43 `mh-tee-elderly-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-elderly-front.png`
- **Msg index:** 2355
- **tool_call_id:** `turn-15:step:12:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/elderly-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/man-front.png`

**Prompt (verbatim):**

```
Keep the exact same elderly man as the first reference: same face, silver hair, age, body, and pose. Change ONLY the clothing: put him in a light gray heather crew-neck t-shirt and matching light gray heather athletic shorts, same style as the adult man in the second reference. Bare arms and bare legs. Barefoot. No beige thermal onesie, no long-sleeve bodysuit, no skin-colored clothing. Photorealistic studio photograph. Standing straight, arms relaxed at sides, full body head to toes. Solid chroma-key green background (#00FF00), no floor, no shadow. No text, no watermarks.
```

### 2.44 `mh-tee-teen-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-teen-back.png`
- **Msg index:** 2368
- **tool_call_id:** `turn-15:step:19:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-teen-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/man-back.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/teen-back.png`

**Prompt (verbatim):**

```
Same teenage person as the new front reference: same face, curly brown hair, light gray heather crew-neck t-shirt and matching light gray athletic shorts. Posterior back view, standing straight, back of head facing camera, arms relaxed at sides, barefoot, bare arms and legs. Match the back-view pose of the third reference but keep the gray t-shirt and shorts — no beige onesie. Photorealistic. Solid chroma-key green background (#00FF00), no floor, no shadow. No text.
```

### 2.45 `mh-tee-teen-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-teen-left.png`
- **Msg index:** 2370
- **tool_call_id:** `turn-15:step:20:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-teen-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/man-left.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/teen-left.png`

**Prompt (verbatim):**

```
Same teenage person as the new front reference: curly brown hair, light gray heather crew-neck t-shirt and matching light gray athletic shorts. Anatomical left profile (camera sees his left side), true 90-degree side view, standing straight, arms relaxed at sides, barefoot. No beige onesie. Photorealistic. Solid chroma-key green background (#00FF00), no floor, no shadow. No text.
```

### 2.46 `mh-tee-teen-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-teen-right.png`
- **Msg index:** 2372
- **tool_call_id:** `turn-15:step:21:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-teen-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/man-right.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/teen-right.png`

**Prompt (verbatim):**

```
Same teenage person as the new front reference: curly brown hair, light gray heather crew-neck t-shirt and matching light gray athletic shorts. Anatomical right profile (camera sees his right side), true 90-degree side view, standing straight, arms relaxed at sides, barefoot. No beige onesie. Photorealistic. Solid chroma-key green background (#00FF00), no floor, no shadow. No text.
```

### 2.47 `mh-tee-child-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-child-back.png`
- **Msg index:** 2374
- **tool_call_id:** `turn-15:step:22:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-child-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/man-back.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/child-back.png`

**Prompt (verbatim):**

```
Same young child as the new front reference: curly brown hair, modest light gray heather crew-neck t-shirt and matching light gray athletic shorts. Posterior back view, standing straight, back of head facing camera, arms relaxed at sides, barefoot, bare arms and legs. No beige onesie. Photorealistic clothed child. Solid chroma-key green background (#00FF00), no floor, no shadow. No text.
```

### 2.48 `mh-tee-child-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-child-left.png`
- **Msg index:** 2376
- **tool_call_id:** `turn-15:step:23:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-child-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/man-left.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/child-left.png`

**Prompt (verbatim):**

```
Same young child as the new front reference: curly brown hair, modest light gray heather crew-neck t-shirt and matching light gray athletic shorts. Anatomical left profile (camera sees their left side), true 90-degree side view, standing straight, arms relaxed at sides, barefoot. No beige onesie. Photorealistic clothed child. Solid chroma-key green background (#00FF00), no floor, no shadow. No text.
```

### 2.49 `mh-tee-child-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-child-right.png`
- **Msg index:** 2378
- **tool_call_id:** `turn-15:step:24:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-child-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/man-right.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/child-right.png`

**Prompt (verbatim):**

```
Same young child as the new front reference: curly brown hair, modest light gray heather crew-neck t-shirt and matching light gray athletic shorts. Anatomical right profile (camera sees their right side), true 90-degree side view, standing straight, arms relaxed at sides, barefoot. No beige onesie. Photorealistic clothed child. Solid chroma-key green background (#00FF00), no floor, no shadow. No text.
```

### 2.50 `mh-tee-elderly-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-elderly-back.png`
- **Msg index:** 2381
- **tool_call_id:** `turn-15:step:26:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-elderly-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/man-back.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/elderly-back.png`

**Prompt (verbatim):**

```
Same elderly man as the new front reference: silver hair, light gray heather crew-neck t-shirt and matching light gray athletic shorts. Posterior back view, standing straight, back of head facing camera, arms relaxed at sides, barefoot, bare arms and legs. No beige thermal onesie. Photorealistic. Solid chroma-key green background (#00FF00), no floor, no shadow. No text.
```

### 2.51 `mh-tee-elderly-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-elderly-left.png`
- **Msg index:** 2383
- **tool_call_id:** `turn-15:step:27:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-elderly-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/man-left.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/elderly-left.png`

**Prompt (verbatim):**

```
Same elderly man as the new front reference: silver hair, light gray heather crew-neck t-shirt and matching light gray athletic shorts. Anatomical left profile (camera sees his left side), true 90-degree side view, standing straight, arms relaxed at sides, barefoot. No beige onesie. Photorealistic. Solid chroma-key green background (#00FF00), no floor, no shadow. No text.
```

### 2.52 `mh-tee-elderly-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-elderly-right.png`
- **Msg index:** 2385
- **tool_call_id:** `turn-15:step:28:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-elderly-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/man-right.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/elderly-right.png`

**Prompt (verbatim):**

```
Same elderly man as the new front reference: silver hair, light gray heather crew-neck t-shirt and matching light gray athletic shorts. Anatomical right profile (camera sees his right side), true 90-degree side view, standing straight, arms relaxed at sides, barefoot. No beige onesie. Photorealistic. Solid chroma-key green background (#00FF00), no floor, no shadow. No text.
```

### 2.53 `mh-tee-teen-female-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-teen-female-front.png`
- **Msg index:** 2509
- **tool_call_id:** `turn-22:step:17:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/woman-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/teen-front.png`

**Prompt (verbatim):**

```
Photorealistic teenage girl, about 16 years old, full body head to toes, standing straight facing camera, arms relaxed at sides, barefoot. Same light gray ribbed tank top and matching light gray shorts as the adult woman reference — not a beige onesie. Natural teenage proportions, not an adult. Curly or wavy brown hair. Neutral even studio lighting. Solid chroma-key green background (#00FF00), no floor, no shadow. No text, no watermarks.
```

### 2.54 `mh-tee-child-female-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-child-female-front.png`
- **Msg index:** 2511
- **tool_call_id:** `turn-22:step:18:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/child-front.png`

**Prompt (verbatim):**

```
Photorealistic young girl child, about 7 years old, full body head to toes, standing straight facing camera, arms relaxed at sides, barefoot. Modest light gray crew-neck t-shirt and matching light gray athletic shorts, same clothing style as the boy-child reference but this is a girl. Not a beige onesie, not a tank top. Natural child proportions. Wavy brown hair. Neutral studio lighting. Solid chroma-key green background (#00FF00), no floor, no shadow. No text, no watermarks.
```

### 2.55 `mh-tee-senior-female-front.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-senior-female-front.png`
- **Msg index:** 2513
- **tool_call_id:** `turn-22:step:19:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/woman-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/elderly-front.png`

**Prompt (verbatim):**

```
Photorealistic elderly woman, about 75 years old, full body head to toes, standing straight facing camera, arms relaxed at sides, barefoot. Same light gray ribbed tank top and matching light gray shorts as the adult woman reference — not a beige thermal onesie. Silver-gray hair, natural age. Neutral studio lighting. Solid chroma-key green background (#00FF00), no floor, no shadow. No text, no watermarks.
```

### 2.56 `mh-tee-teen-female-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-teen-female-back.png`
- **Msg index:** 2522
- **tool_call_id:** `turn-22:step:24:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-teen-female-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/woman-back.png`

**Prompt (verbatim):**

```
Same teenage girl as the front reference: same face, hair, gray ribbed tank top and gray shorts. Posterior back view, standing straight, back of head facing camera, arms at sides, barefoot. Photorealistic. Solid chroma-key green (#00FF00), no floor, no shadow. No text.
```

### 2.57 `mh-tee-teen-female-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-teen-female-left.png`
- **Msg index:** 2524
- **tool_call_id:** `turn-22:step:25:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-teen-female-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/woman-left.png`

**Prompt (verbatim):**

```
Same teenage girl as the front reference: gray ribbed tank top and gray shorts. Anatomical left profile, true 90-degree side view, standing straight, arms at sides, barefoot. Photorealistic. Solid chroma-key green (#00FF00), no floor, no shadow. No text.
```

### 2.58 `mh-tee-teen-female-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-teen-female-right.png`
- **Msg index:** 2526
- **tool_call_id:** `turn-22:step:26:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-teen-female-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/woman-right.png`

**Prompt (verbatim):**

```
Same teenage girl as the front reference: gray ribbed tank top and gray shorts. Anatomical right profile, true 90-degree side view, standing straight, arms at sides, barefoot. Photorealistic. Solid chroma-key green (#00FF00), no floor, no shadow. No text.
```

### 2.59 `mh-tee-child-female-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-child-female-back.png`
- **Msg index:** 2528
- **tool_call_id:** `turn-22:step:27:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-child-female-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/child-back.png`

**Prompt (verbatim):**

```
Same young girl as the front reference: modest gray t-shirt and gray shorts. Posterior back view, standing straight, back of head facing camera, arms at sides, barefoot. Photorealistic clothed child. Solid chroma-key green (#00FF00), no floor, no shadow. No text.
```

### 2.60 `mh-tee-child-female-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-child-female-left.png`
- **Msg index:** 2530
- **tool_call_id:** `turn-22:step:28:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-child-female-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/child-left.png`

**Prompt (verbatim):**

```
Same young girl as the front reference: modest gray t-shirt and gray shorts. Anatomical left profile, true 90-degree side view, standing straight, arms at sides, barefoot. Photorealistic clothed child. Solid chroma-key green (#00FF00), no floor, no shadow. No text.
```

### 2.61 `mh-tee-child-female-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-child-female-right.png`
- **Msg index:** 2532
- **tool_call_id:** `turn-22:step:29:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-child-female-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/child-right.png`

**Prompt (verbatim):**

```
Same young girl as the front reference: modest gray t-shirt and gray shorts. Anatomical right profile, true 90-degree side view, standing straight, arms at sides, barefoot. Photorealistic clothed child. Solid chroma-key green (#00FF00), no floor, no shadow. No text.
```

### 2.62 `mh-tee-senior-female-back.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-senior-female-back.png`
- **Msg index:** 2535
- **tool_call_id:** `turn-22:step:31:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-senior-female-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/elderly-back.png`

**Prompt (verbatim):**

```
Same elderly woman as the front reference: silver hair, light gray crew-neck t-shirt and gray athletic shorts. Posterior back view, standing straight, back of head facing camera, arms at sides, barefoot. Not a beige onesie. Photorealistic. Solid chroma-key green (#00FF00), no floor, no shadow. No text.
```

### 2.63 `mh-tee-senior-female-left.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-senior-female-left.png`
- **Msg index:** 2537
- **tool_call_id:** `turn-22:step:32:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-senior-female-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/elderly-left.png`

**Prompt (verbatim):**

```
Same elderly woman as the front reference: silver hair, light gray crew-neck t-shirt and gray athletic shorts. Anatomical left profile, true 90-degree side view, standing straight, arms at sides, barefoot. Photorealistic. Solid chroma-key green (#00FF00), no floor, no shadow. No text.
```

### 2.64 `mh-tee-senior-female-right.png`

- **Tool:** `GenerateImage`
- **Output path:** `/opt/cursor/artifacts/assets/mh-tee-senior-female-right.png`
- **Msg index:** 2539
- **tool_call_id:** `turn-22:step:33:tool`
- **Regenerated:** yes — Clothing remake (tee/shorts) of prior hq/prod identity (new filename).
- **Reference image paths:**
  - `/opt/cursor/artifacts/assets/mh-tee-senior-female-front.png`
  - `/workspace/docs/visual-targets/metahuman-sprites/hq-raw/elderly-right.png`

**Prompt (verbatim):**

```
Same elderly woman as the front reference: silver hair, light gray crew-neck t-shirt and gray athletic shorts. Anatomical right profile, true 90-degree side view, standing straight, arms at sides, barefoot. Photorealistic. Solid chroma-key green (#00FF00), no floor, no shadow. No text.
```

### Failed calls (no prompt recovered)

- `turn-11:step:145:tool` — HTTP 400; `tool_args` absent in transcript.
