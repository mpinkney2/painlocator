/**
 * Runtime spatial annotation visuals.
 * Native spatial markers are parented to the raycast hit mesh in mesh-local space
 * (true surface attachment — not merely co-rotated via bodyRoot).
 * Legacy view2d markers appear only on matching snap views (bodyRoot-local).
 */
(function (global) {
  class SpatialAnnotationLayer {
    /**
     * @param {SpatialSceneController} scene
     * @param {typeof import("three")} THREE
     */
    constructor(scene, THREE) {
      this.scene = scene;
      this.THREE = THREE;
      /** @type {Map<string, { kind: string, attachment?: object, marker: import("three").Object3D, regionId: string }>} */
      this._entries = new Map();
      this._sphereGeo = new THREE.SphereGeometry(0.035, 14, 12);
      this._legacyGeo = new THREE.SphereGeometry(0.03, 10, 8);
      this._matSpatial = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0x7f1d1d,
        emissiveIntensity: 0.35,
        roughness: 0.4,
        metalness: 0.1
      });
      this._matLegacy = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0x92400e,
        emissiveIntensity: 0.25,
        roughness: 0.45,
        metalness: 0.05,
        transparent: true,
        opacity: 0.9
      });
      this._matSelected = new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x0e7490,
        emissiveIntensity: 0.4,
        roughness: 0.35,
        metalness: 0.15
      });
      // Clinical pain chroma — always dominant over ghosted anatomy.
      this._matSpatial.depthTest = true;
      this._matSpatial.depthWrite = true;
      this._matSelected.depthTest = true;
      this._haloGeo = new THREE.SphereGeometry(0.055, 12, 10);
      this._matHalo = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.28,
        depthTest: false,
        depthWrite: false
      });
      this._depthBoost = false;
    }

    clear() {
      for (const id of [...this._entries.keys()]) this.remove(id);
    }

    remove(regionId) {
      const entry = this._entries.get(regionId);
      if (!entry) return;
      entry.marker.parent?.remove(entry.marker);
      this._entries.delete(regionId);
      this.scene.requestFrame();
    }

    upsertSpatial(regionId, attachment, { selected = false } = {}) {
      const THREE = this.THREE;
      const mesh = SpatialProjection.resolveMesh(
        attachment,
        this.scene.meshByUuid,
        this.scene.meshByName
      );
      if (!mesh) return null;

      let entry = this._entries.get(regionId);
      if (entry && entry.kind !== "spatial") {
        this.remove(regionId);
        entry = null;
      }

      // Prefer stored mesh-local point; fall back to resolved world → mesh local.
      let local = null;
      if (attachment.localPoint) {
        local = new THREE.Vector3(
          attachment.localPoint.x,
          attachment.localPoint.y,
          attachment.localPoint.z
        );
      } else {
        const world = SpatialProjection.resolveAttachmentWorldPoint(
          THREE,
          attachment,
          this.scene.meshByUuid,
          this.scene.meshByName
        );
        if (!world) return null;
        local = mesh.worldToLocal(world.clone());
      }

      if (!entry) {
        const marker = new THREE.Mesh(
          this._sphereGeo,
          selected ? this._matSelected : this._matSpatial
        );
        marker.name = `spatial-marker-${regionId}`;
        marker.userData.regionId = regionId;
        marker.userData.markerKind = "spatial";
        marker.renderOrder = 10;
        const halo = new THREE.Mesh(this._haloGeo, this._matHalo);
        halo.name = `spatial-marker-halo-${regionId}`;
        halo.userData.markerKind = "spatial-halo";
        halo.renderOrder = 9;
        halo.raycast = () => {};
        marker.add(halo);
        marker.userData.halo = halo;
        // Parent to the hit mesh so attachment survives bodyRoot yaw as true
        // surface binding (not merely shared rotation via markerRoot).
        mesh.add(marker);
        entry = { kind: "spatial", attachment, marker, regionId, meshUuid: mesh.uuid };
        this._entries.set(regionId, entry);
      } else {
        entry.attachment = attachment;
        entry.marker.material = selected ? this._matSelected : this._matSpatial;
        if (entry.marker.parent !== mesh) {
          entry.marker.parent?.remove(entry.marker);
          mesh.add(entry.marker);
        }
        entry.meshUuid = mesh.uuid;
      }
      entry.marker.position.copy(local);
      entry.marker.visible = true;
      this.scene.requestFrame();
      return entry;
    }

    upsertLegacy(regionId, region, viewType, { selected = false } = {}) {
      const THREE = this.THREE;
      const matches = region.view === viewType;
      let entry = this._entries.get(regionId);
      if (entry && entry.kind !== "legacy") {
        this.remove(regionId);
        entry = null;
      }
      if (!matches) {
        if (entry) entry.marker.visible = false;
        this.scene.requestFrame();
        return entry || null;
      }

      const center =
        typeof getRegionCenter === "function"
          ? getRegionCenter(region)
          : region.anchors?.[0] || { x: 0.5, y: 0.5 };
      const local = this._anchorsToBodyLocal(center.x, center.y, viewType);

      if (!entry) {
        const marker = new THREE.Mesh(
          this._legacyGeo,
          selected ? this._matSelected : this._matLegacy
        );
        marker.name = `legacy-marker-${regionId}`;
        marker.userData.regionId = regionId;
        marker.userData.markerKind = "legacy";
        this.scene.markerRoot.add(marker);
        entry = { kind: "legacy", marker, regionId };
        this._entries.set(regionId, entry);
      } else {
        entry.marker.material = selected ? this._matSelected : this._matLegacy;
      }
      entry.marker.position.copy(local);
      entry.marker.visible = true;
      this.scene.requestFrame();
      return entry;
    }

    _anchorsToBodyLocal(nx, ny, viewType) {
      const THREE = this.THREE;
      const x = (nx - 0.5) * 1.1;
      const y = (1 - ny) * 1.85;
      const zFront = 0.32;
      switch (viewType) {
        case "back":
          return new THREE.Vector3(-x, y, -zFront);
        case "left":
          return new THREE.Vector3(-zFront, y, -x);
        case "right":
          return new THREE.Vector3(zFront, y, x);
        case "front":
        default:
          return new THREE.Vector3(x, y, zFront);
      }
    }

    get(regionId) {
      return this._entries.get(regionId) || null;
    }

    setPainMarkerDepthBoost(enabled) {
      this._depthBoost = !!enabled;
      // When anatomy layers ghost the exterior, keep marks readable above depth complexity.
      const depthTest = !this._depthBoost;
      this._matSpatial.depthTest = depthTest;
      this._matSelected.depthTest = depthTest;
      this._matHalo.depthTest = false;
      this._matSpatial.depthWrite = depthTest;
      this._matSelected.depthWrite = depthTest;
      for (const entry of this._entries.values()) {
        if (entry.kind !== "spatial") continue;
        entry.marker.renderOrder = this._depthBoost ? 12 : 10;
        if (entry.marker.userData.halo) {
          entry.marker.userData.halo.visible = true;
          entry.marker.userData.halo.renderOrder = this._depthBoost ? 11 : 9;
        }
      }
      this.scene.requestFrame?.();
    }

    dispose() {
      this.clear();
      this._sphereGeo.dispose();
      this._legacyGeo.dispose();
      this._haloGeo?.dispose?.();
      this._matSpatial.dispose();
      this._matLegacy.dispose();
      this._matSelected.dispose();
      this._matHalo?.dispose?.();
    }
  }

  global.SpatialAnnotationLayer = SpatialAnnotationLayer;
})(window);
