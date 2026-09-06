/**
 * Global exterior → canonical conformer (Phase 2 Slice 5).
 *
 * One whole-body rigid similarity (uniform scale + rotation + translation).
 * No per-region patches. Stop condition: GLOBAL CONFORMER FAILED.
 */
(function (global) {
  const DEFAULT_URL =
    (global.CanonicalBodyFlag && global.CanonicalBodyFlag.EXTERIOR_CONFORMER_URL) ||
    "/anatomy/spatial/registration/exterior-to-canonical-v1.json";

  /** @type {Map<string, Promise<object>>} */
  const configPromises = new Map();

  function validateConformerConfig(cfg) {
    if (!cfg || typeof cfg !== "object") throw new Error("Exterior conformer missing");
    if (!cfg.transform || typeof cfg.transform.scale !== "number") {
      throw new Error("Exterior conformer transform.scale required");
    }
    if (!Array.isArray(cfg.transform.translation) || cfg.transform.translation.length !== 3) {
      throw new Error("Exterior conformer transform.translation[3] required");
    }
    if (
      cfg.validation?.stopConditionTriggered ||
      cfg.validation?.globalConformerFailed ||
      cfg.validation?.status === "GLOBAL CONFORMER FAILED" ||
      cfg.validation?.status === "fail"
    ) {
      const err = new Error("GLOBAL CONFORMER FAILED");
      err.code = "GLOBAL_CONFORMER_FAILED";
      err.conformer = cfg;
      throw err;
    }
    return cfg;
  }

  async function loadConformerConfig(url = DEFAULT_URL) {
    const key = url || DEFAULT_URL;
    if (configPromises.has(key)) return configPromises.get(key);
    const pending = fetch(key, { cache: "force-cache" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Exterior conformer HTTP ${res.status}`);
        return validateConformerConfig(await res.json());
      })
      .catch((err) => {
        configPromises.delete(key);
        throw err;
      });
    configPromises.set(key, pending);
    return pending;
  }

  /**
   * Apply global conformer to an exterior Object3D root (mutates TRS).
   * @param {import('three').Object3D} root
   * @param {object} conformer
   */
  function applyExteriorConformer(root, conformer) {
    if (!root || !conformer?.transform) throw new Error("applyExteriorConformer: invalid args");
    const t = conformer.transform;
    const rot = t.rotationEuler || [0, 0, 0];
    const tr = t.translation || [0, 0, 0];
    root.scale.setScalar(t.scale);
    root.rotation.order = t.rotationOrder || "XYZ";
    root.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    root.position.set(tr[0] || 0, tr[1] || 0, tr[2] || 0);
    root.updateMatrixWorld(true);
    root.userData.exteriorConformerVersion =
      conformer.registrationVersion || conformer.registrationId || null;
    root.userData.coordinateFrameVersion = conformer.coordinateFrameVersion || null;
    return root;
  }

  /**
   * Build a Three.Matrix4 for p' = s * R * p + t (column-major).
   */
  function conformerToMatrix4(THREE, conformer) {
    const t = conformer.transform;
    const rot = t.rotationEuler || [0, 0, 0];
    const tr = t.translation || [0, 0, 0];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rot[0] || 0, rot[1] || 0, rot[2] || 0, t.rotationOrder || "XYZ")
    );
    m.compose(
      new THREE.Vector3(tr[0] || 0, tr[1] || 0, tr[2] || 0),
      q,
      new THREE.Vector3(t.scale, t.scale, t.scale)
    );
    return m;
  }

  /**
   * Map a point already expressed in pre-conformer exterior/body space into canonical meters
   * using the global conformer matrix.
   */
  function transformPointByConformer(THREE, conformer, point) {
    const m = conformerToMatrix4(THREE, conformer);
    const v = point.clone ? point.clone() : new THREE.Vector3(point.x, point.y, point.z);
    v.applyMatrix4(m);
    return { x: v.x, y: v.y, z: v.z };
  }

  /**
   * Nearest sampled vertex on canonical meshes (development projection aid).
   * Not clinical surface registration.
   */
  function nearestCanonicalSurfacePoint(THREE, meshes, point, options = {}) {
    const sampleStride = Math.max(1, options.sampleStride || 8);
    const target = point.isVector3
      ? point
      : new THREE.Vector3(point.x, point.y, point.z);
    let best = null;
    let bestDist = Infinity;
    const v = new THREE.Vector3();
    const list = Array.isArray(meshes) ? meshes : [...(meshes || [])];
    for (const mesh of list) {
      if (!mesh?.isMesh || !mesh.geometry?.attributes?.position) continue;
      mesh.updateWorldMatrix?.(true, false);
      const pos = mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += sampleStride) {
        v.fromBufferAttribute(pos, i);
        if (mesh.localToWorld) mesh.localToWorld(v);
        else if (mesh.matrixWorld) v.applyMatrix4(mesh.matrixWorld);
        const d = v.distanceToSquared(target);
        if (d < bestDist) {
          bestDist = d;
          best = v.clone();
        }
      }
    }
    if (!best) return null;
    return {
      point: { x: best.x, y: best.y, z: best.z },
      distanceMeters: Math.sqrt(bestDist),
      sampleStride
    };
  }

  /**
   * Build a development alignment report from conformer validation + optional live residuals.
   */
  function buildAlignmentReport(conformer, extras = {}) {
    const v = conformer?.validation || {};
    return {
      kind: "canonical-frame-alignment-report",
      label: v.label || "development alignment",
      clinicalRegistrationClaimed: false,
      registrationVersion: conformer?.registrationVersion || null,
      coordinateFrameVersion: conformer?.coordinateFrameVersion || null,
      globalScale: conformer?.transform?.scale ?? null,
      rotationEuler: conformer?.transform?.rotationEuler || [0, 0, 0],
      translation: conformer?.transform?.translation || null,
      landmarkDistances: (conformer?.derivation?.landmarksUsed || []).map((lm) => {
        const s = lm.sourceMeters;
        const t = lm.targetMeters;
        const scale = conformer.transform.scale;
        const tr = conformer.transform.translation;
        const mapped = [
          scale * s[0] + tr[0],
          scale * s[1] + tr[1],
          scale * s[2] + tr[2]
        ];
        const dist = Math.hypot(mapped[0] - t[0], mapped[1] - t[1], mapped[2] - t[2]);
        return {
          id: lm.id,
          description: lm.description,
          distanceMeters: dist,
          mappedMeters: mapped,
          targetMeters: t
        };
      }),
      meanAlignmentErrorMeters: v.metrics?.meanAlignmentErrorMeters ?? null,
      maxAlignmentErrorMeters: v.metrics?.maxAlignmentErrorMeters ?? null,
      maxErrorLandmark: v.metrics?.maxErrorLandmark ?? null,
      segmentChecks: v.segmentChecks || [],
      warnings: v.warnings || [],
      stopCondition: v.stopCondition || null,
      status: v.status || null,
      ...extras
    };
  }

  function clearConformerCache() {
    configPromises.clear();
  }

  global.ExteriorCanonicalConformer = {
    loadConformerConfig,
    validateConformerConfig,
    applyExteriorConformer,
    conformerToMatrix4,
    transformPointByConformer,
    nearestCanonicalSurfacePoint,
    buildAlignmentReport,
    clearConformerCache,
    DEFAULT_URL
  };
})(typeof window !== "undefined" ? window : globalThis);
