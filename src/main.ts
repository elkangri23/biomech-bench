// main.ts — escena Three.js + UI. Toda la lógica de activación vive en model.ts.
import * as THREE from 'three';
import datasetJson from '../data/exercises/bench-press.json';
import type { Dataset, Vec2 } from './model';
import { clamp, computeS, H, L1, L2, modelActivate, solveIKPure } from './model';
import { runEvals } from './evals';

const dataset = datasetJson as unknown as Dataset;
const ex = dataset.ejercicios['press-banca'];

// ---------- estado ----------
let thetaDeg = 15;                        // inclinación del banco
let weight = 60;
let grip = 1.0;                           // 0.70 estrecho … 1.30 ancho
let autoRep = false, repPhase = 0;        // fase de la repetición 0..1
let repSecs = 3;                          // cadencia: segundos por repetición
let S: Vec2 = computeS(thetaDeg);
let target: Vec2 = { x: S.x - 0.18, y: S.y + 0.45 };

// ---------- UI ----------
const $ = (id: string) => document.getElementById(id) as HTMLElement;
const stage = $('stage') as HTMLElement;
const ui = {
  p: [$('fp') as HTMLElement, $('vp') as HTMLElement],
  d: [$('fd') as HTMLElement, $('vd') as HTMLElement],
  t: [$('ft') as HTMLElement, $('vt') as HTMLElement],
  b: [$('fb') as HTMLElement, $('vb') as HTMLElement],
};

// ---------- escena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

scene.add(new THREE.AmbientLight(0xffffff, 1.4));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(1.5, 2.5, 6); scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 1.0); fill.position.set(-4, -1, 3); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.8); rim.position.set(0, -2, -4); scene.add(rim);

const UP = new THREE.Vector3(0, 1, 0);
function makeSeg(mat: THREE.Material, segs = 20): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, segs), mat);
  scene.add(m); return m;
}
function setSeg(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, r: number): void {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length() || 1e-4;
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  mesh.scale.set(r, len, r);
}
function makeBall(mat: THREE.Material, r: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat);
  scene.add(m); return m;
}

const boneMat  = new THREE.MeshStandardMaterial({ color: 0xb9bfc8, roughness: .55, metalness: .15 });
const boneMatF = new THREE.MeshStandardMaterial({ color: 0x7d848e, roughness: .65, metalness: .1 });
const jointMat = new THREE.MeshStandardMaterial({ color: 0x8892a0, roughness: .4, metalness: .3 });
const jointMatF= new THREE.MeshStandardMaterial({ color: 0x6b747f, roughness: .5, metalness: .2 });
const skinMat  = new THREE.MeshStandardMaterial({ color: 0xc4a084, roughness: .8 });
const benchMat = new THREE.MeshStandardMaterial({ color: 0x33383f, roughness: .9 });
const legMat   = new THREE.MeshStandardMaterial({ color: 0x272b31, roughness: .9 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x1d2025, roughness: 1 });
const pecMat   = new THREE.MeshStandardMaterial({ color: 0x6a7078, roughness: .75 });
const delMat   = new THREE.MeshStandardMaterial({ color: 0x6a7078, roughness: .75 });
const triMat   = new THREE.MeshStandardMaterial({ color: 0x6a7078, roughness: .75 });
const biMat    = new THREE.MeshStandardMaterial({ color: 0x6a7078, roughness: .75 });
const loadMat  = new THREE.MeshStandardMaterial({ color: 0x555b64, roughness: .4, metalness: .7 });
const HUES = { p: 0xe2574c, d: 0xd8a24a, t: 0x4c9de2, b: 0x8a6fd8 } as const;

const floor = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.04, 1.2), floorMat);
floor.position.set(-0.2, -0.02, -0.3);
scene.add(floor);

const plank = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 0.4), benchMat);
scene.add(plank);
const benchLeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1, 0.34), legMat);
const benchLeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1, 0.34), legMat);
scene.add(benchLeg1, benchLeg2);

const hips  = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.18, 6, 14), skinMat);
const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.30, 6, 14), skinMat);
const head  = makeBall(skinMat, 0.095);
const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.20, 6, 12), skinMat);
const calf  = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.22, 6, 12), skinMat);
scene.add(hips, chest, head, thigh, calf);

const upper = makeSeg(boneMat), fore = makeSeg(boneMat);
const shoulderBall = makeBall(jointMat, 0.055), elbowBall = makeBall(jointMat, 0.048);
const handBall = makeBall(jointMat, 0.042);
const pec = makeSeg(pecMat, 14);
const delt = makeBall(delMat, 0.06);
const triceps = makeSeg(triMat, 14);
const biceps = makeSeg(biMat, 14);

const upperF = makeSeg(boneMatF), foreF = makeSeg(boneMatF);
const elbowF = makeBall(jointMatF, 0.042), handF = makeBall(jointMatF, 0.036);
scene.add(upperF, foreF, elbowF, handF);

const dbGroup = new THREE.Group(); scene.add(dbGroup);
const barMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1, 12), loadMat);
barMesh.rotation.x = Math.PI / 2; dbGroup.add(barMesh);
const plateGeo = new THREE.TorusGeometry(0.13, 0.038, 12, 36);
const p1 = new THREE.Mesh(plateGeo, loadMat); dbGroup.add(p1);
const p2 = new THREE.Mesh(plateGeo, loadMat); dbGroup.add(p2);

// ---------- helpers de escena ----------
const v3 = (p: Vec2, z = 0) => new THREE.Vector3(p.x, p.y, z);
const HV = new THREE.Vector2(H.x, H.y);

function inclineNote(theta: number): string {   // datos reales: Rodríguez-Ridao et al. 2020 (Figura 3)
  if (theta < 15) return 'Plano: pectoral esternal (~28% MVIC) y deltoides (~26%) casi a la par; el esternal es el que más cae al inclinar.';
  if (theta <= 30) return 'Inclinado: el pectoral clavicular alcanza su pico (~30% MVIC a 30°) y el deltoides ya supera al esternal.';
  return 'Muy inclinado: deltoides anterior dominante (~33-34% MVIC); el esternal cae a ~6% a 60° — se parece a un press de hombros.';
}

function updateBench(): void {
  const t = (thetaDeg * Math.PI) / 180;
  const u = new THREE.Vector2(Math.cos(t), Math.sin(t));
  const n = new THREE.Vector2(-Math.sin(t), Math.cos(t));

  plank.rotation.z = t;
  plank.position.set(HV.x + u.x * 0.575, HV.y + u.y * 0.575, -0.28);

  for (const [leg, s] of [[benchLeg1, 0.12], [benchLeg2, 1.0]] as const) {
    const p = new THREE.Vector2(HV.x + u.x * s, HV.y + u.y * s);
    const h = Math.max(0.02, p.y - 0.03);
    leg.scale.y = h;
    leg.position.set(p.x, 0.03 + h / 2, -0.28);
  }

  hips.rotation.z = t - Math.PI / 2;
  hips.position.set(HV.x + u.x * 0.22, HV.y + u.y * 0.22 + 0.13 * n.y, -0.06);
  chest.rotation.z = t - Math.PI / 2;
  chest.position.set(HV.x + u.x * 0.68, HV.y + u.y * 0.68 + 0.16 * n.y, -0.06);
  head.position.set(chest.position.x + u.x * 0.40 + n.x * 0.06, chest.position.y + u.y * 0.40 + n.y * 0.06, -0.06);

  const hipP = new THREE.Vector2(HV.x + u.x * 0.10, HV.y + u.y * 0.10 + 0.05);
  const knee = new THREE.Vector2(HV.x + 0.30, HV.y - 0.04);
  const foot = new THREE.Vector2(HV.x + 0.18, 0.06);
  setSeg(thigh, new THREE.Vector3(hipP.x, hipP.y, -0.05), new THREE.Vector3(knee.x, knee.y, -0.05), 0.09);
  setSeg(calf, new THREE.Vector3(knee.x, knee.y, -0.05), new THREE.Vector3(foot.x, foot.y, -0.05), 0.065);

  S = computeS(thetaDeg);   // hombro desde la función pura (la usan también los evals)
  $('inote').textContent = inclineNote(thetaDeg);
}
updateBench();

function solveIK(): { E: Vec2; T: Vec2 } { return solveIKPure(S, target); }

function setMuscle(mesh: THREE.Mesh, mat: THREE.MeshStandardMaterial, a: THREE.Vector3, b: THREE.Vector3, baseR: number, act: number, hueKey: keyof typeof HUES): void {
  const r = baseR + baseR * 0.85 * act;
  setSeg(mesh, a, b, r);
  mat.color.set(0x6a7078).lerp(new THREE.Color(HUES[hueKey]), clamp(act, 0, 1));
  mat.emissive.set(HUES[hueKey]).multiplyScalar(act * 0.30);
}

// ---------- gráfica ----------
const chart = $('chart') as HTMLCanvasElement;
const ctx = chart.getContext('2d')!;
const MAXPTS = 320;
const hist: Record<'p' | 'd' | 't' | 'b', number[]> = { p: [], d: [], t: [], b: [] };
function pushHist(a: { p: number; d: number; t: number; b: number }): void {
  for (const k of ['p', 'd', 't', 'b'] as const) {
    hist[k].push(a[k]);
    if (hist[k].length > MAXPTS) hist[k].shift();
  }
}
function drawChart(): void {
  const w = chart.width, h = chart.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  ctx.lineWidth = 1;
  for (const gy of [0.25, 0.5, 0.75]) {
    ctx.beginPath(); ctx.moveTo(0, h - gy * h); ctx.lineTo(w, h - gy * h); ctx.stroke();
  }
  for (const k of ['p', 'd', 't', 'b'] as const) {
    const arr = hist[k];
    if (arr.length < 2) continue;
    ctx.strokeStyle = '#' + HUES[k].toString(16).padStart(6, '0');
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < arr.length; i++) {
      const x = (i / (MAXPTS - 1)) * w;
      const y = h - clamp(arr[i], 0, 1) * (h - 6) - 3;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// ---------- interacción ----------
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let dragging = false;

function pointerToWorld(ev: PointerEvent): void {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  if (ray.ray.intersectPlane(plane, p)) {
    target.x = clamp(p.x, S.x - 0.50, S.x + 0.35);
    target.y = clamp(p.y, S.y + 0.03, S.y + 0.95);   // el arrastre tampoco baja del pecho
  }
}
stage.addEventListener('pointerdown', (e) => { dragging = true; pointerToWorld(e); e.preventDefault(); });
window.addEventListener('pointerup', () => { dragging = false; });
stage.addEventListener('pointermove', (e) => {
  if (dragging) {
    if (autoRep) setAutoRep(false);   // solo si de verdad arrastras la barra
    pointerToWorld(e);
  }
});

const playBtn = $('play') as HTMLButtonElement;
function setAutoRep(on: boolean): void {
  autoRep = on;
  playBtn.textContent = on ? '⏸ Parar' : '▶ Repetición automática';
  playBtn.classList.toggle('stop', on);
  if (on) { repPhase = 0; for (const k of ['p', 'd', 't', 'b'] as const) hist[k].length = 0; }
}
playBtn.addEventListener('click', () => setAutoRep(!autoRep));

$('w').addEventListener('input', (e) => {
  weight = +(e.target as HTMLInputElement).value;
  $('wv').textContent = weight + ' kg';
});
$('inc').addEventListener('input', (e) => {
  thetaDeg = +(e.target as HTMLInputElement).value;
  $('iv').textContent = thetaDeg + '°';
  updateBench();
  showEvals();
});
$('cad').addEventListener('input', (e) => {
  repSecs = +(e.target as HTMLInputElement).value / 10;
  $('cv').textContent = repSecs.toFixed(1).replace('.', ',') + ' s / rep';
});
$('g').addEventListener('input', (e) => {
  grip = +(e.target as HTMLInputElement).value / 100;
  $('gv').textContent = grip <= 0.85 ? 'Estrecho' : grip <= 1.1 ? 'Normal' : 'Ancho';
  showEvals();
});

function showEvals(): void {
  const r = runEvals(dataset);
  $('evalOut').textContent = r.lines.join('\n');
}

// ---------- bucle ----------
function draw(dt: number): void {
  const t = (thetaDeg * Math.PI) / 180;
  const u = new THREE.Vector2(Math.cos(t), Math.sin(t));
  const n = new THREE.Vector2(-Math.sin(t), Math.cos(t));

  if (autoRep) {
    repPhase = (repPhase + dt / repSecs) % 1;
    const f = 0.5 + 0.5 * Math.cos(2 * Math.PI * repPhase);   // 1 arriba … 0 abajo … 1 arriba
    const bottom = { x: S.x - 0.16, y: S.y + 0.07 };
    const top = { x: S.x - 0.04, y: S.y + 0.55 };
    target.x = bottom.x + (top.x - bottom.x) * f;
    target.y = bottom.y + (top.y - bottom.y) * f;
  }

  const { E, T } = solveIK();
  const Sp = v3(S), Ep = v3(E), Tp = v3(T);

  setSeg(upper, Sp, Ep, 0.062);
  setSeg(fore, Ep, Tp, 0.05);
  shoulderBall.position.copy(Sp);
  elbowBall.position.copy(Ep);
  handBall.position.copy(Tp);
  delt.position.set(Sp.x + n.x * 0.03, Sp.y + n.y * 0.03 + 0.02, 0.04);

  // brazo lejano: mismas articulaciones, detrás de la barra
  setSeg(upperF, v3(S, -0.17), v3(E, -0.17), 0.052);
  setSeg(foreF, v3(E, -0.17), v3(T, -0.17), 0.042);
  elbowF.position.set(E.x, E.y, -0.17);
  handF.position.set(T.x, T.y, -0.17);

  const uLen = Math.hypot(S.x - E.x, S.y - E.y) || 1;
  const fLen = Math.hypot(T.x - E.x, T.y - E.y) || 1;
  const uArm = new THREE.Vector2((S.x - E.x) / uLen, (S.y - E.y) / uLen);
  const fArm = new THREE.Vector2((T.x - E.x) / fLen, (T.y - E.y) / fLen);
  const interior = Math.acos(clamp(uArm.dot(fArm), -1, 1));
  $('av').textContent = Math.round((interior * 180) / Math.PI) + '°';

  // única fuente de verdad: la escena usa el mismo modelo puro que los evals/tests
  const act = modelActivate(ex, { weight, thetaDeg, grip, S, T, E });
  const flexNorm = act.info.flexNorm;

  const dirET = new THREE.Vector3().subVectors(Tp, Ep).normalize();
  const pecA = new THREE.Vector3(HV.x + u.x * 0.72 + n.x * 0.02, HV.y + u.y * 0.72 + n.y * 0.02 + 0.05, 0.02);
  const pecB = Sp.clone().addScaledVector(new THREE.Vector3().subVectors(Ep, Sp).normalize(), 0.2);
  setMuscle(pec, pecMat, pecA, pecB, 0.028, act.p, 'p');

  delt.scale.setScalar(1 + act.d * 0.55);

  const triA = Sp.clone().add(new THREE.Vector3(uArm.y, -uArm.x, 0).multiplyScalar(0.035));
  const triB = Ep.clone().addScaledVector(dirET, 0.02);
  setMuscle(triceps, triMat, triA, triB, 0.034, act.t, 't');

  const biA = Sp.clone().add(new THREE.Vector3(-uArm.y, uArm.x, 0).multiplyScalar(0.025));
  const biB = Ep.clone().addScaledVector(dirET, 0.08);
  setMuscle(biceps, biMat, biA, biB, 0.03, act.b, 'b');

  dbGroup.position.copy(Tp);
  const pr = 0.10 + weight / 120 * 0.06;
  p1.scale.setScalar(pr / 0.13);
  p2.scale.setScalar(pr / 0.13);
  barMesh.scale.y = grip;                    // longitud de la barra según el agarre
  p1.position.z = 0.30 * grip;
  p2.position.z = -0.30 * grip;

  ui.p[0].style.width = (act.p * 100).toFixed(0) + '%'; ui.p[1].textContent = Math.round(act.p * 100) + '%';
  ui.d[0].style.width = (act.d * 100).toFixed(0) + '%'; ui.d[1].textContent = Math.round(act.d * 100) + '%';
  ui.t[0].style.width = (act.t * 100).toFixed(0) + '%'; ui.t[1].textContent = Math.round(act.t * 100) + '%';
  ui.b[0].style.width = (act.b * 100).toFixed(0) + '%'; ui.b[1].textContent = Math.round(act.b * 100) + '%';

  if (autoRep) { pushHist({ p: act.p, d: act.d, t: act.t, b: act.b }); drawChart(); }

  ($('lock') as HTMLElement).style.opacity = flexNorm < 0.12 ? '1' : '0';

  camera.position.set(S.x + 0.35, S.y + 0.10, 10);
}

function resize(): void {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px';
  renderer.domElement.style.height = h + 'px';
  const halfH = 0.82, aspect = w / h;
  camera.left = -halfH * aspect; camera.right = halfH * aspect;
  camera.top = halfH; camera.bottom = -halfH;
  camera.updateProjectionMatrix();
  const cw = (chart.parentElement as HTMLElement).clientWidth - 24;
  chart.width = Math.max(300, cw);
}
new ResizeObserver(resize).observe(stage);
resize();

let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  draw(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
showEvals();   // evaluación inicial del modelo

// L1/L2 importados para mantener visibilidad con model.ts (documentación de la IK)
void L1; void L2;
