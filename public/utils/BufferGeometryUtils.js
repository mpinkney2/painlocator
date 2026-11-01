/**
 * Minimal BufferGeometryUtils subset required by /vendor/GLTFLoader.js:
 *   import { toTrianglesDrawMode } from '../utils/BufferGeometryUtils.js'
 *
 * That relative URL resolves to /utils/BufferGeometryUtils.js. Without this
 * file, dynamic import() of GLTFLoader fails (module graph 404) even though
 * /vendor/GLTFLoader.js itself returns 200.
 *
 * Source: three@0.170.0 examples/jsm/utils/BufferGeometryUtils.js (MIT).
 * See /vendor/THREE_LICENSE.
 */
import {
  TriangleFanDrawMode,
  TriangleStripDrawMode,
  TrianglesDrawMode
} from "three";

export function toTrianglesDrawMode(geometry, drawMode) {
  if (drawMode === TrianglesDrawMode) {
    return geometry;
  }

  if (drawMode === TriangleFanDrawMode || drawMode === TriangleStripDrawMode) {
    let index = geometry.getIndex();

    if (index === null) {
      const indices = [];
      const position = geometry.getAttribute("position");
      if (position === undefined) return geometry;
      for (let i = 0; i < position.count; i++) indices.push(i);
      geometry.setIndex(indices);
      index = geometry.getIndex();
    }

    const numberOfTriangles = index.count - 2;
    const newIndices = [];

    if (drawMode === TriangleFanDrawMode) {
      for (let i = 1; i <= numberOfTriangles; i++) {
        newIndices.push(index.getX(0), index.getX(i), index.getX(i + 1));
      }
    } else {
      for (let i = 0; i < numberOfTriangles; i++) {
        if (i % 2 === 0) {
          newIndices.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
        } else {
          newIndices.push(index.getX(i + 2), index.getX(i + 1), index.getX(i));
        }
      }
    }

    const newGeometry = geometry.clone();
    newGeometry.setIndex(newIndices);
    newGeometry.clearGroups();
    return newGeometry;
  }

  return geometry;
}
