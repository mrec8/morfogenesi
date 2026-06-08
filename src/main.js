// Entry point. Reaction-diffusion Gray-Scott amb interacció del cursor
// i memòria local que modula els paràmetres del sistema (detecció privativa).
//
// Pipeline per frame:
//   1. GrayScott.step(): n iteracions del solver al GPU.
//   2. Render: un quad fullscreen amb el display shader que mapeja el camp
//      a la paleta de gravat.

import * as THREE from 'three';
import { GrayScott } from './rd/grayScott.js';
import { DISPLAY_FRAG, VERT_QUAD } from './rd/shaders.js';
import { ParamPanel } from './ui/paramPanel.js';

const SIM_BASE = 480;

class App {
  constructor(container) {
    this.container = container;
    this._setupRenderer();
    this._setupSim();
    this._setupDisplay();
    this._setupInput();
    this._setupPanel();
    this.lastT = performance.now();
    this.frame = 0;

    window.addEventListener('resize', () => this._resize());
    this._resize();

    this._loop();
  }

  _setupPanel() {
    this.panel = new ParamPanel(this.container);
  }

  _setupRenderer() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0xeeece4, 1);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.cursor = 'crosshair';
    this.container.appendChild(this.renderer.domElement);
  }

  _simDimsForCanvas(w, h) {
    const aspect = w / h;
    if (aspect >= 1) {
      return { simW: Math.round(SIM_BASE * aspect), simH: SIM_BASE };
    }
    return { simW: SIM_BASE, simH: Math.round(SIM_BASE / aspect) };
  }

  _setupSim() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const dims = this._simDimsForCanvas(w, h);
    this.gs = new GrayScott(this.renderer, {
      width: dims.simW,
      height: dims.simH,
      F: 0.030,
      k: 0.058,
      Du: 1.0,
      Dv: 0.5,
      dt: 1.0,
      variation: 1.2,
      historyStrength: 0.85,
      historyDecay: 0.9975,
    });

    // Cicle temporal lent: F i k viatgen pel "Pearson space" — el sistema
    // mai s'estabilitza, passa de spots a estries a coral a mitosis, etc.
    // Periodes molt llargs (~2 min) per evitar canvis bruscos que esborrin
    // els patrons existents.
    this.fCenter = 0.0335;
    this.fAmp = 0.0095;
    this.fFreq = 0.00065;
    this.fPhase = 0;
    this.kCenter = 0.0595;
    this.kAmp = 0.0070;
    this.kFreq = 0.00081;
    this.kPhase = 1.4;

    // Cadència d'estímuls espontanis — el medi mai dorm del tot.
    this.nextAutoSplat = 90;
  }

  _setupDisplay() {
    this.displayScene = new THREE.Scene();
    this.displayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.displayCamera.position.z = 1;

    this.displayMat = new THREE.ShaderMaterial({
      uniforms: {
        uState: { value: null },
        uHistory: { value: null },
        uTexelSize: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
      },
      vertexShader: VERT_QUAD,
      fragmentShader: DISPLAY_FRAG,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.displayMat);
    mesh.frustumCulled = false;
    this.displayScene.add(mesh);
  }

  _setupInput() {
    this.pointerDown = false;
    this.lastX = -1;
    this.lastY = -1;
    const canvas = this.renderer.domElement;

    const toNorm = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = 1 - (clientY - rect.top) / rect.height;
      return { x, y };
    };

    canvas.addEventListener('pointerdown', (e) => {
      this.pointerDown = true;
      const p = toNorm(e.clientX, e.clientY);
      this.gs.splat(p.x, p.y, 0.0006, 0.9);
      this.lastX = p.x;
      this.lastY = p.y;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.pointerDown) return;
      const p = toNorm(e.clientX, e.clientY);
      const dx = p.x - this.lastX;
      const dy = p.y - this.lastY;
      if (dx * dx + dy * dy > 0.0003) {
        this.gs.splat(p.x, p.y, 0.0005, 0.55);
        this.lastX = p.x;
        this.lastY = p.y;
      }
    });
    canvas.addEventListener('pointerup', () => {
      this.pointerDown = false;
    });
    canvas.addEventListener('pointerleave', () => {
      this.pointerDown = false;
    });
  }

  _resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h, false);
    const dims = this._simDimsForCanvas(w, h);
    this.gs.setSize(dims.simW, dims.simH);
  }

  _autoSplat() {
    // Una llavor petita en posició aleatòria — la pieza no necessita
    // tenir-nos al davant per estar viva.
    const x = 0.12 + Math.random() * 0.76;
    const y = 0.12 + Math.random() * 0.76;
    const r = 0.00045 + Math.random() * 0.00045;
    const i = 0.35 + Math.random() * 0.35;
    this.gs.splat(x, y, r, i);
  }

  _loop() {
    this.frame++;
    const t = this.frame;

    // Viatge pel Pearson space. F i k oscil·len amb freqüències lleugerament
    // diferents → traçada quasi-quasi-periòdica.
    this.gs.params.F = this.fCenter + this.fAmp * Math.sin(t * this.fFreq + this.fPhase);
    this.gs.params.k = this.kCenter + this.kAmp * Math.sin(t * this.kFreq + this.kPhase);

    // Estímul espontani ocasional.
    this.nextAutoSplat--;
    if (this.nextAutoSplat <= 0) {
      this._autoSplat();
      this.nextAutoSplat = 120 + Math.random() * 280;
    }

    this.gs.step(8);

    this.displayMat.uniforms.uState.value = this.gs.getStateTexture();
    this.displayMat.uniforms.uHistory.value = this.gs.getHistoryTexture();
    this.displayMat.uniforms.uTexelSize.value.set(1 / this.gs.w, 1 / this.gs.h);
    this.displayMat.uniforms.uTime.value = t * 0.016;

    // Update the params panel (cada N frames per estalvi).
    if (t % 4 === 0) this.panel.update(this.gs.params.F, this.gs.params.k);

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.displayScene, this.displayCamera);

    requestAnimationFrame(() => this._loop());
  }
}

function mount() {
  const container = document.getElementById('pieza');
  if (!container) return;
  new App(container);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
