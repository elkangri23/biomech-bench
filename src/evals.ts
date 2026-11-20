// evals.ts — ¿contradice el modelo la evidencia del dataset?
// Sin DOM: lo usan el panel del navegador (main.ts) y los tests de vitest.
import type { Dataset, EvalSpec } from './model';
import { makeSetup, modelActivate } from './model';

export function checkEval(ex: Dataset['ejercicios'][string], ev: EvalSpec): boolean {
  const val = (s?: { inc?: number; grip?: number; fase?: number }) =>
    modelActivate(ex, makeSetup(s?.inc ?? 15, s?.grip ?? 1.0, s?.fase ?? 0.10));

  switch (ev.tipo) {
    case 'orden': {
      const acts = (ev.musculos ?? []).map((id) => val(ev.setup)[id as 'p']);
      return acts.every((v, i) => i === 0 || acts[i - 1] > v);
    }
    case 'tendencia': {
      const vals = (ev.incs ?? []).map((inc) =>
        val({ inc, grip: ev.grip, fase: ev.fase })[ev.musculo as 'p']
      );
      return ev.dir === 'sube'
        ? vals.every((v, i) => i === 0 || vals[i - 1] < v)
        : vals.every((v, i) => i === 0 || vals[i - 1] > v);
    }
    case 'compara':
      return val(ev.a)[ev.musculo as 'p'] > val(ev.b)[ev.musculo as 'p'];
    case 'techo':
      return val(ev.setup)[ev.musculo as 'p'] < (ev.umbral ?? 1);
  }
  return false;
}

export function runEvals(dataset: Dataset): { ok: number; total: number; lines: string[] } {
  const ex = dataset.ejercicios['press-banca'];
  const lines: string[] = [];
  let ok = 0;
  for (const ev of ex.evals) {
    const pass = checkEval(ex, ev);
    if (pass) ok++;
    lines.push((pass ? '✅ ' : '❌ ') + ev.id + ' — ' + ev.descripcion);
  }
  lines.push('—————');
  const emgReal = dataset.status.startsWith('EMG VERIFICADO');
  lines.push(
    ok + '/' + ex.evals.length + ' checks correctos ' +
    (emgReal ? '(EMG real: Rodríguez-Ridao 2020; brazos de momento orientativos)' : '(dataset PLACEHOLDER)')
  );
  return { ok, total: ex.evals.length, lines };
}
