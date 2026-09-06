/**
 * Runtime spatial annotation visuals.
 * Native spatial markers stay parented to bodyRoot (surface-attached while rotating).
 * Legacy view2d markers appear only on matching snap views.
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
      const mesh = this.scene.meshByUuid.get(attachment.meshUuid);
      if (!mesh) return null;

      let entry = this._entries.get(regionId);
      if (entry && entry.kind !== "spatial") {
        this.remove(regionId);
        entry = null;
      }

      const world = SpatialProjection.resolveAttachmentWorldPoint(
        THREE,
        attachment,
        this.scene.meshByUuid
      );
      if (!world) return null;

      const local = this.scene.bodyRoot.worldToLocal(world.clone());

      if (!entry) {
        const marker = new THREE.Mesh(
          this._sphereGeo,
          selected ? this._matSelected : this._matSpatial
        );
        marker.name = `spatial-marker-${regionId}`;
        marker.userData.regionId = regionId;
        marker.userData.markerKind = "spatial";
        this.scene.markerRoot.add(marker);
        entry = { kind: "spatial", attachment, marker, regionId };
        this._entries.set(regionId, entry);
      } else {
        entry.attachment = attachment;
        entry.marker.material = selected ? this._matSelected : this._matSpatial;
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

    dispose() {
      this.clear();
      this._sphereGeo.dispose();
      this._legacyGeo.dispose();
      this._matSpatial.dispose();
      this._matLegacy.dispose();
      this._matSelected.dispose();
    }
  }

  global.SpatialAnnotationLayer = SpatialAnnotationLayer;
})(window);
