// muscles.ts — N2 écorché procedural: volúmenes musculares con silueta anatómica.
// 100% generado por código → dominio público por construcción, sin assets de terceros.
// Pectoral: masa frontal del tórax. Deltoides: gorro sobre el húmero proximal.
// Tríceps: dos cabezas (lateral + larga). Bíceps: huso fusiforme hasta el antebrazo.
import * as THREE from 'three';

export const HUES = { p: 0xe2574c, d: 0xd8a24a, t: 0x4c9de2, b: 0x8a6fd8 } as const;
const BASE = 0x6a7078;
const UPV = new THREE.Vector3(0, 1, 0);
const H2 = new THREE.Vector2(-0.80, 0.30);
const cTmp = new THREE.Color(), hTmp = new THREE.Color();

function paint(mat: THREE.MeshStandardMaterial, hue: number, act: number): void {
  mat.color.copy(cTmp.set(BASE).lerp(hTmp.set(hue), act));
  mat.emissive.set(hue).multiplyScalar(0.30 * act);
}

/** perfil fusiforme unitario: eje Y −0.5..0.5, radio máximo 1 */
function spindleGeometry(): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(new THREE.Vector2(Math.max(0.002, Math.pow(Math.sin(Math.PI * t), 0.8)), t));
  }
  const g = new THREE.LatheGeometry(pts, 18);
  g.translate(0, -0.5, 0);
  return g;
}
const spindleGeo = spindleGeometry();

export interface Muscles {
  pec: THREE.Mesh; pecMat: THREE.MeshStandardMaterial;
  delt: THREE.Mesh; deltMat: THREE.MeshStandardMaterial;
  triLat: THREE.Mesh; triLong: THREE.Mesh; triMat: THREE.MeshStandardMaterial;
  bi: THREE.Mesh; biMat: THREE.MeshStandardMaterial;
}

export function createMuscles(scene: THREE.Scene): Muscles {
  const mk = () => new THREE.MeshStandardMaterial({ color: BASE, roughness: .6 });
  const pecMat = mk(), deltMat = mk(), triMat = mk(), biMat = mk();
  const pec = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), pecMat);
  const delt = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), deltMat);
  const triLat = new THREE.Mesh(spindleGeo, triMat);
  const triLong = new THREE.Mesh(spindleGeo, triMat);
  const bi = new THREE.Mesh(spindleGeo, biMat);
  scene.add(pec, delt, triLat, triLong, bi);
  return { pec, pecMat, delt, deltMat, triLat, triLong, triMat, bi, biMat };
}

function placeSpindle(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, r: number): void {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length() || 1e-4;
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UPV, dir.normalize());
  mesh.scale.set(r, len, r);
}

export function updateMuscles(
  M: Muscles,
  S: { x: number; y: number }, E: { x: number; y: number }, T: { x: number; y: number },
  thetaDeg: number,
  act: { p: number; d: number; t: number; b: number }
): void {
  const t = (thetaDeg * Math.PI) / 180;
  const u = new THREE.Vector2(Math.cos(t), Math.sin(t));
  const n = new THREE.Vector2(-Math.sin(t), Math.cos(t));

  // ---- pectoral mayor: masa frontal del tórax, crece con la activación ----
  const chestC = new THREE.Vector2(H2.x + u.x * 0.68, H2.y + u.y * 0.68 + 0.16 * n.y);
  M.pec.position.set(chestC.x + n.x * 0.105, chestC.y + n.y * 0.105, 0.015);
  M.pec.quaternion.setFromUnitVectors(UPV, new THREE.Vector3(u.x, u.y, 0));
  const gp = 1 + 0.45 * act.p;
  M.pec.scale.set(0.038 * gp, 0.16, 0.055 * gp);
  paint(M.pecMat, HUES.p, act.p);

  // ---- eje del húmero y perpendiculares en el plano ----
  const uArm = new THREE.Vector2(E.x - S.x, E.y - S.y);
  const lUE = uArm.length() || 1;
  uArm.multiplyScalar(1 / lUE);
  const perpOut = new THREE.Vector2(uArm.y, -uArm.x);   // cara posterior/externa
  const perpIn = new THREE.Vector2(-uArm.y, uArm.x);    // cara del pecho

  // ---- deltoides anterior: gorro sobre el húmero proximal ----
  M.delt.position.set(S.x + uArm.x * 0.12 + perpOut.x * 0.012, S.y + uArm.y * 0.12 + perpOut.y * 0.012, 0.02);
  M.delt.quaternion.setFromUnitVectors(UPV, new THREE.Vector3(uArm.x, uArm.y, 0));
  const gd = 1 + 0.5 * act.d;
  M.delt.scale.set(0.055 * gd, 0.105, 0.05 * gd);
  paint(M.deltMat, HUES.d, act.d);

  // ---- tríceps: dos cabezas sobre el húmero (lateral y larga) ----
  const dirET = new THREE.Vector3(T.x - E.x, T.y - E.y, 0).normalize();
  placeSpindle(M.triLat,
    new THREE.Vector3(S.x + uArm.x * 0.10 + perpOut.x * 0.05, S.y + uArm.y * 0.10 + perpOut.y * 0.05, 0.015),
    new THREE.Vector3(E.x + dirET.x * 0.02, E.y + dirET.y * 0.02, 0.015),
    0.021 * (1 + 0.35 * act.t));
  placeSpindle(M.triLong,
    new THREE.Vector3(S.x + uArm.x * 0.02 + perpOut.x * 0.02, S.y + uArm.y * 0.02 + perpOut.y * 0.02, 0.01),
    new THREE.Vector3(E.x, E.y, 0.01),
    0.023 * (1 + 0.35 * act.t));
  paint(M.triMat, HUES.t, act.t);

  // ---- bíceps: huso del hombro al antebrazo, cara del pecho ----
  placeSpindle(M.bi,
    new THREE.Vector3(S.x + perpIn.x * 0.03, S.y + perpIn.y * 0.03, 0.03),
    new THREE.Vector3(E.x + dirET.x * 0.10, E.y + dirET.y * 0.10, 0.03),
    0.024 * (1 + 0.35 * act.b));
  paint(M.biMat, HUES.b, act.b);
}
