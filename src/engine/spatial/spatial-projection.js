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
    return {
      kind: "spatialSurface",
      meshUuid: mesh.uuid,
      meshName: mesh.name || "body",
      localPoint: { x: localPoint.x, y: localPoint.y, z: localPoint.z },
      face,
      faceIndex: hit.faceIndex ?? null,
      barycentric,
      createdAt: Date.now()
    };
  }

  function resolveAttachmentWorldPoint(THREE, attachment, meshByUuid) {
    if (!attachment) return null;
    const mesh = meshByUuid?.get?.(attachment.meshUuid) || attachment.mesh || null;
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
    worldToNormalizedAnchors,
    attachmentFromIntersection,
    resolveAttachmentWorldPoint
  };
})(typeof window !== "undefined" ? window : globalThis);
