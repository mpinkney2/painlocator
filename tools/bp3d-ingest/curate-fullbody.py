#!/usr/bin/env python3
"""
Curate a full-body BP3D musculoskeletal presentation set (1:1 + merged multi-element).

Writes:
  data/bodyparts3d/subset/fullbody/catalog.json
  data/bodyparts3d/subset/fullbody/packs/<packId>/source-manifest.json
  extracts OBJs into cache/subset/fullbody/<packId>/obj/ with sha256 pins

Does NOT commit the zip or OBJ cache — only manifests + checksums after ingest.
"""
from __future__ import annotations

import hashlib
import json
import re
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "bodyparts3d" / "cache"
ZIP_PATH = CACHE / "isa_BP3D_4.0_obj_99.zip"
PARTS = CACHE / "isa_parts_list_e.txt"
ELEMENTS = CACHE / "isa_element_parts.txt"
OUT = ROOT / "data" / "bodyparts3d" / "subset" / "fullbody"
OBJ_CACHE = CACHE / "subset" / "fullbody"

ARCHIVE_PIN = "40665852c49f218326590e204db91064a1ecfc3c6f8cbd7bbbcaac62c7cd409e"

EXCLUDE_SUB = [
    "artery", "vein", "nerve", "lymph", "plexus", "vessel", "capillary",
    "branch of", "tributary", "anastomosis", "duct", "gland",
    "peritoneum", "pleura", "pericardium", "omentum", "mesentery",
    "bronchus", "lung", "heart", "liver", "kidney", "spleen", "pancreas",
    "stomach", "intestine", "colon", "bladder", "uterus", "ovary", "testis",
    "prostate", "urethra", "ureter", "esophagus", "trachea", "thyroid",
    "adrenal", "gallbladder", "appendix", "meninges", "dura", "arachnoid",
    "pia", "ventricle of brain", "thalamus", "cortex of", "gyrus", "sulcus",
    "nucleus ", "tract ", "fasciculus", "commissure", "retina", "cornea",
    "sclera", "lens of", "iris", "choroid", "conjunctiva", "cochlea",
    "labyrinth", "tympanic", "hair", "nail", "tooth", "enamel", "pulp",
    "skin of", "fascia of",
]

MUSCLE_HINT = [
    "muscle", "deltoid", "biceps", "triceps", "pectoralis", "rectus", "gluteus",
    "vastus", "gastrocnemius", "soleus", "tibialis", "trapezius", "latissimus",
    "serratus", "oblique", "iliopsoas", "sartorius", "gracilis", "adductor",
    "supraspinatus", "infraspinatus", "subscapularis", "teres ", "brachialis",
    "brachioradialis", "flexor", "extensor", "sternocleidomastoid", "masseter",
    "temporalis", "orbicularis", "zygomaticus", "buccinator", "platysma",
    "scalene", "rhomboid", "levator scapulae", "splenius", "erector spinae",
    "multifidus", "diaphragm", "intercostal", "transversus", "piriformis",
    "obturator", "gemellus", "popliteus", "plantaris", "fibularis", "peroneus",
    "semitendinosus", "semimembranosus", "iliacus", "psoas", "coracobrachialis",
    "anconeus", "supinator", "pronator", "lumbrical", "interosseous",
    "iliocostalis", "longissimus", "spinalis", "semispinalis", "rotatores",
    "subclavius", "omohyoid", "sternohyoid", "sternothyroid", "thyrohyoid",
    "mylohyoid", "digastric", "stylohyoid", "geniohyoid", "genioglossus",
    "hyoglossus", "styloglossus", "tensor", "levator ani", "coccygeus",
    "pyramidalis", "quadratus", "iliocostalis", "splenius",
]

BONE_HINT = [
    "humerus", "scapula", "clavicle", "radius", "ulna", "femur", "tibia",
    "fibula", "patella", "ilium", "ischium", "pubis", "sacrum", "coccyx",
    "sternum", "rib", "vertebra", "atlas", "axis", "mandible", "maxilla",
    "frontal bone", "parietal bone", "occipital bone", "temporal bone",
    "sphenoid", "ethmoid", "nasal bone", "zygomatic bone", "lacrimal bone",
    "vomer", "hyoid", "carpal", "metacarpal", "tarsal", "metatarsal",
    "phalanx", "phalanges", "calcaneus", "talus", "navicular", "cuneiform",
    "cuboid", "scaphoid", "lunate", "triquetral", "pisiform", "trapezium",
    "trapezoid bone", "capitate", "hamate", "hip bone", "innominate",
]

# Drop very deep / tiny facial & deep spinal minutiae for presentation payload control
SKIP_NAME_SUB = [
    "rotatores", "levatores costarum", "interspinales", "intertransversarii",
    "palpebral", "orbicularis oculi", "orbicularis oris", "nasalis",
    "depressor", "levator labii", "levator anguli", "risorius", "mentalis",
    "corrugator", "procerus", "auricularis", "stapedius", "tensor tympani",
    # Hierarchical containers / non-presentation cardiac
    "papillary muscle", "check ligament",
    "subdivision of muscle", "region of papillary", "region of lateral papillary",
    "region of muscle",
]

# Exact / prefix container names that explode payload without clinical selectivity
SKIP_EXACT_OR_PREFIX = [
    "muscle of thorax",
    "muscle of abdomen",
    "muscle of pelvis",
    "perineal muscle",
    "superficial perineal muscle",
    "muscle of anterior abdominal wall",
    "muscle of anterior compartment of thigh",
    "muscle of posterior compartment of thigh",
    "muscle of medial compartment of thigh",
    "muscle of lateral compartment of leg",
    "muscle of anterior compartment of leg",
    "muscle of posterior compartment of leg",
    "superficial muscle of posterior compartment of leg",
    "deep muscle of posterior compartment of leg",
    "intrinsic muscle of dorsum of foot",
    "superficial muscle of neck",
    "anterior suboccipital muscle",
    "muscle of upper limb",
    "muscle of lower limb",
    "muscle of back",
    "muscle of perineum",
]


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_tables():
    concepts = {}
    for line in PARTS.read_text().splitlines()[1:]:
        bits = line.split("\t")
        if len(bits) >= 3:
            concepts[bits[0]] = {"bp": bits[1], "name": bits[2]}
    concept_to_fj = defaultdict(list)
    for line in ELEMENTS.read_text().splitlines()[1:]:
        bits = line.split("\t")
        if len(bits) >= 3:
            concept_to_fj[bits[0]].append(bits[2])
    return concepts, concept_to_fj


def excluded(name: str) -> bool:
    n = name.lower()
    return any(x in n for x in EXCLUDE_SUB)


def skipped(name: str) -> bool:
    n = name.lower().strip()
    if any(x in n for x in SKIP_NAME_SUB):
        return True
    if n in SKIP_EXACT_OR_PREFIX:
        return True
    # Generic "muscle of …" containers (keep specific named muscles)
    if n.startswith("muscle of ") and n.count(" ") <= 5:
        # allow specific like "muscle of thenar eminence" carefully — skip broad
        broad = [
            "thorax", "abdomen", "pelvis", "back", "neck", "perineum",
            "upper limb", "lower limb", "arm", "forearm", "thigh", "leg", "foot", "hand",
        ]
        if any(b in n for b in broad):
            return True
    return False


def is_muscle(name: str) -> bool:
    if excluded(name) or skipped(name):
        return False
    n = name.lower()
    return any(h in n for h in MUSCLE_HINT)


def is_bone(name: str) -> bool:
    if excluded(name):
        return False
    n = name.lower()
    if "cartilage" in n and "costal" not in n:
        return False
    return any(h in n for h in BONE_HINT)


def laterality(name: str) -> str:
    n = name.lower()
    if re.search(r"\bleft\b", n):
        return "left"
    if re.search(r"\bright\b", n):
        return "right"
    return "midline"


def mesh_id(layer: str, name: str, structure_id: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", ".", name.lower()).strip(".")
    slug = re.sub(r"\.+", ".", slug)
    if len(slug) > 80:
        slug = slug[:80].rstrip(".")
    prefix = "muscle" if layer == "muscle" else "bone"
    # Prefer semantic slug; ensure uniqueness with FMA suffix if needed later
    return f"{prefix}.{slug}"


def region_for(name: str, layer: str) -> str:
    n = name.lower()
    lat = laterality(name)

    def side(base: str) -> str:
        if lat == "left":
            return f"{base}-left"
        if lat == "right":
            return f"{base}-right"
        return base

    head = [
        "skull", "mandible", "maxilla", "frontal bone", "parietal bone",
        "occipital bone", "temporal bone", "sphenoid", "ethmoid", "nasal bone",
        "zygomatic bone", "lacrimal", "vomer", "hyoid", "masseter", "temporalis",
        "orbicularis", "zygomaticus", "buccinator", "sternocleidomastoid",
        "platysma", "scalene", "digastric", "mylohyoid", "stylohyoid", "genio",
        "hyoglossus", "styloglossus", "omohyoid", "sternohyoid", "sternothyroid",
        "thyrohyoid",
    ]
    if any(k in n for k in head):
        return "muscle-head-neck" if layer == "muscle" else "skeletal-skull"

    if any(k in n for k in ["vertebra", "atlas", "axis", "sacrum", "coccyx"]):
        return "skeletal-spine" if layer == "skeletal" else "muscle-torso"

    if any(k in n for k in ["rib", "sternum", "costal"]):
        return "skeletal-thorax" if layer == "skeletal" else "muscle-torso"

    upper_girdle = ["clavicle", "scapula"]
    upper_arm = [
        "humerus", "deltoid", "supraspinatus", "infraspinatus", "subscapularis",
        "teres ", "biceps", "triceps", "brachialis", "coracobrachialis",
        "pectoralis", "latissimus", "serratus", "rhomboid", "levator scapulae",
        "subclavius", "trapezius",
    ]
    forearm_hand = [
        "radius", "ulna", "carpal", "metacarpal", "phalanx", "flexor", "extensor",
        "supinator", "pronator", "brachioradialis", "anconeus", "lumbrical",
        "interosseous", "thenar", "hypothenar",
    ]
    if any(k in n for k in upper_girdle + upper_arm + forearm_hand):
        if layer == "skeletal":
            if any(k in n for k in upper_girdle):
                return side("skeletal-shoulder-girdle")
            return side("skeletal-upper")
        return side("muscle-upper")

    pelvis = [
        "ilium", "ischium", "pubis", "hip bone", "innominate", "glute",
        "piriformis", "obturator", "gemellus", "levator ani", "coccygeus",
        "iliopsoas", "iliacus", "psoas",
    ]
    if any(k in n for k in pelvis):
        return "muscle-pelvis" if layer == "muscle" else "skeletal-pelvis"

    lower = [
        "femur", "tibia", "fibula", "patella", "vastus", "rectus femoris",
        "semitendinosus", "semimembranosus", "biceps femoris", "sartorius",
        "gracilis", "adductor", "gastroc", "soleus", "tibialis", "fibularis",
        "peroneus", "popliteus", "plantaris", "calcaneus", "talus", "tarsal",
        "metatarsal", "quadriceps",
    ]
    if any(k in n for k in lower):
        return side("muscle-lower") if layer == "muscle" else side("skeletal-lower")

    if any(k in n for k in ["oblique", "transversus", "rectus abdominis", "diaphragm", "intercostal", "pyramidalis", "erector", "iliocostalis", "longissimus", "spinalis", "multifidus", "semispinalis", "splenius", "quadratus lumborum"]):
        return "muscle-torso" if layer == "muscle" else "skeletal-spine"

    return f"{layer}-other"


def clinical_name(name: str) -> str:
    return name[:1].upper() + name[1:] if name else name


def main() -> int:
    if not ZIP_PATH.is_file():
        raise SystemExit(f"Missing BP3D archive: {ZIP_PATH} (run npm run bp3d:fetch)")
    if sha256_file(ZIP_PATH) != ARCHIVE_PIN:
        raise SystemExit("Archive checksum mismatch")

    concepts, concept_to_fj = load_tables()
    z = zipfile.ZipFile(ZIP_PATH)

    selected = []
    used_mesh_ids = set()
    for cid, fjs in concept_to_fj.items():
        if cid not in concepts:
            continue
        name = concepts[cid]["name"]
        if is_muscle(name):
            layer = "muscle"
        elif is_bone(name):
            layer = "skeletal"
        else:
            continue
        # Cap multi-element merges at 12 files to avoid giant compound meshes
        if len(fjs) > 12:
            continue
        mid = mesh_id(layer, name, cid)
        if mid in used_mesh_ids:
            mid = f"{mid}.{cid.lower()}"
        used_mesh_ids.add(mid)
        pack = region_for(name, layer)
        selected.append(
            {
                "meshId": mid,
                "structureId": cid.replace("FMA", "FMA:"),
                "preferredName": name,
                "clinicalName": clinical_name(name),
                "layer": layer,
                "laterality": laterality(name),
                "parentStructureId": None,
                "region": pack,
                "sourceConceptId": cid,
                "sourceRepresentationId": concepts[cid]["bp"],
                "sourceElementFileIds": fjs,
            }
        )

    packs: dict[str, list] = defaultdict(list)
    for row in selected:
        packs[row["region"]].append(row)

    OUT.mkdir(parents=True, exist_ok=True)
    catalog = {
        "schemaVersion": "1.0.0",
        "catalogId": "bp3d-fullbody-msk-v1",
        "sourceName": "BodyParts3D",
        "sourceVersion": "4.0",
        "sourceAssetVersion": "bodyparts3d-4.0-isa-obj99",
        "coordinateFrameVersion": "painlocator-bp3d-canonical-v1",
        "archiveChecksum": ARCHIVE_PIN,
        "structureCount": len(selected),
        "packCount": len(packs),
        "packs": {
            pid: {
                "packId": pid,
                "layer": "muscle" if pid.startswith("muscle") else "skeletal",
                "structureCount": len(rows),
                "manifest": f"./packs/{pid}/source-manifest.json",
            }
            for pid, rows in sorted(packs.items())
        },
        "notes": [
            "Curated musculoskeletal presentation set from BP3D 4.0 99% archive.",
            "Excludes vessels/organs/nerves and some deep/tiny facial spinal minutiae for payload.",
            "Multi-element FMA concepts with ≤12 FJ files are merged into one mesh.",
        ],
    }
    (OUT / "catalog.json").write_text(json.dumps(catalog, indent=2) + "\n")

    total_obj = 0
    for pack_id, rows in sorted(packs.items()):
        pack_dir = OUT / "packs" / pack_id
        pack_dir.mkdir(parents=True, exist_ok=True)
        obj_dir = OBJ_CACHE / pack_id / "obj"
        obj_dir.mkdir(parents=True, exist_ok=True)

        structures = []
        for row in rows:
            element_ids = row["sourceElementFileIds"]
            # For multi-element, pin primary as first; store all checksums
            checksums = []
            for fj in element_ids:
                member = f"isa_BP3D_4.0_obj_99/{fj}.obj"
                data = z.read(member)
                total_obj += len(data)
                digest = sha256_bytes(data)
                checksums.append({"fileId": fj, "sha256": digest, "bytes": len(data)})
                out_obj = obj_dir / f"{fj}.obj"
                if not out_obj.exists() or sha256_file(out_obj) != digest:
                    out_obj.write_bytes(data)
            primary = element_ids[0]
            structures.append(
                {
                    "meshId": row["meshId"],
                    "structureId": row["structureId"],
                    "preferredName": row["preferredName"],
                    "clinicalName": row["clinicalName"],
                    "layer": row["layer"],
                    "laterality": row["laterality"],
                    "parentStructureId": None,
                    "region": pack_id,
                    "sourceConceptId": row["sourceConceptId"],
                    "sourceRepresentationId": row["sourceRepresentationId"],
                    "sourceElementFileId": primary,
                    "sourceElementFileIds": element_ids,
                    "sourceFile": f"./obj/{primary}.obj",
                    "sourceChecksum": {
                        "algorithm": "sha256",
                        "value": checksums[0]["sha256"],
                    },
                    "elementChecksums": checksums,
                }
            )

        layer = rows[0]["layer"]
        manifest = {
            "schemaVersion": "1.0.0",
            "sourceName": "BodyParts3D",
            "sourceVersion": "4.0",
            "sourceDate": "2013-05-22",
            "license": "CC-BY-4.0",
            "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
            "attribution": "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International",
            "archiveUrl": "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip",
            "archiveFilename": "isa_BP3D_4.0_obj_99.zip",
            "archiveChecksum": {"algorithm": "sha256", "value": ARCHIVE_PIN},
            "region": pack_id,
            "regionRationale": f"Full-body curated {layer} pack for clinician anatomical presentation.",
            "modelId": "bp3d-fullbody-msk-v1",
            "packId": pack_id,
            "coordinateFrameVersion": "painlocator-bp3d-canonical-v1",
            "sourceCoordinateSystem": {
                "units": "millimeters",
                "up": "+Z",
                "handedness": "right",
                "laterality": "+X is anatomical left",
            },
            "structures": structures,
        }
        (pack_dir / "source-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"pack {pack_id}: {len(structures)} structures")

    print(f"TOTAL structures={len(selected)} packs={len(packs)} rawOBJ_MB={total_obj/1e6:.1f}")
    print(f"catalog → {OUT / 'catalog.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
