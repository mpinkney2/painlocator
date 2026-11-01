/**
 * Anatomy pack path resolution (Node smoke test).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const code = fs.readFileSync(path.join(root, "src/engine/anatomy/asset-paths.js"), "utf8");

const localStorage = {
  _data: {},
  getItem(k) {
    return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null;
  },
  setItem(k, v) {
    this._data[k] = String(v);
  }
};

const window = {};
vm.runInNewContext(code, { window, localStorage, console });

assert.equal(window.normalizeAnatomyModel("female"), "adult-female");
assert.equal(window.getAssetPath("male", "front", "classic"), "/anatomy/adult-male/front.png");
assert.equal(
  window.getAssetPath("female", "left", "metahuman"),
  "/anatomy/metahuman/adult-female/left.png"
);
assert.equal(
  window.getAnatomyThumbPath("senior", "metahuman"),
  "/anatomy/metahuman/thumbs/senior.png"
);

window.setAnatomyPack("metahuman");
assert.equal(window.getAnatomyPack(), "metahuman");
assert.equal(window.getAssetPath("teen", "back"), "/anatomy/metahuman/teen/back.png");

window.setAnatomyPack("classic");
assert.equal(window.getAssetPath("child", "front"), "/anatomy/child/front.png");

const plate = path.join(root, "public/anatomy/metahuman/adult-male/front.png");
assert.ok(fs.existsSync(plate), "metahuman adult-male front plate must exist");

console.log("anatomy-pack-paths: ok");
