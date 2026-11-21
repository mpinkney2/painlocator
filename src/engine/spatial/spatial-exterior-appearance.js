/**
 * SpatialExteriorAppearance — CAE patient-exterior look (skin + soft lighting).
 *
 * Keeps stylized clinical presentation: warm human skin tones and soft wrap
 * lighting without cadaver specular or game-like materials. Shared by the
 * manifest loader (runtime override) and scene controller (lights / tone map).
 */
(function (global) {
  /** Calm clinical skin — warm undertone, matte, slight sheen (not wet). */
  const SKIN = Object.freeze({
    baseColor: 0xc9a992,
    headColor: 0xcbb09c,
    limbColor: 0xc4a48c,
    extremityColor: 0xbe9d86,
    roughness: 0.58,
    metalness: 0.0,
    sheen: 0.42,
    sheenColor: 0xe8c4b0,
    sheenRoughness: 0.62,
    envMapIntensity: 0.35
  });

  const GHOST = Object.freeze({
    muscle: { color: 0xc9b5a8, opacity: 0.22 },
    skeletal: { color: 0xc9b5a8, opacity: 0.12 }
  });

  const LIGHTING = Object.freeze({
    ambient: { color: 0xfff6ef, intensity: 0.28 },
    hemisphere: { sky: 0xfff1e6, ground: 0x8a7a6c, intensity: 0.55 },
    key: { color: 0xfff2e4, intensity: 0.95, position: [2.2, 5.0, 3.2] },
    fill: { color: 0xc8d6ef, intensity: 0.28, position: [-3.2, 1.4, -1.8] },
    rim: { color: 0xdde8ff, intensity: 0.22, position: [-1.2, 2.8, -3.5] },
    toneMappingExposure: 1.05
  });

  function regionForMeshId(meshId) {
    const id = String(meshId || "");
    if (id === "surface.head" || id === "surface.neck") return "head";
    if (id === "surface.handL" || id === "surface.handR" || id === "surface.footL" || id === "surface.footR") {
      return "extremity";
    }
    if (
      id.includes("Arm") ||
      id.includes("forearm") ||
      id.includes("thigh") ||
      id.includes("shin") ||
      id.includes("shoulder")
    ) {
      return "limb";
    }
    return "base";
  }

  function colorForRegion(region) {
    if (region === "head") return SKIN.headColor;
    if (region === "limb") return SKIN.limbColor;
    if (region === "extremity") return SKIN.extremityColor;
    return SKIN.baseColor;
  }

  /**
   * Patient exterior material.
   * MeshStandardMaterial (not Physical/sheen) so soft directional + hemisphere
   * lights shade correctly without an HDRI environment map. Double-sided for
   * open atlas-derived shells (BP3D skin is typically non-watertight).
   * @param {typeof import('three')} THREE
   * @param {string} [meshId]
   */
  function createSkinMaterial(THREE, meshId) {
    const region = regionForMeshId(meshId);
    const color = colorForRegion(region);
    const side = THREE.DoubleSide != null ? THREE.DoubleSide : 2;
    return new THREE.MeshStandardMaterial({
      color,
      roughness: SKIN.roughness,
      metalness: SKIN.metalness,
      flatShading: false,
      side
    });
  }

  /**
   * Ensure exterior meshes have normals (meshopt BP3D packs may omit them).
   * @param {import('three').Object3D} root
   */
  function prepareExteriorGeometry(root) {
    if (!root?.traverse) return;
    root.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry) return;
      const geo = obj.geometry;
      if (!geo.getAttribute?.("normal")) {
        geo.computeVertexNormals?.();
      }
    });
  }

  /**
   * Soft clinical lighting for a Spatial scene. Replaces prior flat ambient+key.
   * @param {import('three').Scene} scene
   * @param {typeof import('three')} THREE
   * @param {import('three').WebGLRenderer} [renderer]
   */
  function applySceneLighting(scene, THREE, renderer) {
    const hemi = new THREE.HemisphereLight(
      LIGHTING.hemisphere.sky,
      LIGHTING.hemisphere.ground,
      LIGHTING.hemisphere.intensity
    );
    hemi.name = "spatialHemi";
    scene.add(hemi);

    const ambient = new THREE.AmbientLight(LIGHTING.ambient.color, LIGHTING.ambient.intensity);
    ambient.name = "spatialAmbient";
    scene.add(ambient);

    const key = new THREE.DirectionalLight(LIGHTING.key.color, LIGHTING.key.intensity);
    key.name = "spatialKey";
    key.position.set(...LIGHTING.key.position);
    scene.add(key);

    const fill = new THREE.DirectionalLight(LIGHTING.fill.color, LIGHTING.fill.intensity);
    fill.name = "spatialFill";
    fill.position.set(...LIGHTING.fill.position);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(LIGHTING.rim.color, LIGHTING.rim.intensity);
    rim.name = "spatialRim";
    rim.position.set(...LIGHTING.rim.position);
    scene.add(rim);

    if (renderer) {
      if (THREE.ACESFilmicToneMapping != null) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
      }
      if ("toneMappingExposure" in renderer) {
        renderer.toneMappingExposure = LIGHTING.toneMappingExposure;
      }
    }

    return { hemi, ambient, key, fill, rim };
  }

  const SpatialExteriorAppearance = {
    SKIN,
    GHOST,
    LIGHTING,
    regionForMeshId,
    colorForRegion,
    createSkinMaterial,
    prepareExteriorGeometry,
    applySceneLighting
  };

  global.SpatialExteriorAppearance = SpatialExteriorAppearance;
})(typeof window !== "undefined" ? window : globalThis);
