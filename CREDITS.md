# Créditos y licencias por componente

| Componente | Ruta | Licencia | Origen |
|---|---|---|---|
| Código del proyecto (`src/`, `index.html`, `tsconfig.json`) | — | **Unlicense** (dominio público) | propio |
| Dataset con valores digitalizados (`data/`) | `data/exercises/bench-press.json` | **CC0 1.0** | propio; fuentes de los estudios citadas dentro del JSON |
| Mallas anatómicas de BodyParts3D (integradas) | `public/models/bp3d/` | **CC-BY-SA 2.1 Japón** | © The Database Center for Life Science (DBCLS) — `lifesciencedb.jp/bp3d` |
| Biblioteca three.js | `node_modules/three` | MIT | © three.js authors |

## Obligaciones concretas de BodyParts3D

Si redistribuyes las mallas de `public/models/bp3d/` (solas o dentro de una build), debes
mostrar este crédito:

> BodyParts3D, © The Database Center for Life Science, licensed under CC 表示-継承 2.1 日本
> (CC-BY-SA 2.1 Japan) — http://lifesciencedb.jp/bp3d

Además, cualquier obra derivada **de esas mallas** debe redistribuirse bajo la misma
licencia CC-BY-SA 2.1 JP (share-alike). El resto del proyecto (código, datos propios,
documentación) no se ve afectado: sigue en dominio público y puedes usarlo con o sin
atribución.
