# biomech-bench

Prototipo biomecánico interactivo del **press banca**: cómo se activan los músculos durante
la repetición, en el navegador, con datos citados y un modelo que se audita a sí mismo.

> Un brazo articulado (Three.js) muestra la activación de pectoral, deltoides anterior,
> tríceps y bíceps según carga, inclinación del banco, ancho de agarre y fase de la
> repetición — alimentado por EMG real y verificado por 8 checks automáticos.

---

## Para qué se ha construido

biomech-bench nace de una pregunta sencilla que ninguna web de fitness responde bien:
**"¿qué músculo trabaja más si inclino el banco, o si abro el agarre?"**

Las respuestas habituales en internet son afirmaciones sin fuente ("el inclinado trabaja
el pecho superior" ✍️). Este proyecto construye la respuesta de otra manera:

1. **Un modelo biomecánico simplificado pero explícito** (palancas, %MVIC, brazos de momento).
2. **Un dataset con evidencia citada** — cada número lleva su estudio y su estado
   (verificado / orientativo / no medido).
3. **Evals**: afirmaciones verificables contra la evidencia que el modelo debe cumplir.
   Si el modelo contradice el estudio, un ❌ aparece en pantalla (y un test falla en CI).

Además de la pregunta, el proyecto persigue dos objetivos de quien lo construye:

- **Aprender**: biomecánica, modelado de datos con evidencia, y una arquitectura donde
  escena, panel y tests comparten exactamente la misma función de activación.
- **Mostrar**: una demo que se entiende en 30 segundos, se puede poner delante de alguien
  (del gym o del trabajo) y que demuestra un enfoque: *cada dato con fuente, cada
  afirmación con su check*.

## Qué funciona hoy

| Funcionalidad | Estado |
|---|---|
| Escena interactiva (Three.js): brazo con IK de 2 huesos, banco inclinable 0–60°, barra arrastrable y repetición automática con cadencia ajustable | ✅ |
| Activación muscular en vivo: 4 barras + gráfica temporal durante la repetición + brillo del músculo activo en la escena | ✅ |
| Modelo de activación como función pura (`src/model.ts`), única fuente de verdad para escena, panel y tests | ✅ |
| Dataset verificado: %MVIC por inclinación (0/15/30/45/60°) de **Rodríguez-Ridao et al. 2020** (doi:10.3390/ijerph17197339), digitalizado de su Figura 3 (±0.5%) | ✅ |
| 8 evals contra la evidencia (dominancia pectoral en plano, deltoides a 60°, tendencias con la inclinación, efectos del agarre) | ✅ 8/8 |
| Los mismos 8 evals + sanity del dataset como **tests de vitest** (13 tests) | ✅ |
| Hallazgos reales reflejados: pico del pectoral clavicular a 30°, meseta del deltoides ~33–34% MVIC, tríceps plano entre inclinaciones | ✅ |
| Build de producción (Vite + TypeScript strict) | ✅ |

## Qué es cada pieza

```
index.html                      UI (escena, gráfica, panel de evals, sliders)
src/
  model.ts                      funciones puras: interp, computeS, solveIKPure, modelActivate
  evals.ts                      checkEval / runEvals — sin DOM; los usan el panel y los tests
  main.ts                       escena Three.js + interacción
  model.test.ts                 los 8 evals + sanity del dataset como tests
data/
  exercises/bench-press.json    el dataset: única fuente de datos, con fuentes por número
```

El dato importante de la arquitectura: `modelActivate()` no sabe si la llaman el bucle de
render, el panel de evals o un test de CI. Cambiar un coeficiente cambia las tres cosas a la
vez — y los evals te dicen inmediatamente si lo nuevo contradice el estudio.

## Estado de los datos (honestidad primero)

| Bloque de datos | Estado | Fuente |
|---|---|---|
| EMG por inclinación (pectoral esternal/clavicular, deltoides anterior, tríceps) | ✅ verificado | Rodríguez-Ridao et al. 2020, open access, 30 sujetos entrenados, 60% 1RM |
| Brazos de momento del codo (tríceps, bíceps) | ⚠️ orientativo (forma correcta, valores pendientes) | An et al. 1981, doi:10.1016/0021-9290(81)90048-8 (tabla tras paywall) |
| Efectos del ancho de agarre | ⚠️ cualitativo | Barnett et al. 1995 (JSCR 9(4):222-227) |
| EMG del bíceps | ❌ no medido en el estudio; el modelo no lo usa (va por flexión profunda + brazo de momento) | — |

Limitaciones declaradas del modelo:

- Vista lateral **esquemática** (cápsulas): el ángulo del húmero del dibujo no es la flexión
  anatómica del hombro — por eso no se modelan brazos de momento de hombro en 2D (decisión
  documentada en el cierre del nivel 3; fuentes guardadas: Hik et al. 2019, doi:10.1111/joa.12903).
- El recorrido de la barra y las palancas son aproximaciones geométricas del modelo.
- Los %MVIC provienen de la digitalización de una figura publicada.

## Pendiente (roadmap)

Corto plazo:

- [ ] Publicar el repo + deploy (GitHub Pages o Vercel) para que la demo sea un enlace.
- [ ] Separar la barra "Pectoral" en esternal/clavicular (el dataset ya distingue ambas porciones).
- [ ] Extraer la tabla numérica exacta de brazos de momento del codo (An et al. 1981 / OpenSim).

Medio plazo — Nivel 2 (visual):

- [ ] Écorché: sustituir las cápsulas por mallas musculares reales (estampadas entre puntos
  de origen e inserción, siguiendo la IK). **Regla del proyecto: primero licencia, después código.**
  Candidatas: BodyParts3D (CC-BY-SA 2.1 JP), Z-Anatomy (CC-BY-SA).

Más adelante:

- [ ] Más ejercicios con el mismo formato (`data/exercises/<ejercicio>.json` + evals propios):
  press militar, sentadilla, dominadas — la plataforma crece por datos, no por código.
- [ ] Modelo en 3D o vista frontal para poder usar brazos de momento anatómicos reales.
- [ ] Referencias cruzadas: cada eval enlazando al estudio que lo respalda.

## A dónde queremos llegar

Que biomech-bench sea una **plataforma de biomecánica verificable**: cada ejercicio es un
dataset citado + un modelo + sus evals, y la web es solo la vista de arriba. El criterio de
calidad es el del proyecto desde el primer día: *esquemático pero honesto* — mejor un
muñeco de cápsulas que no miente con su evidencia que un cuerpo bonito que la contradice.

---

## Scripts

```bash
pnpm install
pnpm dev      # servidor de desarrollo
pnpm test     # evals + sanity checks (vitest)
pnpm build    # tsc + bundle de producción
pnpm preview  # sirve el build
```

## Licencia y créditos

- Código del proyecto: por definir (MIT recomendado).
- Datos: los estudios citados conservan sus licencias; los %MVIC se citan con la fuente
  original y se usan con fines ilustrativos.
- Malla `three.module.js` incluida en el repo raíz del prototipo solo como respaldo offline
  del desarrollo anterior; el repo usa `three` de npm.
