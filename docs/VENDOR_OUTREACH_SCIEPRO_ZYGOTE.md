# PainLocator → Vendor evaluation sample request

Ready-to-send text. Full decision context: `docs/PRODUCTION_ANATOMY_VENDOR_DECISION.md`.

---

**To:** SciePro (`contact@sciepro.com`) — primary  
**CC backup later:** Zygote sales  

**Subject:** PainLocator — evaluation sample request (WebGL clinical anatomy SaaS)

Hello,

We are evaluating production anatomy geometry for **PainLocator** (https://painlocator.vercel.app), a clinical pain-mapping product built on our Clinical Anatomy Engine (CAE).

We retain **BodyParts3D / FMA** as our semantic backbone and canonical body frame. We need higher-fidelity **visual** meshes that can be:

- mapped to FMA structure IDs,
- registered with **one global** scale/rotation/translation into our canonical frame,
- delivered in a **Realtime / WebGL** license with Compiled Form / anti-extraction packaging.

Please provide a **pilot/evaluation license** (NDA OK) and representative geometry for:

1. Skull / cranial vault (midline)  
2. Deltoid — left (partitioned if available)  
3. Scapula — left  
4. Humerus — left  
5. Pectoralis major — left (partitioned if available)  
6. Pelvis / hip bone — left  
7. Quadriceps (vastus lateralis minimum) — left  
8. Patella — left  
9. Tibia — left  
10. Foot (calcaneus + one metatarsal) — left  

Please also confirm:

1. Formats: OBJ / FBX / glTF / GLB?  
2. Vertex/triangle counts + realtime LOD options  
3. Coordinate system (units, axes, origin)  
4. Naming hierarchy + stable structure IDs (CSV/JSON export)  
5. Material/texture maps and downsample rights  
6. Male/female landmark alignment strategy  
7. WebGL SaaS redistribution terms (compiled/encrypted bundles OK?)  
8. Permission to convert to meshopt GLB inside encrypted packages  
9. Permission to maintain an internal vendor-id → FMA map  
10. Ability to run offline landmark registration to an external frame  
11. Pilot license duration/fee  
12. Ballpark Realtime (or Multi-Purpose) quote: adult male musculoskeletal (± full systems, ± female)

Thank you — we will not redistribute evaluation assets and will not purchase until technical gates pass.

PainLocator / Clinical Anatomy Engine team  
