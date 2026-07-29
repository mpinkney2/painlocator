# JSON Session Schema

PainLocator exports and imports clinical sessions as JSON files. The canonical implementation and JSDoc definitions live in:

**`src/engine/reporting/session-schema.js`**

Import/export handlers: **`src/engine/reporting/session-io.js`**

## Versioning

| Field | v0.1.0 value |
|-------|----------------|
| `schemaVersion` | `"1.0.0"` |
| `applicationVersion` | `"5.3.0"` (PainLocator app) |
| `engineVersion` | `"1.0.0"` (CAE) |

Major schema version (`1`) must match for import. Future versions will require migration utilities (planned — see [ROADMAP.md](./ROADMAP.md)).

## Top-Level Object

```json
{
  "schemaVersion": "1.0.0",
  "applicationVersion": "5.3.0",
  "engineVersion": "1.0.0",
  "created": "2026-07-07T12:00:00.000Z",
  "modified": "2026-07-07T18:30:00.000Z",
  "patient": { },
  "workflow": { },
  "entries": [ ],
  "regions": [ ],
  "timeline": [ ],
  "notes": { },
  "theme": "light"
}
```

## Fields

### `patient`

| Field | Type | Description |
|-------|------|-------------|
| `model` | string | `adult-male`, `adult-female`, `child`, `teen`, `senior` |
| `view` | string | `front`, `back`, `left`, `right` |
| `label` | string | Human-readable model name (optional) |

### `workflow`

| Field | Type | Description |
|-------|------|-------------|
| `mode` | string | `capture`, `review`, or `clinical` |
| `reviewEditMode` | boolean | Whether Review mode was in edit state at export |

### `entries`

Array of saved `PainEntry` objects for the current patient model. **Draft entries are excluded.**

Entry shape (from `createPainEntry` in `pain-models.js`):

| Field | Type |
|-------|------|
| `id` | string |
| `title` | string \| null |
| `patientModel` | string |
| `createdAt`, `updatedAt` | ISO 8601 |
| `intensity` | number (0–10) |
| `quality` | string[] |
| `triggers` | string[] |
| `easesAfter` | string[] |
| `duration` | string |
| `whenOccurring` | string |
| `note` | string |
| `regions` | PainRegion[] |

### `regions`

Flattened index of all regions across entries for tooling and reports.

| Field | Type |
|-------|------|
| `id` | string |
| `entryId` | string |
| `entryNumber` | number |
| `label` | string (e.g. `"1A"`) |
| `view` | string |
| `patientLabel`, `physicianLabel` | string \| null |
| `anatomyLayer` | string |
| `shape` | string |
| `anchors` | `{ x, y }[]` (4 decimal places) |
| `radius` | number |
| `structureLabel` | string \| null |

### `timeline`

Chronological summary points for charting and reports.

| Field | Type |
|-------|------|
| `entryId` | string |
| `entryNumber` | number |
| `createdAt` | ISO 8601 |
| `intensity` | number |
| `regionCount` | number |

### `notes`

| Field | Type | Description |
|-------|------|-------------|
| `aggregate` | string | Combined text from all entry notes |

### `theme`

`"light"` or `"dark"` — restored on import via `applyTheme()`.

## Export

**UI:** Clinical Analysis → Report / Export → **Export Session (JSON)**  
**Header:** Export modal → Export Session (JSON)

Function: `exportSessionJson()` → downloads `painlocator-session-YYYY-MM-DD.json`

Builder: `buildSessionExport(state, entryStore)`

## Import

**UI:** **Import Session** (header or sidebar)

Function: `importSessionFromFile(file)`

Validation: `validateSessionImport(data)` checks:

- Object root
- `schemaVersion` present
- Major version `1`
- `entries` is an array

On success:

1. Replaces `entryStore.entries` (rehydrated via `createPainEntry`)
2. Restores patient model radio and body view
3. Applies workflow mode and theme
4. Refreshes engine and UI

**Limitation (v0.1.0):** Import replaces the current session for the model; it does not merge partial sessions.

## Example Snippet

```json
{
  "schemaVersion": "1.0.0",
  "applicationVersion": "5.3.0",
  "engineVersion": "1.0.0",
  "created": "2026-07-01T10:00:00.000Z",
  "modified": "2026-07-07T15:00:00.000Z",
  "patient": {
    "model": "adult-male",
    "view": "front",
    "label": "Adult Male"
  },
  "workflow": {
    "mode": "clinical",
    "reviewEditMode": false
  },
  "entries": [
    {
      "id": "pe_abc123",
      "patientModel": "adult-male",
      "intensity": 6,
      "quality": ["Sharp"],
      "triggers": ["Walking"],
      "easesAfter": [],
      "duration": "Minutes",
      "whenOccurring": "Morning",
      "note": "Pain after stairs.",
      "regions": [
        {
          "id": "pr_xyz",
          "entryId": "pe_abc123",
          "view": "front",
          "shape": "circle",
          "anchors": [{ "x": 0.4521, "y": 0.6234 }],
          "patientLabel": "Left knee"
        }
      ],
      "createdAt": "2026-07-01T10:00:00.000Z",
      "updatedAt": "2026-07-01T10:05:00.000Z"
    }
  ],
  "regions": [],
  "timeline": [],
  "notes": { "aggregate": "Entry #1: Pain after stairs." },
  "theme": "light"
}
```

## Local Storage (Separate from Session Export)

Runtime persistence uses a versioned envelope under `painlocator_pain_entries` (or `painlocator_demo_entries` in Demo Mode):

```json
{
  "schemaVersion": "1.1.0",
  "entries": [],
  "draftEntry": null,
  "activeEntryId": null,
  "selectedRegionIds": [],
  "activeTool": "circle"
}
```

| Local schema | Notes |
|--------------|-------|
| `1.0.0` (implicit) | Pre-versioned envelopes without `schemaVersion` |
| `1.1.0` | Adds `schemaVersion`; draft lifecycle no longer auto-creates blank Entry #1 on load |

Demo Mode uses a separate key and never merges with real user data.

Session export is a **portable snapshot** for backup and transfer — not identical to the localStorage envelope.

## Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [REPORT_SPEC.md](./REPORT_SPEC.md)
- [CLINICAL_ANATOMY_ENGINE.md](./CLINICAL_ANATOMY_ENGINE.md)
- [ROADMAP.md](./ROADMAP.md)
