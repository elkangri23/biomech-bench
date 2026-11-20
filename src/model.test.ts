// tests del modelo — los mismos 8 evals del panel, ahora como tests de vitest
// el dataset que se testea es el MISMO fichero JSON que consume la app
import { describe, it, expect } from 'vitest';
import datasetJson from '../data/exercises/bench-press.json';
import type { Dataset } from './model';
import { makeSetup, modelActivate } from './model';
import { checkEval } from './evals';

const dataset = datasetJson as unknown as Dataset;
const ex = dataset.ejercicios['press-banca'];
const act = (inc: number, grip = 1.0, fase = 0.10) => modelActivate(ex, makeSetup(inc, grip, fase));

describe('evals: el modelo no contradice la evidencia del dataset', () => {
  for (const ev of ex.evals) {
    it(`eval ${ev.id} — ${ev.descripcion}`, () => {
      expect(checkEval(ex, ev)).toBe(true);
    });
  }

  it('hay exactamente 8 evals definidos', () => {
    expect(ex.evals).toHaveLength(8);
  });

  it('los datos EMG llevan fuente citada con DOI', () => {
    expect(ex.emg_inclinacion.fuentes.join(' ')).toMatch(/doi:/i);
    expect(ex.emg_inclinacion.fuentes.join(' ')).toMatch(/Rodríguez-Ridao/i);
  });

  it('el deltoides hace meseta a ~33-34% MVIC de 30° a 60° (hallazgo del estudio)', () => {
    const delt = ex.emg_inclinacion.musculos['deltoides-anterior'] as number[];
    const meseta = Math.abs(delt[3] - delt[4]) < 1.5;
    expect(meseta).toBe(true);
  });

  it('el tríceps es plano entre inclinaciones (sin diferencias significativas en el estudio)', () => {
    const tri = ex.emg_inclinacion.musculos['triceps-braquial'] as number[];
    const spread = Math.max(...tri) - Math.min(...tri);
    expect(spread).toBeLessThan(1.5);
  });

  it('sanity: activaciones en [0,1] y ángulo de codo coherente en todo el recorrido', () => {
    for (const inc of [0, 15, 30, 45, 60]) {
      for (const fase of [0.05, 0.5, 0.95]) {
        const a = act(inc, 1.0, fase);
        for (const k of ['p', 'd', 't', 'b'] as const) {
          expect(a[k]).toBeGreaterThanOrEqual(0);
          expect(a[k]).toBeLessThanOrEqual(1);
        }
        expect(a.info.codo).toBeGreaterThan(5);
        expect(a.info.codo).toBeLessThan(180);
      }
    }
  });
});
