/**
 * Spatial ↔ plate projection helpers (Phase 1).
 * Pure math where possible so Node tests can load without WebGL.
 *
 * Y-up convention:
 *   front → body faces +Z (camera on +Z looking −Z)
 *   back  → yaw π
 *   left  → yaw −π/2 (viewer sees body's left)
 *   right → yaw +π/2
 */
(function (global) {
  const SPATIAL_VIEWS = ["front", "back", "left", "right"];

  const VIEW_YAW = Object.freeze({
    front: 0,
    right: Math.PI / 2,
    back: Math.PI,
    left: -Math.PI / 2
  });

  function clamp01(v) {
    return Math.max(0, Math.min(1, Number(v) || 0));
  }

  function normalizeYaw(rad) {
    const t = Math.PI * 2;
    let y = rad % t;
    if (y <= -Math.PI) y += t;
    if (y > Math.PI) y -= t;
    return y;
  }

  function yawForView(view) {
    return VIEW_YAW[view] ?? 0;
  }

  function nearestSnapView(yaw) {
    const y = normalizeYaw(yaw);
    let best = "front";
    let bestDist = Infinity;
    for (const view of SPATIAL_VIEWS) {
      const d = Math.abs(normalizeYaw(y - VIEW_YAW[view]));
      if (d < bestDist) {
        bestDist = d;
        best = view;
      }
    }
    return best;
  }

  /**
   * Perspective distance that frames a body AABB in the camera (Y-up, camera on +Z).
   * Pure math — used by SpatialSceneController.fitToBody without WebGL.
   * @param {{x?: number, y?: number, z?: number}} size
   * @param {number} fovDeg
   * @param {number} aspect
   * @param {number} [padding]
   * @returns {number}
   */
  function cameraDistanceForBounds(size, fovDeg, aspect, padding = 1.16) {
    const sx = Math.max(0, Number(size?.x) || 0);
    const sy = Math.max(0, Number(size?.y) || 0);
    const sz = Math.max(0, Number(size?.z) || 0);
    const fov = ((Number(fovDeg) || 32) * Math.PI) / 180;
    const half = Math.tan(fov / 2);
    const a = Math.max(0.25, Number(aspect) || 1);
    if (!(half > 0) || !Number.isFinite(half)) return 4;
    const distY = sy / (2 * half);
    const distX = sx / (2 * half * a);
    const distZ = sz * 0.55;
    const pad = Number(padding) > 0 ? Number(padding) : 1.16;
    return Math.max(distY, distX, distZ, 0.8) * pad;
  }

  /**
   * Project a world point through the active spatial camera to 0–1 anchors.
   *
   * Phase 1 accuracy note (intentional, not a bug):
   * Uses the full WebGL canvas NDC → [0,1] mapping. Compatible with the existing
   * plate schema field shape (anchors[{x,y}]) but only approximately aligned with
   * the plate renderer's letterboxed image-frame coordinates from
   * AnatomyCoordinateMapper. True letterbox-aware 3D→2D remapping is deferred.
   */
  function worldToNormalizedAnchors(THREE, camera, worldPoint) {
    const v = worldPoint.clone().project(camera);
    return {
      x: clamp01((v.x + 1) / 2),
      y: clamp01((1 - v.y) / 2),
      ndcZ: v.z
    };
  }

  function attachmentFromIntersection(THREE, hit) {
    const mesh = hit.object;
    const worldPoint = hit.point.clone();
    const localPoint = mesh.worldToLocal(worldPoint.clone());
    const face = hit.face ? { a: hit.face.a, b: hit.face.b, c: hit.face.c } : null;
    let barycentric = null;
    if (hit.barycoord) {
      barycentric = { a: hit.barycoord.x, b: hit.barycoord.y, c: hit.barycoord.z };
    } else if (face && mesh.geometry?.attributes?.position) {
      const pos = mesh.geometry.attributes.position;
      const a = new THREE.Vector3().fromBufferAttribute(pos, face.a);
      const b = new THREE.Vector3().fromBufferAttribute(pos, face.b);
      const c = new THREE.Vector3().fromBufferAttribute(pos, face.c);
      mesh.localToWorld(a);
      mesh.localToWorld(b);
      mesh.localToWorld(c);
      const bary = new THREE.Vector3();
      THREE.Triangle.getBarycentricCoordinates(hit.point, a, b, c, bary);
      barycentric = { a: bary.x, b: bary.y, c: bary.z };
    }
    const meshId = mesh.userData?.meshId || mesh.name || null;
    return {
      kind: "spatialSurface",
      // Three UUID is runtime-only — remount binding uses meshId.
      meshUuid: mesh.uuid,
      meshId,
      meshName: meshId || mesh.name || "body",
      structureId: mesh.userData?.structureId || null,
      localPoint: { x: localPoint.x, y: localPoint.y, z: localPoint.z },
      face,
      faceIndex: hit.faceIndex ?? null,
      barycentric,
      createdAt: Date.now()
    };
  }

  function resolveMesh(attachment, meshByUuid, meshByName) {
    if (!attachment) return null;
    const byUuid = meshByUuid?.get?.(attachment.meshUuid);
    if (byUuid) return byUuid;

    // Prefer stable manifest meshId (Phase 2). meshName kept for Phase 1 session maps.
    const stableId = attachment.meshId || attachment.meshName;
    const byId =
      (stableId && meshByName?.get?.(stableId)) ||
      (stableId &&
        [...(meshByUuid?.values?.() || [])].find(
          (m) => m.userData?.meshId === stableId || m.name === stableId
        )) ||
      null;
    if (byId) {
      attachment.meshUuid = byId.uuid;
      attachment.meshId = byId.userData?.meshId || byId.name || attachment.meshId;
      if (byId.userData?.structureId) attachment.structureId = byId.userData.structureId;
      return byId;
    }
    return attachment.mesh || null;
  }

  function resolveAttachmentWorldPoint(THREE, attachment, meshByUuid, meshByName) {
    if (!attachment) return null;
    const mesh = resolveMesh(attachment, meshByUuid, meshByName);
    if (!mesh) return null;

    if (attachment.barycentric && attachment.face && mesh.geometry?.attributes?.position) {
      const pos = mesh.geometry.attributes.position;
      const { face, barycentric } = attachment;
      const a = new THREE.Vector3().fromBufferAttribute(pos, face.a);
      const b = new THREE.Vector3().fromBufferAttribute(pos, face.b);
      const c = new THREE.Vector3().fromBufferAttribute(pos, face.c);
      const local = new THREE.Vector3()
        .set(0, 0, 0)
        .addScaledVector(a, barycentric.a)
        .addScaledVector(b, barycentric.b)
        .addScaledVector(c, barycentric.c);
      return mesh.localToWorld(local);
    }

    if (attachment.localPoint) {
      return mesh.localToWorld(
        new THREE.Vector3(
          attachment.localPoint.x,
          attachment.localPoint.y,
          attachment.localPoint.z
        )
      );
    }
    return null;
  }

  global.SpatialProjection = {
    SPATIAL_VIEWS,
    VIEW_YAW,
    clamp01,
    normalizeYaw,
    yawForView,
    nearestSnapView,
    cameraDistanceForBounds,
    worldToNormalizedAnchors,
    attachmentFromIntersection,
    resolveMesh,
    resolveAttachmentWorldPoint
  };
})(typeof window !== "undefined" ? window : globalThis);
