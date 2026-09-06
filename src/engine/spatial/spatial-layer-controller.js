/**
 * SpatialLayerController — clinician anatomy depth (surface / muscle / skeletal).
 * Lazy-loads BP3D packs, ghosts the exterior, supports structure picking + dispose.
 * Patient presentation must never construct or call this controller.
 */
(function (global) {
  const DEPTHS = Object.freeze(["surface", "muscle", "skeletal"]);

  const MATERIALS = Object.freeze({
    exteriorGhostMuscle: { color: 0xb7c0c9, opacity: 0.22 },
    exteriorGhostSkeletal: { color: 0xb7c0c9, opacity: 0.12 },
    muscle: { color: 0xb89a9a, roughness: 0.86, metalness: 0.04, opacity: 0.96 },
    muscleSubdued: { color: 0xa09090, roughness: 0.9, metalness: 0.02, opacity: 0.18 },
    skeletal: { color: 0xe4ddd2, roughness: 0.78, metalness: 0.06, opacity: 0.98 },
    skeletalSubdued: { color: 0xc8c2b8, roughness: 0.88, metalness: 0.03, opacity: 0.14 },
    selected: {
      color: 0xd4b4b0,
      emissive: 0x5c403c,
      emissiveIntensity: 0.22,
      roughness: 0.55,
      metalness: 0.05
    }
  });

  class SpatialLayerController {
    /**
     * @param {object} scene SpatialSceneController
     * @param {typeof import('three')} THREE
     * @param {{ presentationMode?: string, onChange?: Function, onError?: Function, validationMode?: boolean }} [options]
     */
    constructor(scene, THREE, options = {}) {
      this.scene = scene;
      this.THREE = THREE;
      this.presentationMode = options.presentationMode || "clinician";
      this.onChange = typeof options.onChange === "function" ? options.onChange : () => {};
      this.onError = typeof options.onError === "function" ? options.onError : () => {};
      this.validationMode = !!options.validationMode;

      this.depth = "surface";
      this.loading = false;
      this.lastError = null;
      this.selectedMeshId = null;
      this.selectedMeta = null;
      this._disposed = false;

      this._layerRoot = new THREE.Group();
      this._layerRoot.name = "spatialOptionalLayers";
      this.scene.bodyRoot.add(this._layerRoot);

      /** @type {Map<string, object>} */
      this._packs = new Map();
      /** @type {Map<object, object>} */
      this._exteriorMaterialBackup = new Map();
      this._orientationMarkers = null;
    }

    getDepth() {
      return this.depth;
    }

    getSelectedStructure() {
      if (!this.selectedMeta) return null;
      return { ...this.selectedMeta };
    }

    /**
     * @param {'surface'|'muscle'|'skeletal'} depth
     */
    async setDepth(depth) {
      if (this._disposed) return { ok: false, reason: "disposed" };
      if (!DEPTHS.includes(depth)) return { ok: false, reason: "invalid-depth" };

      if (this.presentationMode === "patient" || SpatialLayerLoader.isPatientBlocked(this.presentationMode)) {
        this.depth = "surface";
        this._applyVisibility();
        this._emit();
        return { ok: false, reason: "patient-blocked" };
      }

      if (depth === "surface") {
        this.depth = "surface";
        this.clearSelection();
        this._applyVisibility();
        this._emit();
        return { ok: true, depth: "surface", cached: true };
      }

      this.loading = true;
      this.lastError = null;
      this._emit();

      try {
        const hadCache = SpatialLayerLoader.hasCachedPack(depth) || this._packs.has(depth);
        await this._ensurePack(depth);
        if (this._disposed) return { ok: false, reason: "disposed" };
        this.depth = depth;
        this.clearSelection();
        this._applyVisibility();
        this.loading = false;
        this._emit();
        return {
          ok: true,
          depth,
          cached: hadCache,
          byteLength: this._packs.get(depth)?.byteLength ?? null
        };
      } catch (err) {
        this.loading = false;
        this.lastError = err;
        this.depth = "surface";
        this.clearSelection();
        this._applyVisibility();
        this.onError(err);
        this._emit();
        return { ok: false, reason: "load-failed", error: err, depth: "surface" };
      }
    }

    async _ensurePack(layerId) {
      if (this._packs.has(layerId)) return this._packs.get(layerId);
      const pack = await SpatialLayerLoader.loadLayerPack(this.THREE, layerId, {
        presentationMode: this.presentationMode
      });
      if (this._disposed) {
        pack.dispose?.();
        throw new Error("Layer controller disposed during load");
      }
      this._stylePack(pack, layerId);
      this._layerRoot.add(pack.root);
      this._packs.set(layerId, pack);
      return pack;
    }

    _stylePack(pack, layerId) {
      const THREE = this.THREE;
      const base = layerId === "muscle" ? MATERIALS.muscle : MATERIALS.skeletal;
      for (const mesh of pack.meshById.values()) {
        if (mesh.material?.dispose) mesh.material.dispose();
        mesh.material = new THREE.MeshStandardMaterial({
          color: base.color,
          roughness: base.roughness,
          metalness: base.metalness,
          transparent: base.opacity < 1,
          opacity: base.opacity,
          depthWrite: true
        });
      }
    }

    _applyVisibility() {
      const musclePack = this._packs.get("muscle");
      const skeletalPack = this._packs.get("skeletal");

      if (musclePack) {
        const focus = this.depth === "muscle";
        const subdued = this.depth === "skeletal";
        musclePack.root.visible = focus || subdued;
        this._setPackMaterialState(musclePack, "muscle", focus, subdued);
      }
      if (skeletalPack) {
        const focus = this.depth === "skeletal";
        const subdued = this.depth === "muscle";
        skeletalPack.root.visible = focus || subdued;
        this._setPackMaterialState(skeletalPack, "skeletal", focus, subdued);
      }

      this._applyExteriorGhost();
      this._applySelectionHighlight();
      this._syncValidationMarkers();
      this.scene.requestFrame?.();
    }

    _setPackMaterialState(pack, kind, focus, subdued) {
      const focusMat = kind === "muscle" ? MATERIALS.muscle : MATERIALS.skeletal;
      const subMat = kind === "muscle" ? MATERIALS.muscleSubdued : MATERIALS.skeletalSubdued;
      const active = focus ? focusMat : subMat;
      for (const [meshId, mesh] of pack.meshById) {
        if (!mesh.material) continue;
        if (focus && this.selectedMeshId === meshId) continue;
        mesh.material.color.setHex(active.color);
        mesh.material.opacity = active.opacity;
        mesh.material.transparent = active.opacity < 0.99;
        mesh.material.depthWrite = !!focus;
        mesh.material.roughness = active.roughness;
        mesh.material.metalness = active.metalness;
        if (mesh.material.emissive) mesh.material.emissive.setHex(0x000000);
        if (mesh.material.emissiveIntensity != null) mesh.material.emissiveIntensity = 0;
        mesh.visible = focus || subdued;
      }
    }

    _applyExteriorGhost() {
      const root = this.scene._exterior?.root || this._findExteriorRoot();
      if (!root) return;

      const ghost =
        this.depth === "muscle"
          ? MATERIALS.exteriorGhostMuscle
          : this.depth === "skeletal"
            ? MATERIALS.exteriorGhostSkeletal
            : null;

      root.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        if (obj.userData?.spatialLayer) return;
        if (obj.userData?.markerKind || obj.userData?.regionId) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          if (!this._exteriorMaterialBackup.has(mat)) {
            this._exteriorMaterialBackup.set(mat, {
              opacity: mat.opacity,
              transparent: !!mat.transparent,
              depthWrite: mat.depthWrite !== false,
              color: mat.color?.clone?.() || null
            });
          }
          const bak = this._exteriorMaterialBackup.get(mat);
          if (!ghost) {
            mat.opacity = bak.opacity;
            mat.transparent = bak.transparent;
            mat.depthWrite = bak.depthWrite;
            if (bak.color && mat.color) mat.color.copy(bak.color);
          } else {
            mat.transparent = true;
            mat.opacity = ghost.opacity;
            mat.depthWrite = false;
            if (mat.color) mat.color.setHex(ghost.color);
          }
          mat.needsUpdate = true;
        }
      });
    }

    _findExteriorRoot() {
      const children = this.scene.bodyRoot?.children || [];
      for (const child of children) {
        if (child === this._layerRoot) continue;
        if (child === this.scene.markerRoot) continue;
        if (child.name === "spatialOptionalLayers") continue;
        return child;
      }
      return null;
    }

    clearSelection() {
      this.selectedMeshId = null;
      this.selectedMeta = null;
      this._applySelectionHighlight();
      this._emit();
    }

    selectMeshId(meshId) {
      if (!meshId) {
        this.clearSelection();
        return null;
      }
      const meta = this._lookupMeta(meshId);
      if (!meta) {
        this.clearSelection();
        return null;
      }
      this.selectedMeshId = meshId;
      this.selectedMeta = meta;
      this._applySelectionHighlight();
      this._emit();
      return this.getSelectedStructure();
    }

    _lookupMeta(meshId) {
      for (const pack of this._packs.values()) {
        if (pack.metaById?.has(meshId)) return { ...pack.metaById.get(meshId) };
      }
      return null;
    }

    _applySelectionHighlight() {
      const sel = MATERIALS.selected;
      for (const [layerId, pack] of this._packs) {
        const focus =
          (layerId === "muscle" && this.depth === "muscle") ||
          (layerId === "skeletal" && this.depth === "skeletal");
        for (const [meshId, mesh] of pack.meshById) {
          if (!mesh.material) continue;
          if (!(focus && meshId === this.selectedMeshId)) continue;
          mesh.material.color.setHex(sel.color);
          if (mesh.material.emissive) mesh.material.emissive.setHex(sel.emissive);
          if (mesh.material.emissiveIntensity != null) {
            mesh.material.emissiveIntensity = sel.emissiveIntensity;
          }
          mesh.material.opacity = 1;
          mesh.material.transparent = false;
          mesh.material.depthWrite = true;
          mesh.material.roughness = sel.roughness;
          mesh.material.metalness = sel.metalness;
        }
      }
      this.scene.requestFrame?.();
    }

    /**
     * Prefer focused layer meshes. Empty click clears selection.
     * @returns {object|null}
     */
    pickStructure(clientX, clientY) {
      if (this.depth === "surface" || this._disposed) return null;
      const pack = this._packs.get(this.depth);
      if (!pack) return null;
      const meshes = [...pack.meshById.values()].filter((m) => m.visible);
      if (!meshes.length) return null;

      const rect = this.scene.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      this.scene._pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.scene._pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      this.scene.raycaster.setFromCamera(this.scene._pointer, this.scene.camera);
      const hits = this.scene.raycaster.intersectObjects(meshes, false);
      if (!hits[0]?.object) {
        this.clearSelection();
        return null;
      }
      const meshId = hits[0].object.userData?.meshId || hits[0].object.name;
      return this.selectMeshId(meshId);
    }

    layerRaycastMeshes() {
      if (this.depth === "surface") return [];
      const pack = this._packs.get(this.depth);
      if (!pack) return [];
      return [...pack.meshById.values()].filter((m) => m.visible);
    }

    _syncValidationMarkers() {
      if (!this.validationMode) {
        if (this._orientationMarkers) this._orientationMarkers.visible = false;
        return;
      }
      if (!this._orientationMarkers) {
        this._orientationMarkers = this._buildOrientationMarkers();
        this._layerRoot.add(this._orientationMarkers);
      }
      this._orientationMarkers.visible = this.depth !== "surface";
    }

    _buildOrientationMarkers() {
      const THREE = this.THREE;
      const group = new THREE.Group();
      group.name = "spatialLayerValidationMarkers";
      const origin = new THREE.Vector3(-0.28, 1.28, 0);
      const axes = [
        { dir: [0.08, 0, 0], color: 0xb91c1c, name: "axis+X" },
        { dir: [0, 0.08, 0], color: 0x15803d, name: "axis+Y" },
        { dir: [0, 0, 0.08], color: 0x1d4ed8, name: "axis+Z" }
      ];
      for (const a of axes) {
        const geom = new THREE.BufferGeometry().setFromPoints([
          origin.clone(),
          new THREE.Vector3(origin.x + a.dir[0], origin.y + a.dir[1], origin.z + a.dir[2])
        ]);
        const line = new THREE.Line(
          geom,
          new THREE.LineBasicMaterial({ color: a.color, depthTest: false })
        );
        line.name = a.name;
        line.renderOrder = 20;
        group.add(line);
      }
      return group;
    }

    _emit() {
      this.onChange({
        depth: this.depth,
        loading: this.loading,
        error: this.lastError,
        selected: this.getSelectedStructure(),
        packsLoaded: [...this._packs.keys()]
      });
    }

    dispose() {
      this._disposed = true;
      this.selectedMeshId = null;
      this.selectedMeta = null;
      this.depth = "surface";
      try {
        this._applyExteriorGhost();
      } catch (_) { /* ignore */ }
      for (const pack of this._packs.values()) {
        try {
          pack.dispose?.();
        } catch (_) { /* ignore */ }
      }
      this._packs.clear();
      this._layerRoot?.parent?.remove(this._layerRoot);
      this._layerRoot = null;
      this._exteriorMaterialBackup.clear();
    }
  }

  SpatialLayerController.DEPTHS = DEPTHS;
  SpatialLayerController.MATERIALS = MATERIALS;
  global.SpatialLayerController = SpatialLayerController;
})(typeof window !== "undefined" ? window : globalThis);
