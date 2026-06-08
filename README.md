# Morfogènesi

**[Veure la peça en directe →](https://mrec8.github.io/morfogenesi/)**

Peça audiovisual interactiva que acompanya el TFG _Sensibilitat i intel·ligència_ (Martí Recalde Tarrón, Filosofia UB, curs 2025–2026).

La peça és una simulació en temps real de **Gray-Scott reaction-diffusion** sobre la GPU, amb interacció via cursor i una capa de memòria local que modula els paràmetres físics del medi. No representa cap organisme particular — mostra la classe de matemàtica de la qual els organismes estan fets.

## Com executar localment

No hi ha pas de build. Cal servir els arxius per HTTP (els `<script type="module">` no carreguen amb `file://`):

```bash
python3 -m http.server 8000
```

I obre <http://localhost:8000>.

Three.js es carrega via `importmap` des d'un CDN — no hi ha dependències npm.

## Estructura del repo

```
.
├── index.html                # Pàgina principal: peça + text expositiu
├── src/
│   ├── main.js               # Entry point: App class, render loop
│   ├── style.css             # Estètica del paper, panell, tipografia
│   ├── rd/
│   │   ├── grayScott.js      # Class GrayScott — pipeline GPU
│   │   └── shaders.js        # GLSL fragment shaders (update, splat, display, ...)
│   └── ui/
│       └── paramPanel.js     # Panell del Pearson space
└── docs/
    └── notes.md              # Bitàcola d'iteració
```

## Com funciona, breument

Cada frame:

1. **8 iteracions de Gray-Scott** en un buffer ping-pong RG (R = U, G = V). El laplacià es calcula amb un kernel 3×3. F i k es modulen espacialment per noise multi-octava (paisatge de patrons) i temporalment per dues sinusoidals incommensurables (viatge pel Pearson space).
2. **Decaïment del buffer d'història** — la saturació local que registra perturbacions.
3. **Render final**: el shader de display mapeja V a una paleta de gravat (paper → sèpia → tinta), amb edge detection per Sobel, glow càlid en patrons densos, i indicador d'habituació com a desaturació + tinte fred.

L'usuari injecta V al medi clicant/arrossegant, i la història local puja a la zona. Quan la saturació és alta, F i k locals s'inclinen cap a una regió "congelada"; quan reposa, decau.

## Tecnologies

- **Three.js 0.165** via importmap (sense bundler).
- **WebGL2** amb `HalfFloatType` render targets per als buffers de simulació.
- Vanilla ES modules; cap pas de build.

## Llicència / autoria

Codi i text per Martí Recalde Tarrón, 2026.
