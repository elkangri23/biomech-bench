// model.ts — modelo de activación del press banca
// Funciones puras: sin DOM, sin Three.js, sin estado global.
// La escena (main.ts) y los tests (model.test.ts) usan ESTAS mismas funciones.

export type Vec2 = { x: number; y: number };

export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

// longitudes de los segmentos del brazo (húmero, antebrazo) y punto de referencia del banco
export const L1 = 0.55;
export const L2 = 0.5;
export const H: Vec2 = { x: -0.80, y: 0.30 };

// ---------- tipos del dataset ----------

export interface EvalSpec {
  id: string;
  tipo: 'orden' | 'tendencia' | 'compara' | 'techo';
  descripcion: string;
  setup?: { inc: number; grip: number; fase: number };
  musculos?: string[];
  musculo?: 'p' | 'd' | 't' | 'b';
  dir?: 'sube' | 'baja';
  incs?: number[];
  grip?: number;
  fase?: number;
  a?: { inc: number; grip: number; fase: number };
  b?: { inc: number; grip: number; fase: number };
  esperado?: string;
  umbral?: number;
}

export interface Exercise {
  emg_inclinacion: {
    filas_angulos: number[];
    musculos: Record<string, (number | null)[]>;
    fuentes: string[];
  };
  brazos_momento_codo: {
    filas_angulos: number[];
    musculos: Record<string, number[]>;
    fuentes: string[];
  };
  calibracion: { kPec: number; kDelt: number; kTri: number; kBi: number };
  evals: EvalSpec[];
}

export interface Dataset {
  version: string;
  status: string;
  ejercicios: Record<string, Exercise>;
}

export interface Setup {
  weight: number;
  thetaDeg: number;
  grip: number;
  S: Vec2;
  T: Vec2;
  E: Vec2;
}

export interface Activation {
  p: number; d: number; t: number; b: number;
  info: { codo: number; flexNorm: number; tauS: number; tauE: number };
}

// ---------- funciones ----------

/** interpolación lineal sobre una tabla (xs ordenados) */
export function interp(xs: number[], ys: (number | null)[], x: number): number {
  // si hay huecos (null) cerca del extremo, usar el primer valor no nulo
  if (x <= xs[0]) return firstValid(ys, 1);
  if (x >= xs[xs.length - 1]) return firstValid(ys, -1);
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const f = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
      const a = ys[i - 1] ?? ys[i] ?? 0;
      const b = ys[i] ?? ys[i - 1] ?? 0;
      return a + f * (b - a);
    }
  }
  return firstValid(ys, -1);
}
function firstValid(ys: (number | null)[], dir: 1 | -1): number {
  const seq = dir === 1 ? ys : [...ys].reverse();
  for (const v of seq) if (v != null) return v;
  return 0;
}

/** posición del hombro según la inclinación del banco */
export function computeS(thetaDeg: number): Vec2 {
  const t = (thetaDeg * Math.PI) / 180;
  const u = { x: Math.cos(t), y: Math.sin(t) };
  const n = { x: -Math.sin(t), y: Math.cos(t) };
  return {
    x: H.x + u.x * 0.88 + n.x * 0.05,
    y: H.y + u.y * 0.88 + n.y * 0.05 + 0.10,
  };
}

/** cinemática inversa de 2 huesos: codo del lado del pecho (bajo la barra) */
export function solveIKPure(Sv: Vec2, Tv: Vec2): { E: Vec2; T: Vec2 } {
  const dx = Tv.x - Sv.x;
  const dy = Tv.y - Sv.y;
  let d = Math.hypot(dx, dy);
  d = clamp(d, Math.abs(L1 - L2) + 0.03, L1 + L2 - 0.004);
  const base = Math.atan2(dy, dx);
  const cosA = clamp((d * d + L1 * L1 - L2 * L2) / (2 * d * L1), -1, 1);
  const A = Math.acos(cosA);
  const ang = base + A;
  return {
    E: { x: Sv.x + L1 * Math.cos(ang), y: Sv.y + L1 * Math.sin(ang) },
    T: { x: Sv.x + d * Math.cos(base), y: Sv.y + d * Math.sin(base) },
  };
}

/** recorrido de la barra: fondo y top, relativos al hombro; fase 0..1 */
export function makeSetup(inc: number, grip: number, fase: number): Setup {
  const Sv = computeS(inc);
  const bottom = { x: Sv.x - 0.16, y: Sv.y + 0.07 };   // fondo: algo por encima del pecho
  const top = { x: Sv.x - 0.04, y: Sv.y + 0.55 };
  const T: Vec2 = {
    x: bottom.x + (top.x - bottom.x) * fase,
    y: bottom.y + (top.y - bottom.y) * fase,
  };
  const { E } = solveIKPure(Sv, T);
  return { weight: 60, thetaDeg: inc, grip, S: Sv, T, E };
}

/**
 * modelo de activación: función pura alimentada por el dataset.
 * momento = carga × palanca horizontal; %MVIC por inclinación modula;
 * brazo de momento por ángulo de codo modula tríceps/bíceps; agarre mueve el reparto.
 */
export function modelActivate(ex: Exercise, params: Setup): Activation {
  const Sv = params.S, Tv = params.T, Ev = params.E;
  const emg = ex.emg_inclinacion;
  const ma = ex.brazos_momento_codo;
  const cal = ex.calibracion;

  const F = (params.weight * 9.81) / 60;
  const tauS = F * Math.abs(Tv.x - Sv.x);
  const tauE = F * Math.abs(Tv.x - Ev.x);

  const uLen = Math.hypot(Sv.x - Ev.x, Sv.y - Ev.y) || 1;
  const fLen = Math.hypot(Tv.x - Ev.x, Tv.y - Ev.y) || 1;
  const uArm = { x: (Sv.x - Ev.x) / uLen, y: (Sv.y - Ev.y) / uLen };
  const fArm = { x: (Tv.x - Ev.x) / fLen, y: (Tv.y - Ev.y) / fLen };
  const codoDeg = (Math.acos(clamp(uArm.x * fArm.x + uArm.y * fArm.y, -1, 1)) * 180) / Math.PI;
  const flexNorm = clamp((Math.PI - (codoDeg * Math.PI) / 180) / 2.2, 0, 1);

  // %MVIC por inclinación (interpolado); el "Pectoral" de la barra es la porción esternal
  const emgPec = interp(emg.filas_angulos, emg.musculos['pectoral-esternal'], params.thetaDeg) / 100;
  const emgDelt = interp(emg.filas_angulos, emg.musculos['deltoides-anterior'], params.thetaDeg) / 100;
  const emgTri = interp(emg.filas_angulos, emg.musculos['triceps-braquial'], params.thetaDeg) / 100;
  const pecBase = (emg.musculos['pectoral-esternal'][0] ?? 100) / 100;
  const deltBase = (emg.musculos['deltoides-anterior'][0] ?? 100) / 100;
  const triBase = (emg.musculos['triceps-braquial'][0] ?? 100) / 100;

  // brazos de momento por ángulo de codo, normalizados a su máximo
  const triMax = Math.max(...ma.musculos['triceps-braquial']);
  const biMax = Math.max(...ma.musculos['biceps-braquial']);
  const maTri = interp(ma.filas_angulos, ma.musculos['triceps-braquial'], codoDeg) / triMax;
  const maBi = interp(ma.filas_angulos, ma.musculos['biceps-braquial'], codoDeg) / biMax;

  const gK = (params.grip - 0.7) / 0.6;

  const baseP = 0.55 * clamp(tauS / 0.55, 0, 1) + 0.45 * flexNorm;
  const aP = clamp((baseP * (emgPec / pecBase) * (0.88 + 0.24 * gK)) / cal.kPec, 0, 1);
  const aD = clamp(
    (clamp(tauS / 0.7, 0, 1) * (1 - 0.5 * flexNorm) * (emgDelt / deltBase) * (1 + 0.10 * gK)) / cal.kDelt,
    0, 1
  );
  const aT = clamp(
    (((1 - flexNorm) * 0.75 + 0.25 * clamp(tauE / 0.8, 0, 1)) *
      (1.12 - 0.24 * gK) * (0.85 + 0.15 * maTri) * (emgTri / triBase)) / cal.kTri,
    0, 1
  );

  // bíceps: freno excéntrico en flexión profunda (fondo del recorrido);
  // la flexión profunda manda, el brazo de momento modula (60/40)
  const codoRad = (codoDeg * Math.PI) / 180;
  const flexDeep = clamp((1.8 - codoRad) / 1.3, 0, 1);
  const aB = clamp((flexDeep * (0.4 + 0.6 * maBi) * clamp(tauE / 0.6, 0, 1) * 0.5) / cal.kBi, 0, 1);

  return { p: aP, d: aD, t: aT, b: aB, info: { codo: Math.round(codoDeg), flexNorm, tauS, tauE } };
}
