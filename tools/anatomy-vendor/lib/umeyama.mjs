/**
 * Global similarity (Umeyama) — vendor landmarks → canonical frame.
 * Shared by register-to-canonical.mjs and unit tests.
 * No regional correction patches.
 */

export function centroid(pts) {
  const c = [0, 0, 0];
  for (const p of pts) {
    c[0] += p[0];
    c[1] += p[1];
    c[2] += p[2];
  }
  const n = pts.length || 1;
  return [c[0] / n, c[1] / n, c[2] / n];
}

export function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function scaleVec(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function norm(a) {
  return Math.sqrt(dot(a, a));
}

function matMul(A, B) {
  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
    }
  }
  return C;
}

function matT(A) {
  return [
    [A[0][0], A[1][0], A[2][0]],
    [A[0][1], A[1][1], A[2][1]],
    [A[0][2], A[1][2], A[2][2]]
  ];
}

function matVec(A, v) {
  return [
    A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2],
    A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2],
    A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2]
  ];
}

function det3(A) {
  return (
    A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
  );
}

function eigenSym3(S) {
  let A = [
    [S[0][0], S[0][1], S[0][2]],
    [S[1][0], S[1][1], S[1][2]],
    [S[2][0], S[2][1], S[2][2]]
  ];
  let V = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ];
  for (let iter = 0; iter < 32; iter++) {
    let p = 0;
    let q = 1;
    let max = Math.abs(A[0][1]);
    for (const [i, j] of [
      [0, 2],
      [1, 2]
    ]) {
      const v = Math.abs(A[i][j]);
      if (v > max) {
        max = v;
        p = i;
        q = j;
      }
    }
    if (max < 1e-12) break;
    const app = A[p][p];
    const aqq = A[q][q];
    const apq = A[p][q];
    const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    const Rpq = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    Rpq[p][p] = c;
    Rpq[q][q] = c;
    Rpq[p][q] = s;
    Rpq[q][p] = -s;
    A = matMul(matMul(matT(Rpq), A), Rpq);
    V = matMul(V, Rpq);
  }
  const values = [A[0][0], A[1][1], A[2][2]];
  const order = [0, 1, 2].sort((i, j) => values[j] - values[i]);
  const sortedVals = order.map((i) => values[i]);
  const sortedVecs = [
    [V[0][order[0]], V[0][order[1]], V[0][order[2]]],
    [V[1][order[0]], V[1][order[1]], V[1][order[2]]],
    [V[2][order[0]], V[2][order[1]], V[2][order[2]]]
  ];
  return { values: sortedVals, vectors: sortedVecs };
}

function svd3(H) {
  const Ht = matT(H);
  const HtH = matMul(Ht, H);
  const HHt = matMul(H, Ht);
  const eigV = eigenSym3(HtH);
  const eigU = eigenSym3(HHt);
  const V = eigV.vectors;
  let U = eigU.vectors;
  for (let i = 0; i < 3; i++) {
    const v = [V[0][i], V[1][i], V[2][i]];
    const hv = matVec(H, v);
    const u = [U[0][i], U[1][i], U[2][i]];
    if (dot(hv, u) < 0) {
      U[0][i] *= -1;
      U[1][i] *= -1;
      U[2][i] *= -1;
    }
  }
  return { U, V, singularValues: eigV.values.map((x) => Math.sqrt(Math.max(0, x))) };
}

/** Umeyama similarity: maps source X → target Y as s R X + t */
export function umeyama(X, Y) {
  const n = X.length;
  const muX = centroid(X);
  const muY = centroid(Y);
  const Xc = X.map((p) => sub(p, muX));
  const Yc = Y.map((p) => sub(p, muY));
  let sigmaX = 0;
  for (const p of Xc) sigmaX += dot(p, p);
  sigmaX /= n;

  const H = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        H[i][j] += Xc[k][j] * Yc[k][i];
      }
    }
  }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) H[i][j] /= n;

  const { U, V } = svd3(H);
  let R = matMul(U, matT(V));
  if (det3(R) < 0) {
    const S = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, -1]
    ];
    R = matMul(matMul(U, S), matT(V));
  }

  // Both numerator and σ_x² must be means (or both sums) — Umeyama §Eq. scale.
  let num = 0;
  for (let k = 0; k < n; k++) {
    num += dot(Yc[k], matVec(R, Xc[k]));
  }
  num /= n;
  const s = sigmaX > 1e-12 ? num / sigmaX : 1;
  const t = sub(muY, scaleVec(matVec(R, muX), s));
  return { scale: s, rotation: R, translation: t };
}

export function applySimilarity(s, R, t, p) {
  return add(scaleVec(matVec(R, p), s), t);
}

/**
 * Compute per-landmark residuals after global similarity fit.
 * @returns {{ scale, rotation, translation, meanMeters, maxMeters, perLandmark }}
 */
export function computeRegistrationResiduals(vendorPts, canonicalPts, ids) {
  const { scale, rotation, translation } = umeyama(vendorPts, canonicalPts);
  const perLandmark = ids.map((id, i) => {
    const pred = applySimilarity(scale, rotation, translation, vendorPts[i]);
    const err = norm(sub(pred, canonicalPts[i]));
    return {
      id,
      residualMeters: err,
      residualMm: err * 1000,
      vendorMeters: vendorPts[i],
      canonicalMeters: canonicalPts[i],
      predictedCanonicalMeters: pred
    };
  });
  const residuals = perLandmark.map((p) => p.residualMeters);
  const meanMeters = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const maxMeters = Math.max(...residuals);
  return { scale, rotation, translation, meanMeters, maxMeters, perLandmark };
}

export const MEAN_FAIL_M = 0.035;
export const MAX_FAIL_M = 0.08;
