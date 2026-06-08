# Notes d'iteració

## Iteració 5 — pivot a WebGL/Three.js + fluid simulation

### Per què

Quatre iteracions amb Canvas 2D (camp d'agents, particle system, physarum, paramecio canvas2D) van topar amb el sostre del realisme orgànic: les primitives geomètriques no produeixen el caos translúcid de la microscòpia. L'usuari va donar carta blanca per saltar de stack: WebGL/Three.js + fluid simulation real + soft body + shaders procedurals.

### Stack triat

- **Three.js 0.165** carregat via importmap (sense bundler — segueix funcionant amb `python3 -m http.server`).
- **WebGL2** amb `HalfFloatType` render targets.
- **Stam stable fluids** sobre GPU amb ping-pong FBOs.
- *Pendent*: soft body del paramecio amb masses + springs + Verlet; shader procedural del cos.

### Estructura del repo

```
src/
├── main.js                  # App: setup renderer, fluid, input, UI loop
├── solutes.js               # tipus de solutos (per al paramecio)
├── style.css
├── fluid/
│   ├── fluidSim.js          # Class FluidSim — orquestra pipeline Stam
│   └── shaders.js           # GLSL fragment shaders inline com a strings
└── paramecio/               # (buit per ara — vindrà l'organisme aquí)
```

### Pipeline del fluid (per frame)

1. Curl + vorticity confinement (reinyecta detall fi).
2. Divergence del camp de velocitats.
3. Solve pressure (Jacobi, 24 iteracions).
4. Subtract pressure gradient → velocitat divergence-free.
5. Advect velocity by itself (semi-Lagrangian).
6. Advect dye by velocity.

Input de l'usuari: cada `pointermove` durant `pointerDown` fa `splat()` que injecta velocitat (dx,dy del cursor) i tinta (color del soluto seleccionat).

### Paràmetres triats (iteració inicial)

- `simRes: 170` (velocitat/pressió a ~270×170 horitzontal).
- `dyeRes: 640` (tinta a ~1024×640 — visualment fina).
- `pressureIterations: 24`.
- `velDissipation: 0.992`, `dyeDissipation: 0.987` (la tinta dura una mica més que la velocitat).
- `curlStrength: 30` (vortices visibles, no caòtics).

### Per provar ara

1. Refrescar `localhost:8000`.
2. **Sense tocar**: cada 1.5–4 s apareix un estímul automàtic petit que ondula el fluid.
3. **Arrossegar amb el cursor**: traça de tinta del color del soluto. La tinta es difon, fa remolins, segueix les corrents.
4. **Canviar de soluto**: diferents colors es mesclen al medi.

### Pendent (iteracions properes)

- **Paramecio com a soft body**: malla de masses + springs amb Verlet, ~200–400 nodes.
- **Cilis procedurals**: aplicats sobre el contorn del soft body, baten amb ona metacrònica i **injecten velocitat al fluid** als seus punts d'acció (acoblament bidireccional cèl·lula↔medi).
- **Shader del cos**: render del soft body amb noise procedural multi-octava, translucidesa, granularitat.
- **Quimiotaxi**: el paramecio llegeix el camp de soluto via readback ocasional (per evitar stall) o via càlcul al shader que escriu informació en una textura accessible.
- **Habituació**: nivell d'adaptació per canal de soluto al CPU; modula la força dels cilis.
- **Mirror CPU dels solutos**: per fer la lectura del paramecio sense readback de GPU, el solver pot mantenir una versió de baixa resolució al CPU sincronitzada.

### Historial

- Iter 1: camp estàtic d'agents Canvas 2D. Conceptualment correcte; visualment massa subtil.
- Iter 2: particle system Canvas 2D amb física. Encara semblaven punts solts.
- Iter 3: physarum Canvas 2D. Es llegia com "llamarades stellars", no com organisme.
- Iter 4: paramecio Canvas 2D amb anatomia detallada. Tenia forma reconeixible però "parvulària"; va xocar amb el valle inquietant figuratiu.
- Iter 5 (actual): salt a WebGL + fluid simulation real. Aquesta primera fase és només el medi + tinta. El paramecio s'instal·larà sobre aquesta base.
