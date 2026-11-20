# biomech-bench

Prototipo biomecánico interactivo del **press banca**: un brazo articulado en el navegador
(Three.js) que muestra cómo se activan pectoral, deltoides anterior, tríceps y bíceps según
la carga, la inclinación del banco, el ancho de agarre y la fase de la repetición.

**Modelo esquemático** (cápsulas/cilindros), no anatomía real. Físicamente creíble, ilustrativo.

## Qué lo hace diferente: datos con evidencia y evals

- El modelo de activación es una **función pura** (`src/model.ts`) compartida por la escena
  y por los tests. Un solo punto de verdad: si tocas un coeficiente, la escena y los tests
  cambian juntos.
- El dataset (`data/exercises/bench-press.json`) declara el **estado de cada número**:
  - `%MVIC por inclinación` — **verificado**: Rodríguez-Ridao et al. 2020,
    *Int J Environ Res Public Health* 17(19):7339, doi:10.3390/ijerph17197339
    (30 sujetos entrenados, 60% 1RM, EMG superficial, 0/15/30/45/60°; valores digitalizados
    de su Figura 3, ±0.5% MVIC).
  - `brazos_momento_codo` — **orientativo**: forma según An et al. 1981
    (J Biomech 14(10):659-669, doi:10.1016/0021-9290(81)90048-8); tabla numérica exacta pendiente.
  - Apoyo cualitativo para el agarre: Barnett et al. 1995 (JSCR 9(4):222-227).
- Los **8 evals** comprueban que el modelo no contradice la evidencia (orden de dominancia,
  tendencias con la inclinación, efectos del agarre). Corren en vivo en el panel del navegador
  y como tests de vitest: mismo código (`src/evals.ts`).

## Scripts

```bash
pnpm install
pnpm dev      # servidor de desarrollo
pnpm test     # los evals + sanity checks (vitest)
pnpm build    # tsc + bundle de producción
pnpm preview  # sirve el build
```

## Estructura

```
index.html                      UI (stage, gráfica, panel de evals, sliders)
src/
  model.ts                      funciones puras: interp, computeS, solveIKPure, modelActivate
  evals.ts                      checkEval / runEvals (sin DOM)
  main.ts                       escena Three.js + interacción
  model.test.ts                 los 8 evals como tests + sanity del dataset
data/
  exercises/bench-press.json    el dataset (única fuente de datos, con fuentes por número)
```

## Estado del proyecto

- **Nivel 1** (esquemático interactivo): completo.
- **Nivel 3** (modelo alimentado por datos + evals): completo, EMG verificado.
- **Nivel 4** (plataforma): este repo. Vite + TS sin sobre-arquitectura.
- **Nivel 2** (visual écorché): pendiente; requiere investigar licencias de malla antes.

## Honestidad del modelo

- Vista lateral esquemática: el codo se pliega "hacia el pecho" por claridad; el ángulo del
  húmero del dibujo NO es la flexión anatómica del hombro (por eso no se modelan brazos de
  momento de hombro aquí — ver el cierre del nivel 3).
- El bíceps no tiene dato EMG (el estudio no lo midió); se modela por flexión profunda del
  codo + brazo de momento.
- Los valores %MVIC están digitalizados de una figura publicada: aproximación ±0.5%.
