// Gray-Scott reaction-diffusion en GPU amb Three.js render targets.
//
// Manté dos buffers ping-pong RG:
//   - state (R = U, G = V): el camp químic.
//   - history (R = saturació local d'estimulació): la memòria que
//     modula localment els paràmetres del sistema (detecció privativa).
//
// Mètodes públics:
//   - seed(): inicialitza el camp amb llavors aleatòries.
//   - step(iterations): n iteracions del solver per frame.
//   - splat(x, y, radius, intensity): l'usuari diposita V en (x,y).
//     També puja la història local.
//   - getStateTexture() / getHistoryTexture(): textures per al display.

import * as THREE from 'three';
import {
  VERT_QUAD,
  SEED_FRAG,
  UPDATE_FRAG,
  SPLAT_FRAG,
  HISTORY_SPLAT_FRAG,
  HISTORY_DECAY_FRAG,
} from './shaders.js';

function makeRT(w, h) {
  return new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });
}

class PingPong {
  constructor(w, h) {
    this.read = makeRT(w, h);
    this.write = makeRT(w, h);
  }
  swap() {
    const t = this.read;
    this.read = this.write;
    this.write = t;
  }
  setSize(w, h) {
    this.read.setSize(w, h);
    this.write.setSize(w, h);
  }
  dispose() {
    this.read.dispose();
    this.write.dispose();
  }
}

export class GrayScott {
  constructor(renderer, opts = {}) {
    this.renderer = renderer;
    this.w = opts.width ?? 512;
    this.h = opts.height ?? 384;
    this.aspect = this.w / this.h;
    this.params = {
      Du: opts.Du ?? 1.0,
      Dv: opts.Dv ?? 0.5,
      F: opts.F ?? 0.037,
      k: opts.k ?? 0.06,
      dt: opts.dt ?? 1.0,
      historyStrength: opts.historyStrength ?? 0.8,
      historyDecay: opts.historyDecay ?? 0.997,
    };

    this.state = new PingPong(this.w, this.h);
    this.history = new PingPong(this.w, this.h);

    this._buildPasses();
    this.seed();
    this._clearHistory();
  }

  _buildPasses() {
    this.passScene = new THREE.Scene();
    this.passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.passCamera.position.z = 1;
    this.passMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.passMesh.frustumCulled = false;
    this.passScene.add(this.passMesh);

    const make = (frag, uniforms) =>
      new THREE.ShaderMaterial({
        vertexShader: VERT_QUAD,
        fragmentShader: frag,
        uniforms,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

    this.matSeed = make(SEED_FRAG, {});

    this.matUpdate = make(UPDATE_FRAG, {
      uState: { value: null },
      uTexelSize: { value: new THREE.Vector2(1 / this.w, 1 / this.h) },
      uDu: { value: this.params.Du },
      uDv: { value: this.params.Dv },
      uF: { value: this.params.F },
      uK: { value: this.params.k },
      uDt: { value: this.params.dt },
      uVariation: { value: this.params.variation ?? 1.0 },
      uHistory: { value: null },
      uHistoryStrength: { value: this.params.historyStrength },
    });

    this.matSplat = make(SPLAT_FRAG, {
      uState: { value: null },
      uPoint: { value: new THREE.Vector2(0.5, 0.5) },
      uRadius: { value: 0.001 },
      uIntensity: { value: 0.6 },
      uAspect: { value: this.aspect },
    });

    this.matHistorySplat = make(HISTORY_SPLAT_FRAG, {
      uHistory: { value: null },
      uPoint: { value: new THREE.Vector2(0.5, 0.5) },
      uRadius: { value: 0.002 },
      uAmount: { value: 0.4 },
      uAspect: { value: this.aspect },
    });

    this.matHistoryDecay = make(HISTORY_DECAY_FRAG, {
      uHistory: { value: null },
      uDecay: { value: this.params.historyDecay },
    });
  }

  _runPass(material, target) {
    this.passMesh.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.passScene, this.passCamera);
  }

  seed() {
    this._runPass(this.matSeed, this.state.write);
    this.state.swap();
  }

  _clearHistory() {
    // Pinta el history buffer a 0 utilitzant un decay extrem.
    this.matHistoryDecay.uniforms.uHistory.value = this.history.read.texture;
    this.matHistoryDecay.uniforms.uDecay.value = 0.0;
    this._runPass(this.matHistoryDecay, this.history.write);
    this.history.swap();
    this.matHistoryDecay.uniforms.uDecay.value = this.params.historyDecay;
  }

  step(iterations = 6) {
    for (let i = 0; i < iterations; i++) {
      this.matUpdate.uniforms.uState.value = this.state.read.texture;
      this.matUpdate.uniforms.uHistory.value = this.history.read.texture;
      this.matUpdate.uniforms.uF.value = this.params.F;
      this.matUpdate.uniforms.uK.value = this.params.k;
      this.matUpdate.uniforms.uDu.value = this.params.Du;
      this.matUpdate.uniforms.uDv.value = this.params.Dv;
      this.matUpdate.uniforms.uDt.value = this.params.dt;
      this.matUpdate.uniforms.uHistoryStrength.value = this.params.historyStrength;
      this.matUpdate.uniforms.uVariation.value = this.params.variation ?? 1.0;
      this._runPass(this.matUpdate, this.state.write);
      this.state.swap();
    }
    // Decaïment lent de la història.
    this.matHistoryDecay.uniforms.uHistory.value = this.history.read.texture;
    this.matHistoryDecay.uniforms.uDecay.value = this.params.historyDecay;
    this._runPass(this.matHistoryDecay, this.history.write);
    this.history.swap();
  }

  splat(x, y, radius = 0.001, intensity = 0.6) {
    // Splat al camp.
    this.matSplat.uniforms.uState.value = this.state.read.texture;
    this.matSplat.uniforms.uPoint.value.set(x, y);
    this.matSplat.uniforms.uRadius.value = radius;
    this.matSplat.uniforms.uIntensity.value = intensity;
    this.matSplat.uniforms.uAspect.value = this.aspect;
    this._runPass(this.matSplat, this.state.write);
    this.state.swap();

    // Splat al buffer d'història (amb un radi un pèl més gran).
    this.matHistorySplat.uniforms.uHistory.value = this.history.read.texture;
    this.matHistorySplat.uniforms.uPoint.value.set(x, y);
    this.matHistorySplat.uniforms.uRadius.value = radius * 1.6;
    this.matHistorySplat.uniforms.uAmount.value = intensity * 0.7;
    this.matHistorySplat.uniforms.uAspect.value = this.aspect;
    this._runPass(this.matHistorySplat, this.history.write);
    this.history.swap();
  }

  getStateTexture() {
    return this.state.read.texture;
  }

  getHistoryTexture() {
    return this.history.read.texture;
  }

  setSize(w, h) {
    this.w = w;
    this.h = h;
    this.aspect = w / h;
    this.state.setSize(w, h);
    this.history.setSize(w, h);
    this.matUpdate.uniforms.uTexelSize.value.set(1 / w, 1 / h);
    this.matSplat.uniforms.uAspect.value = this.aspect;
    this.matHistorySplat.uniforms.uAspect.value = this.aspect;
    this.seed();
    this._clearHistory();
  }
}
