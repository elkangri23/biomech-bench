// musclesBP3D.ts — écorché con mallas anatómicas reales de BodyParts3D (CC-BY-SA 2.1 JP).
// Cada malla se "estampa" (affine) entre sus puntos de origen e inserción, siguiendo la IK:
// la geometría se hornéó offline con eje largo = +Y y longitud unitaria, así que el runtime
// solo tiene que orientar local +Y hacia (inserción − origen) y escalar a la distancia.
// Fallback: si las mallas no cargan, main.ts usa el écorché procedural de muscles.ts.
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { HUES, paint } from './muscles';

const BASE = 0x6a7078;
const YUP = new THREE.Vector3(0, 1, 0);
const Z_CAM = new THREE.Vector3(0, 0, 1);
const H2 = new THREE.Vector2(-0.80, 0.30);

interface Part { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; }

export interface BP3DMuscles {
  humerus: THREE.Mesh; humerusMat: THREE.MeshStandardMaterial;
  pecS: Part; pecC: Part;
  delt: Part;
  triLat: Part; triLong: Part; triMed: Part; triMat: THREE.MeshStandardMaterial;
  biLong: Part; biShort: Part; biMat: THREE.MeshStandardMaterial;
}

async function loadOBJ(url: string): Promise<THREE.BufferGeometry> {
  const text = await (await fetch(url)).text();
  const obj = new OBJLoader().parse(text);
  const child = obj.children[0] as THREE.Mesh;
  return child.geometry;
}

function mkPart(geo: THREE.BufferGeometry): Part {
  const mat = new THREE.MeshStandardMaterial({ color: BASE, roughness: .55 });
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, mat };
}

export async function createBP3DMuscles(scene: THREE.Scene, urlPrefix: string): Promise<BP3DMuscles> {
  const names = ['humerus', 'pec-sternal', 'pec-clavicular', 'deltoid-anterior', 'tri-lateral', 'tri-long', 'tri-medial', 'bi-long', 'bi-short'];
  const geos = await Promise.all(names.map((n) => loadOBJ(`${urlPrefix}${n}.obj`)));
  const [humGeo, pecSGeo, pecCGeo, deltGeo, triLatGeo, triLongGeo, triMedGeo, biLongGeo, biShortGeo] = geos;

  const humerusMat = new THREE.MeshStandardMaterial({ color: 0xb9bfc8, roughness: .5, metalness: .15 });
  const humerus = new THREE.Mesh(humGeo, humerusMat);

  const pecS = mkPart(pecSGeo);
  const pecC = mkPart(pecCGeo);
  const delt = mkPart(deltGeo);
  const triMat = new THREE.MeshStandardMaterial({ color: BASE, roughness: .55 });
  const triLat = { mesh: new THREE.Mesh(triLatGeo, triMat), mat: triMat };
  const triLong = { mesh: new THREE.Mesh(triLongGeo, triMat), mat: triMat };
  const triMed = { mesh: new THREE.Mesh(triMedGeo, triMat), mat: triMat };
  const biMat = new THREE.MeshStandardMaterial({ color: BASE, roughness: .55 });
  const biLong = { mesh: new THREE.Mesh(biLongGeo, biMat), mat: biMat };
  const biShort = { mesh: new THREE.Mesh(biShortGeo, biMat), mat: biMat };

  scene.add(humerus, pecS.mesh, pecC.mesh, delt.mesh, triLat.mesh, triLong.mesh, triMed.mesh, biLong.mesh, biShort.mesh);

  return {
    humerus, humerusMat,
    pecS, pecC, delt, triLat, triLong, triMed, triMat, biLong, biShort, biMat,
  };
}

function place(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, opts: { flat?: THREE.Vector3; zBoost?: number; bulge?: number } = {}): void {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length() || 1e-4;
  dir.normalize();
  mesh.position.copy(a).addScaledVector(dir, len * 0.5);
  if (opts.flat) {
    // orientación determinista: local Y → dir; el eje 'flat' (local Z) se proyecta al plano ⊥ dir,
    // así el abanico plano del pectoral siempre mira de frente a la cámara
    const zv = opts.flat.clone().addScaledVector(dir, -opts.flat.dot(dir)).normalize();
    const xv = new THREE.Vector3().crossVectors(dir, zv).normalize();
    const m = new THREE.Matrix4().makeBasis(xv, dir, zv);
    mesh.quaternion.setFromRotationMatrix(m);
  } else {
    mesh.quaternion.setFromUnitVectors(YUP, dir);
  }
  const zb = opts.zBoost ?? 1;
  const bu = 1 + (opts.bulge ?? 0);   // abultamiento al activarse: crece la sección, no el largo
  mesh.scale.set(len * bu, len, len * zb * bu);
}

export function updateBP3DMuscles(
  M: BP3DMuscles,
  S: { x: number; y: number }, E: { x: number; y: number }, T: { x: number; y: number },
  thetaDeg: number,
  act: { p: number; d: number; t: number; b: number }
): void {
  const t = (thetaDeg * Math.PI) / 180;
  const u = new THREE.Vector2(Math.cos(t), Math.sin(t));
  const n = new THREE.Vector2(-Math.sin(t), Math.cos(t));
  const chestC = new THREE.Vector2(H2.x + u.x * 0.68, H2.y + u.y * 0.68 + 0.16 * n.y);

  const uArm = new THREE.Vector2(E.x - S.x, E.y - S.y);
  const lUE = uArm.length() || 1;
  uArm.multiplyScalar(1 / lUE);

  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // húmero: sigue el segmento S→E (no escala por activación)
  place(M.humerus, V(S.x, S.y, 0), V(E.x, E.y, 0));

  // pectoral esternal: del esternón (borde inferior-medial del pecho) a la inserción humeral
  place(M.pecS.mesh,
    V(chestC.x - u.x * 0.32 + n.x * 0.01, chestC.y - u.y * 0.32 + n.y * 0.01, 0.105),
    V(S.x + uArm.x * 0.20, S.y + uArm.y * 0.20, 0.075),
    { flat: Z_CAM, bulge: 0.10 * act.p });
  paint(M.pecS.mat, HUES.p, act.p);

  // pectoral clavicular: de la clavícula (parte alta del pecho) a la cresta del húmero
  place(M.pecC.mesh,
    V(chestC.x + u.x * 0.22 + n.x * 0.02, chestC.y + u.y * 0.22 + n.y * 0.02, 0.11),
    V(S.x + uArm.x * 0.08, S.y + uArm.y * 0.08, 0.075),
    { flat: Z_CAM, bulge: 0.10 * act.p });
  paint(M.pecC.mat, HUES.p, act.p);

  // deltoides anterior: capucha centrada sobre el eje del húmero, tercio proximal
  place(M.delt.mesh,
    V(S.x + uArm.x * 0.06, S.y + uArm.y * 0.06, 0.03),
    V(S.x + uArm.x * 0.36, S.y + uArm.y * 0.36, 0.028),
    { zBoost: 1.15, bulge: 0.30 * act.d });
  paint(M.delt.mat, HUES.d, act.d);

  // tríceps: tres cabezas centradas en el eje del húmero (abraza el brazo por detrás);
  // terminan en el codo para no flotar sobre el antebrazo al plegarse
  place(M.triLat.mesh,
    V(S.x + uArm.x * 0.30, S.y + uArm.y * 0.30, -0.02),
    V(E.x - uArm.x * 0.04, E.y - uArm.y * 0.04, -0.018),
    { zBoost: 1.6, bulge: 0.30 * act.t });
  place(M.triLong.mesh,
    V(S.x + uArm.x * 0.05, S.y + uArm.y * 0.05, -0.024),
    V(E.x - uArm.x * 0.04, E.y - uArm.y * 0.04, -0.022),
    { zBoost: 1.7, bulge: 0.30 * act.t });
  place(M.triMed.mesh,
    V(S.x + uArm.x * 0.44, S.y + uArm.y * 0.44, -0.03),
    V(E.x - uArm.x * 0.04, E.y - uArm.y * 0.04, -0.028),
    { zBoost: 2.0, bulge: 0.30 * act.t });
  paint(M.triMat, HUES.t, act.t);

  // bíceps: dos cabezas centradas en el eje del húmero, cara anterior (+z hacia cámara);
  // terminan en el codo, el vientre no cruza la articulación
  place(M.biLong.mesh,
    V(S.x + uArm.x * 0.04, S.y + uArm.y * 0.04, 0.03),
    V(E.x - uArm.x * 0.03, E.y - uArm.y * 0.03, 0.028),
    { zBoost: 1.9, bulge: 0.35 * act.b });
  place(M.biShort.mesh,
    V(S.x + uArm.x * 0.10, S.y + uArm.y * 0.10, 0.034),
    V(E.x - uArm.x * 0.03, E.y - uArm.y * 0.03, 0.032),
    { zBoost: 2.0, bulge: 0.35 * act.b });
  paint(M.biMat, HUES.b, act.b);
}
